"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { requireSociete, isAdminSession } from "@/lib/auth";
import type { TransmissionClientInfo } from "@/app/courriers/actions";
import { sendTransmissionNotifications } from "@/app/courriers/actions";

function getStr(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function getNum(fd: FormData, k: string) {
  const v = getStr(fd, k);
  if (v == null) return null;
  const n = Number(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

async function nextDossierBySociete(societe: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PV-${year}-`;
  const last = await prisma.contravention.findFirst({
    where: { societe, numDossier: { startsWith: prefix } },
    orderBy: { numDossier: "desc" },
  });
  let n = 1;
  if (last) {
    const m = last.numDossier.match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(3, "0")}`;
}

async function createContraventionFromFormData(fd: FormData) {
  const societe = await requireSociete();
  let numDossier = getStr(fd, "numDossier");
  if (!numDossier) numDossier = await nextDossierBySociete(societe);

  const immat = getStr(fd, "immatriculationOcr");
  const selectedVehiculeId = getStr(fd, "vehiculeId");
  const selectedConducteurId = getStr(fd, "conducteurId");
  let vehiculeId: string | null = null;
  if (selectedVehiculeId) {
    const selectedVehicule = await prisma.vehicule.findUnique({ where: { id: selectedVehiculeId } });
    if (selectedVehicule?.societe === societe) vehiculeId = selectedVehicule.id;
  } else if (immat) {
    const v = await prisma.vehicule.findFirst({ where: { societe, immatriculation: immat } });
    if (v) vehiculeId = v.id;
  }

  let conducteurId: string | null = null;
  if (selectedConducteurId) {
    const selectedConducteur = await prisma.conducteur.findUnique({ where: { id: selectedConducteurId } });
    if (selectedConducteur?.societe === societe) conducteurId = selectedConducteur.id;
  }

  const created = await prisma.contravention.create({
    data: {
      societe,
      numDossier,
      dateReceptionAvis: getStr(fd, "dateReceptionAvis"),
      numAvis: getStr(fd, "numAvis"),
      dateInfraction: getStr(fd, "dateInfraction"),
      heureInfraction: getStr(fd, "heureInfraction"),
      natureInfraction: getStr(fd, "natureInfraction"),
      lieuInfraction: getStr(fd, "lieuInfraction"),
      vitesseConstatee: getNum(fd, "vitesseConstatee"),
      vitesseAutorisee: getNum(fd, "vitesseAutorisee"),
      montantAmende: getNum(fd, "montantAmende"),
      pointsRetires: getNum(fd, "pointsRetires"),
      dateLimitePaiement: getStr(fd, "dateLimitePaiement"),
      immatriculationOcr: immat,
      vehiculeId,
      conducteurId,
      statutDenonciation: getStr(fd, "statutDenonciation") ?? "À effectuer",
      statutPaiement: getStr(fd, "statutPaiement") ?? "En attente",
      rawOcrText: getStr(fd, "rawOcrText"),
    },
  });

  revalidatePath("/contraventions");
  revalidatePath("/");

  return created;
}

export async function createContraventionAction(fd: FormData) {
  const created = await createContraventionFromFormData(fd);
  redirect(`/contraventions/${created.id}`);
}

export async function updateContraventionAction(id: string, fd: FormData) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const existing = await prisma.contravention.findFirst({ where: isAdmin ? { id } : { id, societe } });
  if (!existing) notFound();
  const targetSociete = existing.societe;

  const immat = getStr(fd, "immatriculationOcr");
  const selectedVehiculeId = getStr(fd, "vehiculeId");
  const selectedConducteurId = getStr(fd, "conducteurId");

  let vehiculeId: string | null = null;
  if (selectedVehiculeId) {
    const selectedVehicule = await prisma.vehicule.findUnique({ where: { id: selectedVehiculeId } });
    if (selectedVehicule?.societe === targetSociete) vehiculeId = selectedVehicule.id;
  } else if (immat) {
    const v = await prisma.vehicule.findFirst({ where: { societe: targetSociete, immatriculation: immat } });
    if (v) vehiculeId = v.id;
  }

  let conducteurId: string | null = null;
  if (selectedConducteurId) {
    const selectedConducteur = await prisma.conducteur.findUnique({ where: { id: selectedConducteurId } });
    if (selectedConducteur?.societe === targetSociete) conducteurId = selectedConducteur.id;
  }

  await prisma.contravention.update({
    where: { id },
    data: {
      societe: targetSociete,
      dateReceptionAvis: getStr(fd, "dateReceptionAvis"),
      numAvis: getStr(fd, "numAvis"),
      dateInfraction: getStr(fd, "dateInfraction"),
      heureInfraction: getStr(fd, "heureInfraction"),
      natureInfraction: getStr(fd, "natureInfraction"),
      lieuInfraction: getStr(fd, "lieuInfraction"),
      vitesseConstatee: getNum(fd, "vitesseConstatee"),
      vitesseAutorisee: getNum(fd, "vitesseAutorisee"),
      montantAmende: getNum(fd, "montantAmende"),
      pointsRetires: getNum(fd, "pointsRetires"),
      dateLimitePaiement: getStr(fd, "dateLimitePaiement"),
      immatriculationOcr: immat,
      vehiculeId,
      conducteurId,
      statutDenonciation: getStr(fd, "statutDenonciation"),
      dateDenonciation: getStr(fd, "dateDenonciation"),
      modeDenonciation: getStr(fd, "modeDenonciation"),
      numDenonciationAntai: getStr(fd, "numDenonciationAntai"),
      statutPaiement: getStr(fd, "statutPaiement"),
      datePaiement: getStr(fd, "datePaiement"),
      payePar: getStr(fd, "payePar"),
      observations: getStr(fd, "observations"),
    },
  });

  revalidatePath("/contraventions");
  revalidatePath(`/contraventions/${id}`);
  revalidatePath("/");
}

export async function deleteContraventionAction(id: string) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const existing = await prisma.contravention.findFirst({ where: isAdmin ? { id } : { id, societe } });
  if (!existing) notFound();

  await prisma.contravention.delete({ where: { id } });
  revalidatePath("/contraventions");
  revalidatePath("/");
  redirect("/contraventions");
}

// Espace client (2026-08-24): admin-only control deciding whether a dossier appears in the
// client portal. Never automatic — a société never sees a contravention unless an admin
// explicitly flips this on for that exact dossier.
export async function toggleVisibleClientAction(id: string, next: boolean) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  await prisma.contravention.update({ where: { id }, data: { visibleClient: next } });
  revalidatePath("/contraventions");
  revalidatePath(`/contraventions/${id}`);
  revalidatePath("/client");
  revalidatePath("/client/contraventions");
}

