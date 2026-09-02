"use server";

import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

// Espace client (2026-08-24): mirrors contraventions/actions.ts's toggleVisibleClientAction —
// admin-only, never automatic. A société never sees a courrier unless an admin explicitly
// flips this on for that exact document.
export async function toggleCourrierVisibleClientAction(id: string, next: boolean) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  await prisma.courrier.update({ where: { id }, data: { visibleClient: next } });
  revalidatePath("/courriers");
  revalidatePath("/client");
  revalidatePath("/client/courriers");
}
