"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isAdminSession, getSociete } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { sendDocumentTransmissionEmail } from "@/lib/user-invitation-email";

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

export type NotificationInfo = {
  userId: string;
  email: string;
  prenom: string;
  nom: string;
  status: "envoye" | "echec";
  sentAt: string;
};

export type TransmissionClientInfo = {
  societe: string;
  transmisAt: string;
  transmisPar: string;
  titre?: string | null;
  message?: string | null;
  statutConsultation: "Non consulté" | "Consulté";
  historique: { date: string; action: string }[];
  notifications?: NotificationInfo[];
};

/**
 * Sends one individual notification e-mail per selected recipient (never a single e-mail with
 * multiple `to` addresses — recipients must never see each other's addresses). A send failure
 * for one recipient never blocks the others or the portal transmission itself (PART 5).
 */
export async function sendTransmissionNotifications(
  recipientUserIds: string[],
  societeName: string,
  titre: string,
  message: string | undefined
): Promise<NotificationInfo[]> {
  if (recipientUserIds.length === 0) return [];
  const users = await prisma.user.findMany({ where: { id: { in: recipientUserIds }, email: { not: null } } });

  const results: NotificationInfo[] = [];
  for (const u of users) {
    const sentAt = new Date().toISOString();
    try {
      await sendDocumentTransmissionEmail({ to: u.email!, prenom: u.prenom, societeName, titre, message });
      results.push({ userId: u.id, email: u.email!, prenom: u.prenom, nom: u.nom, status: "envoye", sentAt });
    } catch {
      // Never logs the recipient's content, only that the send failed — surfaced in the UI so
      // the admin can "Renvoyer" (never a silent failure).
      results.push({ userId: u.id, email: u.email!, prenom: u.prenom, nom: u.nom, status: "echec", sentAt });
    }
  }
  return results;
}

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
 *
 * `recipientUserIds`/`notifyByEmail` (PART 5): notifications are purely additive/informational —
 * access control is ALWAYS decided by `societe`+`visibleClient` above, never by who was notified.
 * A notification failure never cancels or rolls back the portal transmission.
 */
export async function transmitCourrierToClientAction(
  courrierId: string,
  targetSociete: string,
  opts: { type?: string; titre?: string; message?: string; recipientUserIds?: string[]; notifyByEmail?: boolean } = {}
) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  const societeExists = await prisma.societe.findUnique({ where: { nom: targetSociete } });
  if (!societeExists) throw new Error("Société introuvable.");

  const courrier = await prisma.courrier.findUnique({ where: { id: courrierId }, select: { data: true, societe: true, visibleClient: true, fileName: true } });
  if (!courrier) notFound();

  const existingData = (courrier.data as Record<string, unknown>) ?? {};
  const existingTransmission = existingData.transmissionClient as TransmissionClientInfo | undefined;
  const alreadySameTarget = existingTransmission?.societe === targetSociete && courrier.visibleClient;
  const titre = opts.titre ?? existingTransmission?.titre ?? courrier.fileName;

  const notifications =
    opts.notifyByEmail && opts.recipientUserIds?.length
      ? await sendTransmissionNotifications(opts.recipientUserIds, targetSociete, titre, opts.message ?? undefined)
      : [];

  const historique = existingTransmission?.historique ?? [];
  const transmissionClient: TransmissionClientInfo = {
    societe: targetSociete,
    transmisAt: new Date().toISOString(),
    transmisPar: "Admin",
    titre,
    message: opts.message ?? existingTransmission?.message ?? null,
    statutConsultation: alreadySameTarget ? existingTransmission!.statutConsultation : "Non consulté",
    historique: alreadySameTarget
      ? historique
      : [...historique, { date: new Date().toISOString(), action: `Transmis à ${targetSociete}` }],
    notifications: notifications.length > 0 ? notifications : existingTransmission?.notifications,
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

/** Re-sends the notification only to recipients whose last attempt failed — never re-sends to
 * ones that already succeeded, never touches the portal transmission itself. */
export async function resendFailedCourrierNotificationsAction(courrierId: string) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  const courrier = await prisma.courrier.findUnique({ where: { id: courrierId }, select: { data: true, societe: true } });
  if (!courrier) notFound();
  const existingData = (courrier.data as Record<string, unknown>) ?? {};
  const existingTransmission = existingData.transmissionClient as TransmissionClientInfo | undefined;
  if (!existingTransmission?.notifications) return;

  const failedIds = existingTransmission.notifications.filter((n) => n.status === "echec").map((n) => n.userId);
  if (failedIds.length === 0) return;

  const retried = await sendTransmissionNotifications(failedIds, courrier.societe, existingTransmission.titre ?? "Document", existingTransmission.message ?? undefined);
  const retriedIds = new Set(retried.map((r) => r.userId));
  const notifications = [...existingTransmission.notifications.filter((n) => !retriedIds.has(n.userId)), ...retried];

  await prisma.courrier.update({
    where: { id: courrierId },
    data: { data: { ...existingData, transmissionClient: { ...existingTransmission, notifications } } as Prisma.InputJsonValue },
  });
  revalidateForTransmission(courrierId, courrier.societe);
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

