"use server";

import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const ADMIN_SOCIETE = process.env.ADMIN_SOCIETE ?? "Mon espace";
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

  const isAdminLogin = nom === ADMIN_SOCIETE && code === ADMIN_CODE;
  if (isAdminLogin) {
    clearFailedLogins(nom, ip);
    const user = await ensureUserForSociete(ADMIN_SOCIETE, "admin");
    jar.set("societe", ADMIN_SOCIETE, {
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
  if (societe.archivedAt) {
    // Archived (désactivé) — treat like a failed login rather than leaking a distinct error.
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
  redirect("/login");
}
