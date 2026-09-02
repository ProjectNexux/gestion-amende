"use server";

import { prisma } from "@/lib/prisma";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { SINISTRE_STATUTS } from "@/lib/sinistres";

const LIST_PATH = "/courriers/sinistres";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function num(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (!raw) return null;
  const n = parseFloat(raw.replace(",", "."));
  return isNaN(n) ? null : n;
}

async function logHistorique(sinistreId: string, action: string, details: string | null, acteur: string | null) {
  await prisma.sinistreHistorique.create({ data: { sinistreId, action, details, acteur } });
}

async function nextReference(societe: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SIN-${year}-`;
  const last = await prisma.sinistre.findFirst({
    where: { societe, reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
  });
  let n = 1;
  if (last) {
    const m = last.reference.match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(4, "0")}`;
}

async function attachFiles(sinistreId: string, societe: string, formData: FormData, acteur: string) {
  const files = formData.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    await prisma.courrier.create({
      data: {
        societe,
        type: "sinistre",
        sinistreId,
        data: {},
        fileName: file.name,
        fileMime: file.type || "application/octet-stream",
        fileSize: file.size,
        fileData: Buffer.from(await file.arrayBuffer()),
      },
    });
  }
  if (files.length > 0) {
    await logHistorique(sinistreId, "piece_jointe_ajoutee", `${files.length} document(s) ajouté(s)`, acteur);
  }
}

export async function createSinistre(formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const societeInput = str(formData, "societe");
  const societe = isAdmin && societeInput ? societeInput : userSociete;

  const statutInput = str(formData, "statut");
  const statut = SINISTRE_STATUTS.find((s) => s === statutInput) ?? "Nouveau";

  const reference = await nextReference(societe);

  const sinistre = await prisma.sinistre.create({
    data: {
      reference,
      societe,
      statut,
      origine: "manuel",
      typeSinistre: str(formData, "typeSinistre"),
      dateSinistre: str(formData, "dateSinistre"),
      lieuSinistre: str(formData, "lieuSinistre"),
      vehiculeId: str(formData, "vehiculeId"),
      conducteurId: str(formData, "conducteurId"),
      assureur: str(formData, "assureur"),
      referenceAssureur: str(formData, "referenceAssureur"),
      numeroContrat: str(formData, "numeroContrat"),
      description: str(formData, "description"),
      montantDommage: num(formData, "montantDommage"),
      montantReclame: num(formData, "montantReclame"),
      montantPropose: num(formData, "montantPropose"),
      dateLimiteReponse: str(formData, "dateLimiteReponse"),
    },
  });

  await logHistorique(sinistre.id, "creation_manuelle", `Dossier ${reference} créé manuellement`, userSociete);
  await attachFiles(sinistre.id, societe, formData, userSociete);

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateSinistre(id: string, formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.sinistre.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing) notFound();

  const statutInput = str(formData, "statut");
  const statut = SINISTRE_STATUTS.find((s) => s === statutInput) ?? existing.statut;

  await prisma.sinistre.update({
    where: { id },
    data: {
      typeSinistre: str(formData, "typeSinistre"),
      dateSinistre: str(formData, "dateSinistre"),
      lieuSinistre: str(formData, "lieuSinistre"),
      vehiculeId: str(formData, "vehiculeId"),
      conducteurId: str(formData, "conducteurId"),
      assureur: str(formData, "assureur"),
      referenceAssureur: str(formData, "referenceAssureur"),
      numeroContrat: str(formData, "numeroContrat"),
      description: str(formData, "description"),
      montantDommage: num(formData, "montantDommage"),
      montantReclame: num(formData, "montantReclame"),
      montantPropose: num(formData, "montantPropose"),
      dateLimiteReponse: str(formData, "dateLimiteReponse"),
      statut,
    },
  });

  if (statut !== existing.statut) {
    await logHistorique(id, "changement_statut", `${existing.statut} → ${statut}`, userSociete);
  }
  await logHistorique(id, "correction_manuelle", "Informations corrigées manuellement", userSociete);
  await attachFiles(id, existing.societe, formData, userSociete);

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  redirect(`${LIST_PATH}/${id}`);
}

export async function deleteSinistre(id: string) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.sinistre.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing) notFound();

  // Delete the dossier's own documents first (historique cascades via onDelete: Cascade).
  await prisma.courrier.deleteMany({ where: { sinistreId: id } });
  await prisma.sinistre.delete({ where: { id } });

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function addSinistreDocument(id: string, formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.sinistre.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing) notFound();

  await attachFiles(id, existing.societe, formData, userSociete);

  revalidatePath(`${LIST_PATH}/${id}`);
  redirect(`${LIST_PATH}/${id}`);
}
