"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { isAdminSession } from "@/lib/auth";
import { generateSetupToken, setupTokenExpiryDate, generatePlaceholderCodeAcces, buildSetupUrl, isSetupTokenExpired } from "@/lib/societe-setup";
import { normalizeSiret, isValidSiret } from "@/lib/siret";
import { sendClientInvitationEmail } from "@/lib/client-invitation-email";

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
  await audit(id, "invitation_envoyee", "Invitation marquée comme envoyée manuellement");
  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath(LIST_PATH);
}

/**
 * Sends the invitation e-mail to the client (contact email on the fiche) with their one-time
 * setup link. Regenerates the setup token first if it's already expired so the link the client
 * receives is always usable. Failure surfaces via the `SocieteAudit` log (audit action with the
 * error message) and via a re-thrown error the calling page handles.
 */
export async function sendInvitationAction(id: string) {
  await requireAdmin();
  const societe = await prisma.societe.findUnique({ where: { id } });
  if (!societe) notFound();
  if (!societe.email) {
    await audit(id, "invitation_envoyee", "Échec envoi : aucune adresse e-mail renseignée");
    throw new Error("Aucune adresse e-mail renseignée pour ce client.");
  }

  // Refresh the setup token when it's missing or expired — an admin should never send a link
  // that will fail the moment the client clicks it.
  let token = societe.codeAccesSetupToken;
  if (!token || isSetupTokenExpired(societe.codeAccesSetupExpiresAt)) {
    token = generateSetupToken();
    await prisma.societe.update({
      where: { id },
      data: { codeAccesSetupToken: token, codeAccesSetupExpiresAt: setupTokenExpiryDate() },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gestion-amende.vercel.app";
  const setupUrl = buildSetupUrl(appUrl, token);

  try {
    await sendClientInvitationEmail({
      to: societe.email,
      societeName: societe.nom,
      setupUrl,
      contactFirstName: societe.contactFirstName,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await audit(id, "invitation_envoyee", `Échec envoi : ${msg}`);
    throw new Error(`Échec de l'envoi de l'invitation : ${msg}`);
  }

  await prisma.societe.update({ where: { id }, data: { invitationSentAt: new Date() } });
  await audit(id, "invitation_envoyee", `E-mail envoyé à ${societe.email}`);
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

/**
 * Manually mark a client account as activated (without waiting for the client's first login).
 * Useful when the admin already knows the client is up and running (e.g. code shared verbally)
 * and just wants the badge to switch to "Actif" immediately.
 */
export async function activateClientAction(id: string) {
  await requireAdmin();
  const s = await prisma.societe.findUnique({ where: { id } });
  if (!s) notFound();
  await prisma.societe.update({
    where: { id },
    data: { activatedAt: s.activatedAt ?? new Date(), archivedAt: null },
  });
  await prisma.user.updateMany({ where: { societeId: id }, data: { isActive: true } });
  await audit(id, "compte_active", "Compte activé manuellement par l'admin");
  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath(LIST_PATH);
}

/**
 * Smart delete: archives (soft delete) by default, so linked data stays intact. Hard delete is
 * ONLY allowed when the client owns zero linked records (documents / courriers / contraventions /
 * véhicules / conducteurs / sinistres) — otherwise falls back to archive with a message. The
 * calling UI is responsible for the double confirmation.
 */
export async function deleteClientAction(id: string) {
  await requireAdmin();
  const s = await prisma.societe.findUnique({ where: { id } });
  if (!s) notFound();

  const [courriers, contraventions, vehicules, conducteurs, sinistres] = await Promise.all([
    prisma.courrier.count({ where: { societe: s.nom } }),
    prisma.contravention.count({ where: { societe: s.nom } }),
    prisma.vehicule.count({ where: { societe: s.nom } }),
    prisma.conducteur.count({ where: { societe: s.nom } }),
    prisma.sinistre.count({ where: { societe: s.nom } }),
  ]);
  const hasData = courriers + contraventions + vehicules + conducteurs + sinistres > 0;

  if (hasData) {
    // Fall back to archive — never orphan a document/vehicule row silently.
    await prisma.societe.update({ where: { id }, data: { archivedAt: new Date() } });
    await prisma.user.updateMany({ where: { societeId: id }, data: { isActive: false } });
    await audit(id, "archivage", `Suppression demandée mais des données existent — archivage à la place (${courriers} courriers, ${contraventions} contraventions, ${vehicules} véhicules, ${conducteurs} conducteurs)`);
    revalidatePath(LIST_PATH);
    redirect(LIST_PATH);
  }

  // No linked data — safe to delete for real.
  await prisma.societeAudit.deleteMany({ where: { societeId: id } });
  await prisma.user.deleteMany({ where: { societeId: id } });
  await prisma.societe.delete({ where: { id } });
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}
