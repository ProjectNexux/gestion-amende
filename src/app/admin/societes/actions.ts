"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { generateSetupToken, setupTokenExpiryDate, generatePlaceholderCodeAcces } from "@/lib/societe-setup";

export async function createSocieteAction(fd: FormData) {
  if (!(await isAdminSession())) notFound();
  const nom = (fd.get("nom") as string)?.trim();
  const codeAcces = (fd.get("codeAcces") as string)?.trim();
  if (!nom) return;

  // Self-service (2026-09-02): admin can leave "Code d'accès" blank — the client then creates
  // their own code via a one-time setup link instead of the admin choosing/knowing it.
  if (!codeAcces) {
    await prisma.societe.create({
      data: {
        nom,
        codeAcces: generatePlaceholderCodeAcces(),
        codeAccesSetupToken: generateSetupToken(),
        codeAccesSetupExpiresAt: setupTokenExpiryDate(),
      },
    });
  } else {
    await prisma.societe.create({ data: { nom, codeAcces } });
  }
  revalidatePath("/admin/societes");
}

export async function deleteSocieteAction(id: string) {
  if (!(await isAdminSession())) notFound();
  await prisma.societe.delete({ where: { id } });
  revalidatePath("/admin/societes");
}

// Lets an admin (re)generate a self-service setup link at any time — e.g. the client lost the
// link, it expired (see SETUP_TOKEN_TTL_DAYS), or the admin wants to let the client pick a new
// code themselves instead of one the admin typed in. Never reveals the current codeAcces.
export async function generateSetupLinkAction(id: string) {
  if (!(await isAdminSession())) notFound();
  await prisma.societe.update({
    where: { id },
    data: { codeAccesSetupToken: generateSetupToken(), codeAccesSetupExpiresAt: setupTokenExpiryDate() },
  });
  revalidatePath("/admin/societes");
}

