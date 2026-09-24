"use server";

// Plateforme multi-entreprises (2026-09-24) — point d'application UNIQUE de l'isolation par
// organisation. `organizationId` provient TOUJOURS de la session serveur authentifiée (jamais
// d'une valeur envoyée par le navigateur : pas de paramètre d'URL, pas de champ de formulaire lu
// ici). Remplace le pattern historique `isAdmin ? {} : { societe }` (qui laissait un admin voir
// TOUTES les sociétés de la base, toutes organisations confondues) par un filtre toujours borné à
// l'organisation du membre gestionnaire connecté.
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isAdminSession, getUserId, getSociete } from "@/lib/auth";

export type OrgRole = "owner" | "admin" | "collaborator";

/** organizationId du membre gestionnaire actuellement connecté, ou null (client, ou pas de session). */
export async function getCurrentOrganizationId(): Promise<string | null> {
  if (!(await isAdminSession())) return null;
  const userId = await getUserId();
  if (!userId) return null;
  const member = await prisma.organizationMember.findUnique({ where: { userId }, select: { organizationId: true, disabledAt: true } });
  if (!member || member.disabledAt) return null;
  return member.organizationId;
}

export async function getCurrentOrgRole(): Promise<OrgRole | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const member = await prisma.organizationMember.findUnique({ where: { userId }, select: { orgRole: true, disabledAt: true } });
  if (!member || member.disabledAt) return null;
  return member.orgRole as OrgRole;
}

/**
 * Remplace `isAdmin ? {} : { societe }` partout dans l'app. Toujours borné :
 * - session client -> { societe: <sa propre société> } (comportement inchangé)
 * - session admin  -> { societe: { in: [...toutes les sociétés de SON organisation] } } (jamais
 *   toutes les sociétés de la base — c'est le fix multi-tenant)
 * - ni l'un ni l'autre -> { societe: "__aucune__" } (aucune ligne ne peut matcher, jamais un
 *   `{}` qui renverrait tout par erreur)
 */
export async function getVisibleSocieteFilter(): Promise<{ societe: string } | { societe: { in: string[] } }> {
  if (await isAdminSession()) {
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) return { societe: "__aucune__" };
    const societes = await prisma.societe.findMany({ where: { organizationId }, select: { nom: true } });
    return { societe: { in: societes.map((s) => s.nom) } };
  }
  const societe = await getSociete();
  return { societe: societe ?? "__aucune__" };
}

/** Les noms de société visibles pour la session courante — utile quand le where a besoin du
 * tableau brut plutôt que d'un objet Prisma (ex. filtrage manuel côté JS). */
export async function getVisibleSocieteNames(): Promise<string[] | "all-own-societe"> {
  if (await isAdminSession()) {
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) return [];
    const societes = await prisma.societe.findMany({ where: { organizationId }, select: { nom: true } });
    return societes.map((s) => s.nom);
  }
  return "all-own-societe";
}

/** true si `societeNom` appartient à l'organisation de l'admin connecté (ou si c'est bien la
 * propre société du client connecté) — pour les contrôles ponctuels hors requête `where`. */
export async function isSocieteVisible(societeNom: string): Promise<boolean> {
  if (await isAdminSession()) {
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) return false;
    const societe = await prisma.societe.findUnique({ where: { nom: societeNom }, select: { organizationId: true } });
    return !!societe && societe.organizationId === organizationId;
  }
  const societe = await getSociete();
  return societe === societeNom;
}

/** Redirige si l'utilisateur courant n'est pas un membre gestionnaire actif d'une organisation. */
export async function requireOrganizationId(): Promise<string> {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return organizationId as string;
}

/** Journal d'activité au niveau organisation — jamais bloquant (catch silencieux comme SocieteAudit). */
export async function logOrganizationActivity(organizationId: string, action: string, details?: string, acteur?: string) {
  await prisma.organizationAudit.create({ data: { organizationId, action, details, acteur } }).catch(() => {});
}

export async function isSuperAdminSession(): Promise<boolean> {
  const jar = await cookies();
  const userId = jar.get("userId")?.value;
  if (!userId) return false;
  const emails = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return !!user?.email && emails.includes(user.email.toLowerCase());
}
