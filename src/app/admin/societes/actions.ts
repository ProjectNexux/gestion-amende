"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createSocieteAction(fd: FormData) {
  const nom = (fd.get("nom") as string)?.trim();
  const codeAcces = (fd.get("codeAcces") as string)?.trim();
  if (!nom || !codeAcces) return;
  await prisma.societe.create({ data: { nom, codeAcces } });
  revalidatePath("/admin/societes");
}

export async function deleteSocieteAction(id: string) {
  await prisma.societe.delete({ where: { id } });
  revalidatePath("/admin/societes");
}
