"use server";

import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/password";

const ADMIN_CODE = process.env.ADMIN_CODE ?? "admin123";

function makeUserEmailFromSociete(nom: string) {
  return `${nom.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-local@gestion-amendes.local`;
}

// Minimal brute-force mitigation (security audit, 2026-08-24): this app has no hosted auth
// provider to rely on (custom cookie/codeAcces login), so nothing protected login attempts at
// all before this. In-memory only — fine for this single-process app; not meant to survive a
// restart or scale across instances. Deliberately NOT a permanent lockout (never fully bans an
// account), just a growing delay + a server-side log line per failed attempt, keyed by the
// attempted société name + caller IP so one abusive source can't be used to lock out everyone.
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failedLoginAttempts = new Map<string, { count: number; firstAt: number }>();

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

async function registerFailedLogin(nom: string): Promise<void> {
  const ip = await getClientIp();
  const key = `${nom.toLowerCase()}::${ip}`;
  const now = Date.now();
  const entry = failedLoginAttempts.get(key);
  if (!entry || now - entry.firstAt > FAILED_LOGIN_WINDOW_MS) {
    failedLoginAttempts.set(key, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
  }
  const attempts = failedLoginAttempts.get(key)!.count;
  console.warn(`[AUTH] Échec de connexion (${attempts}) pour "${nom}" depuis ${ip}`);

  // Progressive delay, capped at 5s — slows down scripted brute-forcing without ever locking
  // out a legitimate user permanently.
  if (attempts >= 3) {
    const delayMs = Math.min(attempts * 700, 5000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

function clearFailedLogins(nom: string, ip: string): void {
  failedLoginAttempts.delete(`${nom.toLowerCase()}::${ip}`);
}

export async function getSociete(): Promise<string | null> {
  const jar = await cookies();
  return jar.get("societe")?.value ?? null;
}

export async function getUserId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get("userId")?.value ?? null;
}

export async function isAdminSession(): Promise<boolean> {
  const jar = await cookies();
  return jar.get("role")?.value === "admin";
}

// Espace client (2026-08-24): every non-admin société login is a CLIENT — restricted to the
// /client portal (contraventions only for this first version). Only the special ADMIN_SOCIETE
// login gets the full back-office, unchanged from before.
export async function isClientSession(): Promise<boolean> {
  const jar = await cookies();
  return jar.get("role")?.value === "client";
}

export async function requireSociete(): Promise<string> {
  const s = await getSociete();
  if (!s) redirect("/login");
  return s;
}

export async function ensureUserForSociete(societeNom: string, role: "admin" | "client" = "client") {
  const societe = await prisma.societe.upsert({
    where: { nom: societeNom },
    update: {},
    create: { nom: societeNom, codeAcces: role === "admin" ? ADMIN_CODE : "" },
  });

  const email = makeUserEmailFromSociete(societeNom);
  let user = await prisma.user.findFirst({
    where: { societeId: societe.id, email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        societeId: societe.id,
        nom: societeNom,
        prenom: role === "admin" ? "Admin" : "Compte",
        email,
        role,
        isActive: true,
      },
    });
  }

  return user;
}

export async function loginAction(fd: FormData) {
  const nom = (fd.get("nom") as string)?.trim();
  const code = (fd.get("code") as string)?.trim();
  if (!nom || !code) return;

  const jar = await cookies();
  const ip = await getClientIp();

  // Individual user login (2026-09-23): "société ou e-mail" field containing "@" is treated as an
  // individual user's own e-mail + password — additive, coexists with the legacy société+codeAcces
  // path below (never removed, never auto-migrated). See PART 7 compatibility notes.
  if (nom.includes("@")) {
    const user = await prisma.user.findUnique({ where: { email: nom }, include: { societe: true } });
    const valid = !!user && !!user.passwordHash && user.isActive && !user.societe.archivedAt && !user.societe.disabledAt && verifyPassword(code, user.passwordHash);
    if (!valid) {
      await registerFailedLogin(nom);
      redirect("/login?error=1");
    }
    clearFailedLogins(nom, ip);
    const now = new Date();
    await prisma.user.update({ where: { id: user!.id }, data: { lastLoginAt: now } });
    if (!user!.societe.activatedAt) {
      await prisma.societe.update({ where: { id: user!.societeId }, data: { activatedAt: now } });
      await prisma.societeAudit.create({ data: { societeId: user!.societeId, action: "compte_active", details: "Première connexion (compte individuel)", acteur: `${user!.prenom} ${user!.nom}` } }).catch(() => {});
    }
    await prisma.societeAudit.create({ data: { societeId: user!.societeId, action: "connexion", acteur: `${user!.prenom} ${user!.nom}` } }).catch(() => {});

    const cookieOpts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };
    jar.set("societe", user!.societe.nom, cookieOpts);
    jar.set("role", user!.role === "admin" ? "admin" : "client", cookieOpts);
    jar.set("userId", user!.id, cookieOpts);
    redirect(user!.role === "admin" ? "/" : "/client");
  }

  // Plateforme multi-entreprises (2026-09-24): n'importe quelle société marquée comme "maison"
  // d'une organisation (isOrganizationHome) peut se connecter en admin avec son propre codeAcces —
  // remplace l'ancienne comparaison hardcodée à UNE seule société/code (ADMIN_SOCIETE/ADMIN_CODE),
  // qui ne permettait qu'une seule organisation gestionnaire pour toute l'application.
  const homeSociete = await prisma.societe.findFirst({ where: { nom, isOrganizationHome: true } });
  const isAdminLogin = !!homeSociete && homeSociete.codeAcces === code;
  if (isAdminLogin) {
    clearFailedLogins(nom, ip);
    if (homeSociete!.archivedAt || homeSociete!.disabledAt) {
      await registerFailedLogin(nom);
      redirect("/login?error=1");
    }
    const user = await ensureUserForSociete(homeSociete!.nom, "admin");
    if (homeSociete!.organizationId) {
      await prisma.organizationMember.upsert({
        where: { userId: user.id },
        update: {},
        create: { organizationId: homeSociete!.organizationId, userId: user.id, orgRole: "owner" },
      });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    jar.set("societe", homeSociete!.nom, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    jar.set("role", "admin", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    jar.set("userId", user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect("/");
  }

  const societe = await prisma.societe.findUnique({ where: { nom } });
  if (!societe || societe.codeAcces !== code) {
    await registerFailedLogin(nom);
    redirect("/login?error=1");
  }
  if (societe.archivedAt || societe.disabledAt) {
    // Archived or temporarily disabled — treat like a failed login rather than leaking a
    // distinct error message to an unauthenticated caller.
    await registerFailedLogin(nom);
    redirect("/login?error=1");
  }

  clearFailedLogins(nom, ip);
  const user = await ensureUserForSociete(societe.nom, "client");

  // Clients module timestamps: track first activation + every login (fiche client "dernière connexion").
  const now = new Date();
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
  if (!societe.activatedAt) {
    await prisma.societe.update({ where: { id: societe.id }, data: { activatedAt: now } });
    await prisma.societeAudit.create({ data: { societeId: societe.id, action: "compte_active", details: "Première connexion du client", acteur: "Client" } }).catch(() => {});
  }
  await prisma.societeAudit.create({ data: { societeId: societe.id, action: "connexion", acteur: societe.nom } }).catch(() => {});

  jar.set("societe", societe.nom, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  jar.set("role", "client", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  jar.set("userId", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/client");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete("societe");
  jar.delete("role");
  jar.delete("userId");
  jar.delete("impersonatingFrom");
  redirect("/login");
}

/**
 * "Accéder à l'espace de la société" (Clients module, fiche société) — lets an admin view a
 * client's portal exactly as they see it, without knowing/resetting their code d'accès. The
 * admin's own société is stashed in `impersonatingFrom` so `stopImpersonationAction` can restore
 * it; never touches the target société's own `codeAcces`/setup token.
 */
export async function impersonateClientAction(societeId: string) {
  if (!(await isAdminSession())) redirect("/login");
  const societe = await prisma.societe.findUnique({ where: { id: societeId } });
  if (!societe) redirect("/admin/clients");

  const jar = await cookies();
  const adminSociete = jar.get("societe")?.value;
  const user = await ensureUserForSociete(societe.nom, "client");

  if (adminSociete) {
    jar.set("impersonatingFrom", adminSociete, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 2 });
  }
  jar.set("societe", societe.nom, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  jar.set("role", "client", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  jar.set("userId", user.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/client");
}

export async function stopImpersonationAction() {
  const jar = await cookies();
  const adminSociete = jar.get("impersonatingFrom")?.value;
  jar.delete("impersonatingFrom");
  if (!adminSociete) {
    redirect("/login");
  }
  const user = await ensureUserForSociete(adminSociete, "admin");
  jar.set("societe", adminSociete, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  jar.set("role", "admin", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  jar.set("userId", user.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/admin/clients");
}
