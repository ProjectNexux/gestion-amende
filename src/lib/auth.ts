"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const ADMIN_SOCIETE = process.env.ADMIN_SOCIETE ?? "Mon espace";
const ADMIN_CODE = process.env.ADMIN_CODE ?? "admin123";

function makeUserEmailFromSociete(nom: string) {
  return `${nom.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-local@gestion-amendes.local`;
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

export async function requireSociete(): Promise<string> {
  const s = await getSociete();
  if (!s) redirect("/login");
  return s;
}

export async function ensureUserForSociete(societeNom: string, role: "admin" | "member" = "member") {
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

  const isAdminLogin = nom === ADMIN_SOCIETE && code === ADMIN_CODE;
  if (isAdminLogin) {
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
    redirect("/login?error=1");
  }

  const user = await ensureUserForSociete(societe.nom, "member");
  jar.set("societe", societe.nom, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  jar.set("role", "member", {
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

export async function logoutAction() {
  const jar = await cookies();
  jar.delete("societe");
  jar.delete("role");
  jar.delete("userId");
  redirect("/login");
}
