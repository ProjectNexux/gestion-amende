"use server";

import { prisma } from "@/lib/prisma";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { CLIENT_ENVOI_STATUTS, getClientEnvoiData } from "@/lib/courriers";

const LIST_PATH = "/courriers/clients";

export async function updateClientEnvoiStatutAction(id: string, statut: string) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id, source: "CLIENT" } : { id, societe, source: "CLIENT" } });
  if (!existing) notFound();
  if (!CLIENT_ENVOI_STATUTS.includes(statut as (typeof CLIENT_ENVOI_STATUTS)[number])) return;

  const current = getClientEnvoiData(existing.data);
  await prisma.courrier.update({ where: { id }, data: { data: { ...current, statut } } });

  revalidatePath(LIST_PATH);
}
