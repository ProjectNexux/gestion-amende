"use server";

import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { hashPassword } from "@/lib/password";
import { logOrganizationActivity } from "@/lib/org-scope";

export async function acceptOrganizationInvitationAction(token: string, fd: FormData) {
  const prenom = ((fd.get("prenom") as string) ?? "").trim();
  const nom = ((fd.get("nom") as string) ?? "").trim();
  const password = (fd.get("password") as string) ?? "";
  const confirmation = (fd.get("confirmation") as string) ?? "";

  const invitation = await prisma.organizationInvitation.findUnique({ where: { token } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() < Date.now()) notFound();

  if (!prenom || !nom) {
    redirect(`/organisation-setup/${token}?error=name`);
  }
  if (password.length < 8) {
    redirect(`/organisation-setup/${token}?error=length`);
  }
  if (password !== confirmation) {
    redirect(`/organisation-setup/${token}?error=mismatch`);
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existingUser) notFound();

  const homeSociete = await prisma.societe.findFirst({ where: { organizationId: invitation.organizationId, isOrganizationHome: true } });
  if (!homeSociete) notFound();

  const user = await prisma.user.create({
    data: {
      societeId: homeSociete.id,
      prenom,
      nom,
      email: invitation.email,
      role: "admin",
      isActive: true,
      passwordHash: hashPassword(password),
    },
  });

  await prisma.organizationMember.create({
    data: { organizationId: invitation.organizationId, userId: user.id, orgRole: invitation.orgRole },
  });

  await prisma.organizationInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
  await logOrganizationActivity(invitation.organizationId, "invitation_acceptee", `${prenom} ${nom} (${invitation.email}) a rejoint l'organisation`);

  redirect("/login?setup=1");
}
