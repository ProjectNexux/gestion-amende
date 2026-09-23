"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isAdminSession, getSociete } from "@/lib/auth";
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

export type TransmissionClientInfo = {
  societe: string;
  transmisAt: string;
  transmisPar: string;
  titre?: string | null;
  message?: string | null;
  statutConsultation: "Non consulté" | "Consulté";
  historique: { date: string; action: string }[];
};

function revalidateForTransmission(id: string, societe: string) {
  revalidatePath("/courriers");
  revalidatePath("/admin/scans");
  revalidatePath("/client");
  revalidatePath("/client/courriers");
  revalidatePath(`/courriers/${id}`);
}

/**
 * "Transmettre au client" (2026-09-23) — relie un document DÉJÀ existant (jamais de copie) à la
 * société choisie : réassigne `societe`, active `visibleClient`, et note qui/quand dans `data`.
 * Empêche une double transmission accidentelle : si déjà transmis à la MÊME société, ne fait rien
 * de plus qu'actualiser la note/titre (pas de nouvelle entrée d'historique).
 */
export async function transmitCourrierToClientAction(
  courrierId: string,
  targetSociete: string,
  opts: { type?: string; titre?: string; message?: string } = {}
) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  const societeExists = await prisma.societe.findUnique({ where: { nom: targetSociete } });
  if (!societeExists) throw new Error("Société introuvable.");

  const courrier = await prisma.courrier.findUnique({ where: { id: courrierId }, select: { data: true, societe: true, visibleClient: true } });
  if (!courrier) notFound();

  const existingData = (courrier.data as Record<string, unknown>) ?? {};
  const existingTransmission = existingData.transmissionClient as TransmissionClientInfo | undefined;
  const alreadySameTarget = existingTransmission?.societe === targetSociete && courrier.visibleClient;

  const historique = existingTransmission?.historique ?? [];
  const transmissionClient: TransmissionClientInfo = {
    societe: targetSociete,
    transmisAt: new Date().toISOString(),
    transmisPar: "Admin",
    titre: opts.titre ?? existingTransmission?.titre ?? null,
    message: opts.message ?? existingTransmission?.message ?? null,
    statutConsultation: alreadySameTarget ? existingTransmission!.statutConsultation : "Non consulté",
    historique: alreadySameTarget
      ? historique
      : [...historique, { date: new Date().toISOString(), action: `Transmis à ${targetSociete}` }],
  };

  await prisma.courrier.update({
    where: { id: courrierId },
    data: {
      societe: targetSociete,
      visibleClient: true,
      ...(opts.type ? { type: opts.type } : {}),
      data: { ...existingData, transmissionClient } as Prisma.InputJsonValue,
    },
  });

  revalidateForTransmission(courrierId, targetSociete);
}

/** Retire un document du portail client sans le supprimer ni perdre l'historique de transmission. */
export async function retirerDuPortailClientAction(courrierId: string) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  const courrier = await prisma.courrier.findUnique({ where: { id: courrierId }, select: { data: true, societe: true } });
  if (!courrier) notFound();
  const existingData = (courrier.data as Record<string, unknown>) ?? {};
  const existingTransmission = existingData.transmissionClient as TransmissionClientInfo | undefined;

  await prisma.courrier.update({
    where: { id: courrierId },
    data: {
      visibleClient: false,
      data: (existingTransmission
        ? {
            ...existingData,
            transmissionClient: {
              ...existingTransmission,
              historique: [...existingTransmission.historique, { date: new Date().toISOString(), action: "Retiré du portail client" }],
            },
          }
        : existingData) as Prisma.InputJsonValue,
    },
  });

  revalidateForTransmission(courrierId, courrier.societe);
}

/** Marque le document comme consulté par le client — appelé depuis le portail client à l'ouverture. */
export async function marquerConsulteParClientAction(courrierId: string) {
  const societe = await getSociete();
  if (!societe) notFound();

  const courrier = await prisma.courrier.findUnique({ where: { id: courrierId }, select: { data: true, societe: true, visibleClient: true } });
  if (!courrier || courrier.societe !== societe || !courrier.visibleClient) notFound();

  const existingData = (courrier.data as Record<string, unknown>) ?? {};
  const existingTransmission = existingData.transmissionClient as TransmissionClientInfo | undefined;
  if (!existingTransmission || existingTransmission.statutConsultation === "Consulté") return;

  await prisma.courrier.update({
    where: { id: courrierId },
    data: { data: { ...existingData, transmissionClient: { ...existingTransmission, statutConsultation: "Consulté" } } as Prisma.InputJsonValue },
  });
}