// "Transmettre au client" (2026-09-23) — mirrors transmitCourrierToClientAction in
// src/app/courriers/actions.ts (same TransmissionClientInfo shape, same access-control model:
// authorization always relies on societe+visibleClient, this JSON is history/display only).
export async function transmitContraventionToClientAction(
  contraventionId: string,
  targetSociete: string,
  opts: { titre?: string; message?: string; recipientUserIds?: string[]; notifyByEmail?: boolean } = {}
) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  const societeExists = await prisma.societe.findUnique({ where: { nom: targetSociete } });
  if (!societeExists) throw new Error("Société introuvable.");

  const existing = await prisma.contravention.findUnique({ where: { id: contraventionId }, select: { transmissionClient: true, visibleClient: true, numDossier: true } });
  if (!existing) notFound();

  const existingTransmission = existing.transmissionClient as TransmissionClientInfo | null;
  const alreadySameTarget = existingTransmission?.societe === targetSociete && existing.visibleClient;
  const historique = existingTransmission?.historique ?? [];
  const titre = opts.titre ?? existingTransmission?.titre ?? existing.numDossier;

  const notifications =
    opts.notifyByEmail && opts.recipientUserIds?.length
      ? await sendTransmissionNotifications(opts.recipientUserIds, targetSociete, titre, opts.message ?? undefined)
      : [];

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

  await prisma.contravention.update({
    where: { id: contraventionId },
    data: { societe: targetSociete, visibleClient: true, transmissionClient: transmissionClient as unknown as Prisma.InputJsonValue },
  });

  revalidatePath("/contraventions");
  revalidatePath(`/contraventions/${contraventionId}`);
  revalidatePath("/client");
  revalidatePath("/client/contraventions");
}

export async function resendFailedContraventionNotificationsAction(contraventionId: string) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  const existing = await prisma.contravention.findUnique({ where: { id: contraventionId }, select: { transmissionClient: true, societe: true } });
  if (!existing) notFound();
  const existingTransmission = existing.transmissionClient as TransmissionClientInfo | null;
  if (!existingTransmission?.notifications) return;

  const failedIds = existingTransmission.notifications.filter((n) => n.status === "echec").map((n) => n.userId);
  if (failedIds.length === 0) return;

  const retried = await sendTransmissionNotifications(failedIds, existing.societe, existingTransmission.titre ?? "Contravention", existingTransmission.message ?? undefined);
  const retriedIds = new Set(retried.map((r) => r.userId));
  const notifications = [...existingTransmission.notifications.filter((n) => !retriedIds.has(n.userId)), ...retried];

  await prisma.contravention.update({
    where: { id: contraventionId },
    data: { transmissionClient: { ...existingTransmission, notifications } as unknown as Prisma.InputJsonValue },
  });
  revalidatePath("/contraventions");
  revalidatePath(`/contraventions/${contraventionId}`);
}

