"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isSuperAdminSession, logOrganizationActivity } from "@/lib/org-scope";
import { generateSetupToken, setupTokenExpiryDate, generatePlaceholderCodeAcces } from "@/lib/societe-setup";
import { sendOrganizationInvitationEmail } from "@/lib/organization-invitation-email";
import { lookupCompanyBySiret } from "@/lib/company-lookup";
import { normalizeSiret, isValidSiret } from "@/lib/siret";

export type CreateOrganizationState = { error?: string; ok?: boolean; organizationId?: string };

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parcours sécurisé de création d'une nouvelle organisation gestionnaire (cahier des charges §7) —
 * réservé au super-administrateur de la plateforme. Une nouvelle organisation ne reçoit JAMAIS de
 * donnée de démonstration appartenant à NetEco : elle démarre avec zéro société cliente, zéro
 * document, zéro contravention — uniquement sa propre société "maison" vide + son propriétaire.
 */
export async function createOrganizationAction(_prev: CreateOrganizationState, fd: FormData): Promise<CreateOrganizationState> {
  if (!(await isSuperAdminSession())) return { error: "Accès refusé." };

  const name = str(fd, "name");
  const ownerEmail = str(fd, "ownerEmail")?.toLowerCase();
  if (!name) return { error: "Le nom de l'organisation est obligatoire." };
  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return { error: "Adresse e-mail du propriétaire invalide." };

  const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (existingUser) return { error: "Cette adresse e-mail est déjà utilisée par un compte existant." };

  const siretRaw = str(fd, "siret");
  const siret = siretRaw ? normalizeSiret(siretRaw) : null;
  if (siret && !isValidSiret(siret)) return { error: "Le SIRET doit contenir exactement 14 chiffres." };

  const baseSlug = slugify(name) || "organisation";
  let slug = baseSlug;
  let n = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++n}`;
  }

  // Récupération automatique des informations légales si un SIRET valide est fourni — jamais
  // bloquant : une erreur de l'API publique ne doit jamais empêcher la création.
  let lookup: Awaited<ReturnType<typeof lookupCompanyBySiret>> = null;
  if (siret) {
    try {
      lookup = await lookupCompanyBySiret(siret);
    } catch {
      lookup = null;
    }
  }

  const organization = await prisma.organization.create({
    data: {
      name,
      slug,
      siret,
      contactEmail: ownerEmail,
      addressLine1: lookup?.addressLine1 ?? null,
      postalCode: lookup?.postalCode ?? null,
      city: lookup?.city ?? null,
    },
  });

  // Société "maison" vide (isOrganizationHome) — jamais de données de démonstration copiées de
  // NetEco. Même convention self-service que la création d'une société cliente classique.
  const homeNom = `${name} (Espace ${name})`.length > 60 ? name : `Espace ${name}`;
  let societeNom = homeNom;
  let attempt = 1;
  while (await prisma.societe.findUnique({ where: { nom: societeNom } })) {
    societeNom = `${homeNom} (${++attempt})`;
  }
  await prisma.societe.create({
    data: {
      nom: societeNom,
      organizationId: organization.id,
      isOrganizationHome: true,
      codeAcces: generatePlaceholderCodeAcces(),
      codeAccesSetupToken: generateSetupToken(),
      codeAccesSetupExpiresAt: setupTokenExpiryDate(),
    },
  });

  const token = generateSetupToken();
  await prisma.organizationInvitation.create({
    data: { organizationId: organization.id, email: ownerEmail, orgRole: "owner", token, expiresAt: setupTokenExpiryDate() },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gestion-amende.vercel.app";
  const setupUrl = `${appUrl.replace(/\/$/, "")}/organisation-setup/${token}`;

  try {
    await sendOrganizationInvitationEmail({ to: ownerEmail, organizationName: name, setupUrl, orgRole: "owner" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logOrganizationActivity(organization.id, "invitation_echec", `Échec d'envoi au propriétaire ${ownerEmail} : ${msg}`);
  }

  await logOrganizationActivity(organization.id, "creation", `Organisation créée, propriétaire invité : ${ownerEmail}`);

  return { ok: true, organizationId: organization.id };
}

export async function requireSuperAdmin() {
  if (!(await isSuperAdminSession())) redirect("/login");
}
