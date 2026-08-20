"use server";

import { prisma } from "@/lib/prisma";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getPubData } from "@/lib/courriers";

const LIST_PATH = "/courriers/pub";

// Cancels the automatic deletion: clears expiresAt, drops the "temporary" flag, keeps the document
// in Tous les courriers / Pub for manual reclassification later if needed.
export async function conserverPub(id: string) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id, type: "pub" } : { id, societe: userSociete, type: "pub" } });
  if (!existing) notFound();

  const current = getPubData(existing.data);

  await prisma.courrier.update({
    where: { id },
    data: {
      expiresAt: null,
      data: { ...current, conserve: true },
    },
  });

  revalidatePath(LIST_PATH);
  revalidatePath("/courriers");
}

// Deletes the document right away (user-confirmed), with the same minimal audit trail as the
// automatic 15-minute expiry.
export async function supprimerPubMaintenant(id: string) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id, type: "pub" } : { id, societe: userSociete, type: "pub" } });
  if (!existing) notFound();

  await prisma.courrierSuppressionLog.create({
    data: {
      courrierId: existing.id,
      societe: existing.societe,
      type: existing.type,
      fileName: existing.fileName,
      receivedAt: existing.receivedAt,
      motif: "Suppression manuelle immédiate",
    },
  });
  await prisma.courrier.delete({ where: { id } });

  revalidatePath(LIST_PATH);
  revalidatePath("/courriers");
}
