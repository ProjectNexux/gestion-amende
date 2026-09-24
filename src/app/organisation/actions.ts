"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { isAdminSession } from "@/lib/auth";
import { getCurrentOrganizationId, getCurrentOrgRole, logOrganizationActivity } from "@/lib/org-scope";
import { generateSetupToken, setupTokenExpiryDate } from "@/lib/societe-setup";
import { sendOrganizationInvitationEmail } from "@/lib/organization-invitation-email";

const PATH = "/organisation";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function requireOrganization() {
  if (!(await isAdminSession())) redirect("/login");
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/login");
  return organizationId;
}

/** Only owner/admin can manage members and organization settings — a collaborator can view but
 * not mutate (cahier des charges §4 : "le collaborateur agit uniquement selon ses autorisations"). */
async function requireManagerRole() {
  const organizationId = await requireOrganization();
  const role = await getCurrentOrgRole();
  if (role !== "owner" && role !== "admin") notFound();
  return organizationId;
}

export async function updateOrganizationAction(fd: FormData) {
  const organizationId = await requireManagerRole();
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      name: str(fd, "name") ?? undefined,
      contactEmail: str(fd, "contactEmail"),
      contactPhone: str(fd, "contactPhone"),
      addressLine1: str(fd, "addressLine1"),
      postalCode: str(fd, "postalCode"),
      city: str(fd, "city"),
      logoUrl: str(fd, "logoUrl"),
    },
  });
  await logOrganizationActivity(organizationId, "informations_modifiees", "Informations de l'organisation modifiées");
  revalidatePath(PATH);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteMemberState = { error?: string; ok?: boolean };

export async function inviteOrganizationMemberAction(_prev: InviteMemberState, fd: FormData): Promise<InviteMemberState> {
  const organizationId = await requireManagerRole();
  const email = str(fd, "email")?.toLowerCase();
  const orgRole = str(fd, "orgRole") ?? "admin";
  if (!email || !EMAIL_RE.test(email)) return { error: "Adresse e-mail invalide." };
  if (!["owner", "admin", "collaborator"].includes(orgRole)) return { error: "Rôle invalide." };

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return { error: "Cette adresse e-mail est déjà utilisée par un compte existant." };

  const existingInvite = await prisma.organizationInvitation.findFirst({ where: { organizationId, email, acceptedAt: null } });
  if (existingInvite) {
    await prisma.organizationInvitation.delete({ where: { id: existingInvite.id } });
  }

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return { error: "Organisation introuvable." };

  const token = generateSetupToken();
  await prisma.organizationInvitation.create({
    data: { organizationId, email, orgRole, token, expiresAt: setupTokenExpiryDate() },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gestion-amende.vercel.app";
  const setupUrl = `${appUrl.replace(/\/$/, "")}/organisation-setup/${token}`;

  try {
    await sendOrganizationInvitationEmail({ to: email, organizationName: organization.name, setupUrl, orgRole });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logOrganizationActivity(organizationId, "invitation_echec", `Échec d'envoi pour ${email} : ${msg}`);
    revalidatePath(PATH);
    return { error: `Invitation créée, mais l'envoi de l'e-mail a échoué : ${msg}. Vous pouvez la renvoyer.` };
  }

  await logOrganizationActivity(organizationId, "invitation_envoyee", `Invitation envoyée à ${email} (${orgRole})`);
  revalidatePath(PATH);
  return { ok: true };
}

export async function resendOrganizationInvitationAction(invitationId: string) {
  const organizationId = await requireManagerRole();
  const invite = await prisma.organizationInvitation.findFirst({ where: { id: invitationId, organizationId } });
  if (!invite) notFound();

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) notFound();

  const token = generateSetupToken();
  await prisma.organizationInvitation.update({ where: { id: invitationId }, data: { token, expiresAt: setupTokenExpiryDate() } });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gestion-amende.vercel.app";
  const setupUrl = `${appUrl.replace(/\/$/, "")}/organisation-setup/${token}`;
  await sendOrganizationInvitationEmail({ to: invite.email, organizationName: organization.name, setupUrl, orgRole: invite.orgRole });

  await logOrganizationActivity(organizationId, "invitation_renvoyee", `Invitation renvoyée à ${invite.email}`);
  revalidatePath(PATH);
}

export async function cancelOrganizationInvitationAction(invitationId: string) {
  const organizationId = await requireManagerRole();
  const invite = await prisma.organizationInvitation.findFirst({ where: { id: invitationId, organizationId } });
  if (!invite) notFound();
  await prisma.organizationInvitation.delete({ where: { id: invitationId } });
  await logOrganizationActivity(organizationId, "invitation_annulee", `Invitation annulée pour ${invite.email}`);
  revalidatePath(PATH);
}

export async function setMemberRoleAction(memberId: string, orgRole: string) {
  const organizationId = await requireManagerRole();
  if (!["owner", "admin", "collaborator"].includes(orgRole)) return;
  const member = await prisma.organizationMember.findFirst({ where: { id: memberId, organizationId }, include: { user: true } });
  if (!member) notFound();
  await prisma.organizationMember.update({ where: { id: memberId }, data: { orgRole } });
  await logOrganizationActivity(organizationId, "role_modifie", `${member.user.prenom} ${member.user.nom} → ${orgRole}`);
  revalidatePath(PATH);
}

export async function toggleMemberDisabledAction(memberId: string, disabled: boolean) {
  const organizationId = await requireManagerRole();
  const member = await prisma.organizationMember.findFirst({ where: { id: memberId, organizationId }, include: { user: true } });
  if (!member) notFound();
  await prisma.organizationMember.update({ where: { id: memberId }, data: { disabledAt: disabled ? new Date() : null } });
  await prisma.user.update({ where: { id: member.userId }, data: { isActive: !disabled } });
  await logOrganizationActivity(organizationId, disabled ? "membre_desactive" : "membre_active", `${member.user.prenom} ${member.user.nom}`);
  revalidatePath(PATH);
}