export async function retirerContraventionDuPortailClientAction(contraventionId: string) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  const existing = await prisma.contravention.findUnique({ where: { id: contraventionId }, select: { transmissionClient: true } });
  if (!existing) notFound();
  const existingTransmission = existing.transmissionClient as TransmissionClientInfo | null;

  await prisma.contravention.update({
    where: { id: contraventionId },
    data: {
      visibleClient: false,
      transmissionClient: existingTransmission
        ? ({
            ...existingTransmission,
            historique: [...existingTransmission.historique, { date: new Date().toISOString(), action: "Retiré du portail client" }],
          } as unknown as Prisma.InputJsonValue)
        : (existingTransmission as unknown as Prisma.InputJsonValue),
    },
  });

  revalidatePath("/contraventions");
  revalidatePath(`/contraventions/${contraventionId}`);
  revalidatePath("/client");
  revalidatePath("/client/contraventions");
}

// Actions pour statuts de dénonciation et paiement
export async function markDenonciationAction(id: string, statut: string, date?: string, numAntai?: string) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  const existing = await prisma.contravention.findUnique({ where: { id } });
  if (!existing) notFound();

  await prisma.contravention.update({
    where: { id },
    data: {
      statutDenonciation: statut,
      dateDenonciation: date || new Date().toISOString().split("T")[0],
      numDenonciationAntai: numAntai || undefined,
    },
  });

  revalidatePath("/contraventions");
  revalidatePath(`/contraventions/${id}`);
}

export async function markPaymentAction(id: string, statut: string, date?: string) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  const existing = await prisma.contravention.findUnique({ where: { id } });
  if (!existing) notFound();

  await prisma.contravention.update({
    where: { id },
    data: {
      statutPaiement: statut,
      datePaiement: date || new Date().toISOString().split("T")[0],
    },
  });

  revalidatePath("/contraventions");
  revalidatePath(`/contraventions/${id}`);
}

export async function addObservationAction(id: string, text: string) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) notFound();

  const existing = await prisma.contravention.findUnique({ where: { id } });
  if (!existing) notFound();

  const newObs = (existing.observations ? existing.observations + "\n" : "") + `[${new Date().toLocaleString("fr-FR")}] ${text}`;
  await prisma.contravention.update({
    where: { id },
    data: { observations: newObs },
  });

  revalidatePath("/contraventions");
  revalidatePath(`/contraventions/${id}`);
}

// Client actions
export async function updateConductorClientAction(id: string, fd: FormData) {
  const societe = await requireSociete();

  const c = await prisma.contravention.findFirst({
    where: { id, societe, visibleClient: true },
  });
  if (!c) notFound();

  const selectedConducteurId = getStr(fd, "conducteurId");
  let conducteurId: string | null = null;
  if (selectedConducteurId) {
    const selectedConducteur = await prisma.conducteur.findUnique({ where: { id: selectedConducteurId } });
    if (selectedConducteur?.societe === societe) {
      conducteurId = selectedConducteur.id;
    }
  }

  await prisma.contravention.update({
    where: { id },
    data: { conducteurId },
  });

  revalidatePath(`/client/contraventions/${id}`);
}

export async function clientMarkDenonciationAction(id: string) {
  const societe = await requireSociete();

  const c = await prisma.contravention.findFirst({
    where: { id, societe, visibleClient: true },
  });
  if (!c) notFound();

  await prisma.contravention.update({
    where: { id },
    data: {
      statutDenonciation: "Effectuée",
      dateDenonciation: new Date().toISOString().split("T")[0],
    },
  });

  revalidatePath(`/client/contraventions/${id}`);
}

export async function clientMarkPaymentAction(id: string) {
  const societe = await requireSociete();

  const c = await prisma.contravention.findFirst({
    where: { id, societe, visibleClient: true },
  });
  if (!c) notFound();

  await prisma.contravention.update({
    where: { id },
    data: {
      statutPaiement: "Payé",
      datePaiement: new Date().toISOString().split("T")[0],
    },
  });

  revalidatePath(`/client/contraventions/${id}`);
}
