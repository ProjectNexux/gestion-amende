"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { isAdminSession } from "@/lib/auth";
import { generateSetupToken, setupTokenExpiryDate, generatePlaceholderCodeAcces } from "@/lib/societe-setup";
import { normalizeSiret, isValidSiret } from "@/lib/siret";

const LIST_PATH = "/admin/clients";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function requireAdmin() {
  if (!(await isAdminSession())) notFound();
}

async function audit(societeId: string, action: string, details?: string) {
  await prisma.societeAudit.create({ data: { societeId, action, details: details ?? null, acteur: "Admin" } });
}

export type CreateClientState = { error?: string; ok?: boolean; id?: string };

/** Full create flow: fiche client + compte + accès + espace client, all in one atomic-ish call. */
export async function createClientAction(_prev: CreateClientState, fd: FormData): Promise<CreateClientState> {
  if (!(await isAdminSession())) return { error: "Accès refusé." };

  const nom = str(fd, "nom");
  if (!nom) return { error: "Le nom de la société est obligatoire." };

  const siretRaw = str(fd, "siret");
  const siret = siretRaw ? normalizeSiret(siretRaw) : null;
  if (siret && !isValidSiret(siret)) return { error: "Le SIRET doit contenir exactement 14 chiffres." };

  if (siret) {
    const existingBySiret = await prisma.societe.findUnique({ where: { siret } });
    if (existingBySiret) return { error: `Cette société existe déjà dans vos clients (SIRET ${siret}).`, id: existingBySiret.id };
  }
  const existingByName = await prisma.societe.findUnique({ where: { nom } });
  if (existingByName) return { error: "Une société avec ce nom existe déjà.", id: existingByName.id };

  const email = str(fd, "email");
  if (email) {
    const emailInUse = await prisma.user.findUnique({ where: { email } });
    if (emailInUse) return { error: "Un compte utilise déjà cette adresse e-mail." };
  }

  const societe = await prisma.societe.create({
    data: {
      nom,
      codeAcces: generatePlaceholderCodeAcces(),
      codeAccesSetupToken: generateSetupToken(),
      codeAccesSetupExpiresAt: setupTokenExpiryDate(),
      siret,
      siren: str(fd, "siren"),
      tradeName: str(fd, "tradeName"),
      legalForm: str(fd, "legalForm"),
      vatNumber: str(fd, "vatNumber"),
      nafCode: str(fd, "nafCode"),
      activityLabel: str(fd, "activityLabel"),
      addressLine1: str(fd, "addressLine1"),
      addressLine2: str(fd, "addressLine2"),
      postalCode: str(fd, "postalCode"),
      city: str(fd, "city"),
      country: str(fd, "country") ?? "France",
      contactCivilite: str(fd, "contactCivilite"),
      contactFirstName: str(fd, "contactFirstName"),
      contactLastName: str(fd, "contactLastName"),
      contactRole: str(fd, "contactRole"),
      phone: str(fd, "phone"),
      phoneSecondary: str(fd, "phoneSecondary"),
      email,
      emailSecondary: str(fd, "emailSecondary"),
    },
  });

  // Auto-provision the paired User row (role "client") — the espace client is instantly available
  // for this société as soon as they set their access code via the setup link.
  const displayName = [str(fd, "contactFirstName"), str(fd, "contactLastName")].filter(Boolean).join(" ") || nom;
  await prisma.user.create({
    data: {
      societeId: societe.id,
      nom: str(fd, "contactLastName") ?? nom,
      prenom: str(fd, "contactFirstName") ?? "Compte",
      email,
      telephone: str(fd, "phone"),
      role: "client",
      isActive: true,
    },
  });

  await audit(societe.id, "creation", `Client créé (${displayName})`);
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${societe.id}`);

  return { ok: true, id: societe.id };
}

export async function updateClientAction(id: string, fd: FormData) {
  await requireAdmin();
  const existing = await prisma.societe.findUnique({ where: { id } });
  if (!existing) notFound();

  const nom = str(fd, "nom") ?? existing.nom;
  const siretRaw = str(fd, "siret");
  const siret = siretRaw ? normalizeSiret(siretRaw) : null;

  await prisma.societe.update({
    where: { id },
    data: {
      nom,
      siret,
      siren: str(fd, "siren"),
      tradeName: str(fd, "tradeName"),
      legalForm: str(fd, "legalForm"),
      vatNumber: str(fd, "vatNumber"),
      nafCode: str(fd, "nafCode"),
      activityLabel: str(fd, "activityLabel"),
      addressLine1: str(fd, "addressLine1"),
      addressLine2: str(fd, "addressLine2"),
      postalCode: str(fd, "postalCode"),
      city: str(fd, "city"),
      country: str(fd, "country") ?? "France",
      contactCivilite: str(fd, "contactCivilite"),
      contactFirstName: str(fd, "contactFirstName"),
      contactLastName: str(fd, "contactLastName"),
      contactRole: str(fd, "contactRole"),
      phone: str(fd, "phone"),
      phoneSecondary: str(fd, "phoneSecondary"),
      email: str(fd, "email"),
      emailSecondary: str(fd, "emailSecondary"),
    },
  });

  await audit(id, "informations_modifiees", "Fiche modifiée manuellement");
  revalidatePath(`${LIST_PATH}/${id}`);
  redirect(`${LIST_PATH}/${id}`);
}

export async function regenerateSetupLinkAction(id: string) {
  await requireAdmin();
  await prisma.societe.update({
    where: { id },
    data: { codeAccesSetupToken: generateSetupToken(), codeAccesSetupExpiresAt: setupTokenExpiryDate() },
  });
  await audit(id, "code_regenere", "Lien de création du code d'accès régénéré");
  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath(LIST_PATH);
}

export async function markInvitationSentAction(id: string) {
  await requireAdmin();
  await prisma.societe.update({ where: { id }, data: { invitationSentAt: new Date() } });
  await audit(id, "invitation_envoyee", "Invitation marquée comme envoyée");
  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath(LIST_PATH);
}

export async function deactivateClientAction(id: string) {
  await requireAdmin();
  await prisma.societe.update({ where: { id }, data: { archivedAt: new Date() } });
  await prisma.user.updateMany({ where: { societeId: id }, data: { isActive: false } });
  await audit(id, "desactivation", "Compte désactivé");
  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath(LIST_PATH);
}

export async function reactivateClientAction(id: string) {
  await requireAdmin();
  await prisma.societe.update({ where: { id }, data: { archivedAt: null } });
  await prisma.user.updateMany({ where: { societeId: id }, data: { isActive: true } });
  await audit(id, "reactivation", "Compte réactivé");
  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath(LIST_PATH);
}
