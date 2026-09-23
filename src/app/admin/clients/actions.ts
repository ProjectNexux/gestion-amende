"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { isAdminSession } from "@/lib/auth";
import { generateSetupToken, setupTokenExpiryDate, generatePlaceholderCodeAcces, buildSetupUrl, isSetupTokenExpired } from "@/lib/societe-setup";
import { normalizeSiret, isValidSiret } from "@/lib/siret";
import { sendClientInvitationEmail } from "@/lib/client-invitation-email";
import { sendUserInvitationEmail } from "@/lib/user-invitation-email";

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

export type CreateClientState = { error?: string; ok?: boolean; id?: string; setupUrl?: string };

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gestion-amende.vercel.app";
  const setupUrl = societe.codeAccesSetupToken ? buildSetupUrl(appUrl, societe.codeAccesSetupToken) : undefined;
  return { ok: true, id: societe.id, setupUrl };
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

// Désactiver = temporary access block (`disabledAt`). Distinct from archiving: the société stays
// in the main list, all data untouched, reversible with a single click.
export async function deactivateClientAction(id: string) {
  await requireAdmin();
  await prisma.societe.update({ where: { id }, data: { disabledAt: new Date() } });
  await prisma.user.updateMany({ where: { societeId: id }, data: { isActive: false } });
  await audit(id, "desactivation", "Compte désactivé");
  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath(LIST_PATH);
}

export async function reactivateClientAction(id: string) {
  await requireAdmin();
  await prisma.societe.update({ where: { id }, data: { disabledAt: null } });
  await prisma.user.updateMany({ where: { societeId: id }, data: { isActive: true } });
  await audit(id, "reactivation", "Compte réactivé");
  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath(LIST_PATH);
}

/**
 * Archiver = soft-delete: hidden from the default "Tous/Actifs/…" list views, access blocked,
 * but every linked document/contravention/véhicule/conducteur row is kept exactly as-is —
 * never a destructive delete. Reversible via `unarchiveClientAction`.
 */
export async function archiveClientAction(id: string) {
  await requireAdmin();
  await prisma.societe.update({ where: { id }, data: { archivedAt: new Date() } });
  await prisma.user.updateMany({ where: { societeId: id }, data: { isActive: false } });
  await audit(id, "archivage", "Société archivée par l'administrateur");
  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath(LIST_PATH);
}

export async function unarchiveClientAction(id: string) {
  await requireAdmin();
  await prisma.societe.update({ where: { id }, data: { archivedAt: null } });
  await audit(id, "desarchivage", "Société désarchivée par l'administrateur");
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
    data: { activatedAt: s.activatedAt ?? new Date(), archivedAt: null, disabledAt: null },
  });
  await prisma.user.updateMany({ where: { societeId: id }, data: { isActive: true } });
  await audit(id, "compte_active", "Compte activé manuellement par l'admin");
  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath(LIST_PATH);
}

/** Toggles a single linked User's access without touching the whole société (used by the
 * "Utilisateurs" tab — a société can have more than one user account in the schema, even
 * though the créer-un-client wizard only ever provisions one today). */
export async function toggleUserActiveAction(userId: string, next: boolean) {
  await requireAdmin();
  const user = await prisma.user.update({ where: { id: userId }, data: { isActive: next } });
  await audit(user.societeId, next ? "utilisateur_active" : "utilisateur_desactive", `Compte utilisateur ${user.email ?? user.id} ${next ? "activé" : "désactivé"}`);
  revalidatePath(`${LIST_PATH}/${user.societeId}`);
}

/** Removes a user row. Safe/reversible in practice: the next successful login re-provisions a
 * user for that société automatically (see `ensureUserForSociete`). */
export async function deleteUserAction(userId: string) {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound();
  await prisma.user.delete({ where: { id: userId } });
  await audit(user.societeId, "utilisateur_supprime", `Compte utilisateur ${user.email ?? user.id} supprimé`);
  revalidatePath(`${LIST_PATH}/${user.societeId}`);
}

/** Transmet/retire un Courrier du portail client — même principe que
 * `toggleVisibleClientAction` sur les contraventions, mais pour les courriers, exposé depuis
 * l'onglet "Documents" de la fiche société. */
