"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/auth";
import { notFound } from "next/navigation";

export async function createSocieteAction(fd: FormData) {
  if (!(await isAdminSession())) notFound();
  const nom = (fd.get("nom") as string)?.trim();
  const codeAcces = (fd.get("codeAcces") as string)?.trim();
  if (!nom || !codeAcces) return;
  await prisma.societe.create({ data: { nom, codeAcces } });
  revalidatePath("/admin/societes");
}

export async function deleteSocieteAction(id: string) {
  if (!(await isAdminSession())) notFound();
  await prisma.societe.delete({ where: { id } });
  revalidatePath("/admin/societes");
}
