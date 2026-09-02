"use server";

import { prisma } from "@/lib/prisma";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { forwardComptabiliteDocument } from "@/lib/comptabilite-forward";
import { buildInitialForward, getImpotData } from "@/lib/comptabilite";
import { ACCEPTED_COURRIER_MIME_TYPES } from "@/lib/courriers";

const LIST_PATH = "/comptabilite/impots";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function num(fd: FormData, key: string): number | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

function frDate(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

async function resolveSociete(fd: FormData, isAdmin: boolean, fallback: string): Promise<string | null> {
  const requested = str(fd, "societe");
  const societe = isAdmin && requested ? requested : fallback;
  const exists = await prisma.societe.findUnique({ where: { nom: societe } });
  return exists ? societe : null;
}

export async function createImpotManuelle(formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const societe = await resolveSociete(formData, isAdmin, userSociete);
  if (!societe) return;

  const montant = num(formData, "montant");
  if (montant == null) return;

  const file = formData.get("fichier");
  if (!(file instanceof File) || file.size === 0) return;
  if (!ACCEPTED_COURRIER_MIME_TYPES.includes(file.type)) return;
  const fileData = Buffer.from(await file.arrayBuffer());

  const courrier = await prisma.courrier.create({
    data: {
      societe,
      type: "impot",
      data: {
        organisme: str(formData, "organisme"),
        typeDocument: str(formData, "typeDocument"),
        reference: str(formData, "reference"),
        dateDocument: frDate(formData, "dateDocument"),
        echeance: frDate(formData, "echeance"),
        montant,
        periodeConcernee: str(formData, "periodeConcernee"),
        commentaire: str(formData, "commentaire"),
        societeConcernee: societe,
        statutClassification: "Nouveau",
        origine: "manuel",
        forward: buildInitialForward("Non transmis", "document_cree_manuellement"),
      },
      fileName: file.name,
      fileMime: file.type,
      fileSize: file.size,
      fileData,
    },
  });

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}/${courrier.id}`);
}

export async function updateImpotManuelle(id: string, formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();
  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id, type: "impot" } : { id, societe: userSociete, type: "impot" } });
  if (!existing) notFound();

  const societe = await resolveSociete(formData, isAdmin, existing.societe);
  if (!societe) return;

  const montant = num(formData, "montant");
  if (montant == null) return;

  const file = formData.get("fichier");
  let fileFields = {};
  if (file instanceof File && file.size > 0) {
    if (!ACCEPTED_COURRIER_MIME_TYPES.includes(file.type)) return;
    fileFields = { fileName: file.name, fileMime: file.type, fileSize: file.size, fileData: Buffer.from(await file.arrayBuffer()) };
  }

  const current = getImpotData(existing.data);

  await prisma.courrier.update({
    where: { id },
    data: {
      societe,
      data: {
        ...current,
        organisme: str(formData, "organisme"),
        typeDocument: str(formData, "typeDocument"),
        reference: str(formData, "reference"),
        dateDocument: frDate(formData, "dateDocument"),
        echeance: frDate(formData, "echeance"),
        montant,
        periodeConcernee: str(formData, "periodeConcernee"),
        commentaire: str(formData, "commentaire"),
        societeConcernee: societe,
      },
      ...fileFields,
    },
  });

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  redirect(`${LIST_PATH}/${id}`);
}

export async function resendImpot(id: string, force: boolean = false) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id, type: "impot" } : { id, societe, type: "impot" } });
  if (!existing) notFound();

  await forwardComptabiliteDocument(id, societe, { force });

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  redirect(`${LIST_PATH}/${id}`);
}

export async function deleteImpot(id: string) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id, type: "impot" } : { id, societe, type: "impot" } });
  if (!existing) notFound();

  await prisma.courrier.delete({ where: { id } });
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}