export async function toggleCourrierVisibleAction(courrierId: string, next: boolean, societeId: string) {
  await requireAdmin();
  await prisma.courrier.update({ where: { id: courrierId }, data: { visibleClient: next } });
  await audit(societeId, next ? "document_transmis" : "document_retire", `Document ${next ? "transmis au" : "retiré du"} portail client`);
  revalidatePath(`${LIST_PATH}/${societeId}`);
  revalidatePath("/client");
  revalidatePath("/client/courriers");
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

// ---------------------------------------------------------------------------------------------
// Multi-user client accounts (2026-09-23) — several named people per société, each with their
// own hashed password, additive alongside the legacy société-wide `codeAcces` (see PART 7).
// ---------------------------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AddUserState = { error?: string; ok?: boolean };

/** Adds a new named user to a société and immediately sends their invitation e-mail. */
export async function addClientUserAction(societeId: string, _prev: AddUserState, fd: FormData): Promise<AddUserState> {
  await requireAdmin();
  const prenom = str(fd, "prenom");
  const nom = str(fd, "nom");
  const email = str(fd, "email")?.toLowerCase() ?? null;
  const isPrincipal = fd.get("isPrincipal") === "on";

  if (!prenom || !nom) return { error: "Prénom et nom requis." };
  if (!email || !EMAIL_RE.test(email)) return { error: "Adresse e-mail invalide." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Cette adresse e-mail est déjà utilisée par un autre compte." };

  const societe = await prisma.societe.findUnique({ where: { id: societeId } });
  if (!societe) return { error: "Société introuvable." };

  if (isPrincipal) {
    await prisma.user.updateMany({ where: { societeId, isPrincipal: true }, data: { isPrincipal: false } });
  }

  const token = generateSetupToken();
  const user = await prisma.user.create({
    data: {
      societeId,
      prenom,
      nom,
      email,
      role: "client",
      isActive: true,
      isPrincipal,
      invitationToken: token,
      invitationExpiresAt: setupTokenExpiryDate(),
      invitedAt: new Date(),
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gestion-amende.vercel.app";
  const setupUrl = buildSetupUrl(appUrl, token).replace("/client-setup/", "/user-setup/");

  try {
    await sendUserInvitationEmail({ to: email, societeName: societe.nom, setupUrl, prenom });
    await audit(societeId, "utilisateur_invite", `Invitation envoyée à ${prenom} ${nom} (${email})`);
  } catch (e) {
    // Invitation row is kept (never a fake success) — the admin can retry via "Renvoyer l'invitation".
    const msg = e instanceof Error ? e.message : String(e);
    await audit(societeId, "utilisateur_invite", `Compte créé mais échec d'envoi pour ${email} : ${msg}`);
    revalidatePath(`${LIST_PATH}/${societeId}`);
    return { error: `Compte créé, mais l'envoi de l'invitation a échoué : ${msg}. Vous pouvez la renvoyer depuis la liste.`, ok: true };
  }

  revalidatePath(`${LIST_PATH}/${societeId}`);
  return { ok: true };
}

export async function updateClientUserAction(userId: string, fd: FormData) {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound();

  const prenom = str(fd, "prenom") ?? user.prenom;
  const nom = str(fd, "nom") ?? user.nom;
  const email = str(fd, "email")?.toLowerCase() ?? user.email;

  if (email && email !== user.email) {
    if (!EMAIL_RE.test(email)) throw new Error("Adresse e-mail invalide.");
    const dup = await prisma.user.findUnique({ where: { email } });
    if (dup && dup.id !== userId) throw new Error("Cette adresse e-mail est déjà utilisée par un autre compte.");
  }

  await prisma.user.update({ where: { id: userId }, data: { prenom, nom, email } });
  await audit(user.societeId, "utilisateur_modifie", `Informations mises à jour pour ${prenom} ${nom}`);
  revalidatePath(`${LIST_PATH}/${user.societeId}`);
}

/** Exactly one contact principal per société. */
export async function setPrincipalUserAction(userId: string) {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound();
  await prisma.user.updateMany({ where: { societeId: user.societeId, isPrincipal: true }, data: { isPrincipal: false } });
  await prisma.user.update({ where: { id: userId }, data: { isPrincipal: true } });
  await audit(user.societeId, "contact_principal_defini", `${user.prenom} ${user.nom} défini comme contact principal`);
  revalidatePath(`${LIST_PATH}/${user.societeId}`);
}

async function sendUserInvitationOrReset(userId: string, isReset: boolean) {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { societe: true } });
  if (!user) notFound();
  if (!user.email) throw new Error("Aucune adresse e-mail pour ce compte.");

  const token = generateSetupToken();
  await prisma.user.update({
    where: { id: userId },
    data: { invitationToken: token, invitationExpiresAt: setupTokenExpiryDate() },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gestion-amende.vercel.app";
  const setupUrl = buildSetupUrl(appUrl, token).replace("/client-setup/", "/user-setup/");

  try {
    await sendUserInvitationEmail({ to: user.email, societeName: user.societe.nom, setupUrl, prenom: user.prenom, isReset });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await audit(user.societeId, "utilisateur_invite", `Échec d'envoi (${isReset ? "réinitialisation" : "invitation"}) pour ${user.email} : ${msg}`);
    throw new Error(`Échec de l'envoi : ${msg}`);
  }

  if (!isReset) await prisma.user.update({ where: { id: userId }, data: { invitedAt: new Date() } });
  await audit(user.societeId, "utilisateur_invite", `${isReset ? "Réinitialisation" : "Invitation"} envoyée à ${user.email}`);
  revalidatePath(`${LIST_PATH}/${user.societeId}`);
}

/** Used both for the very first invitation and for "Renvoyer l'invitation" (same action, always
 * regenerates a fresh token so an expired link never gets silently resent unusable). */
export async function sendUserInvitationAction(userId: string) {
  await sendUserInvitationOrReset(userId, false);
}

/** A password reset is only meaningful once the user already has one set — otherwise it's just
 * the initial invitation (see sendUserInvitationAction). */
export async function sendUserPasswordResetAction(userId: string) {
  await sendUserInvitationOrReset(userId, true);
}

