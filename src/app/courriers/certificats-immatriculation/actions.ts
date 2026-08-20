"use server";

import { prisma } from "@/lib/prisma";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { ACCEPTED_COURRIER_MIME_TYPES, normalizeImmatriculation, getImmatriculation } from "@/lib/courriers";

const LIST_PATH = "/courriers/certificats-immatriculation";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// Only allows assigning a certificat to a société that already exists — never auto-creates one.
async function resolveSociete(fd: FormData, isAdmin: boolean, fallback: string): Promise<string | null> {
  const requested = str(fd, "societe");
  const societe = isAdmin && requested ? requested : fallback;
  const exists = await prisma.societe.findUnique({ where: { nom: societe } });
  return exists ? societe : null;
}

export async function createCertificat(formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const societe = await resolveSociete(formData, isAdmin, userSociete);
  if (!societe) return;

  const immatriculationRaw = str(formData, "immatriculation");
  if (!immatriculationRaw) return;
  const immatriculation = normalizeImmatriculation(immatriculationRaw);

  const file = formData.get("fichier");
  if (!(file instanceof File) || file.size === 0) return;
  if (!ACCEPTED_COURRIER_MIME_TYPES.includes(file.type)) return;

  const fileData = Buffer.from(await file.arrayBuffer());

  await prisma.courrier.create({
    data: {
      societe,
      type: "certificat_immatriculation",
      data: { immatriculation },
      fileName: file.name,
      fileMime: file.type,
      fileSize: file.size,
      fileData,
    },
  });

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateCertificat(id: string, formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing) notFound();

  const societe = await resolveSociete(formData, isAdmin, existing.societe);
  if (!societe) return;

  const immatriculationRaw = str(formData, "immatriculation");
  const immatriculation = immatriculationRaw ? normalizeImmatriculation(immatriculationRaw) : getImmatriculation(existing.data);
  if (!immatriculation) return;

  const file = formData.get("fichier");
  let fileFields = {};
  if (file instanceof File && file.size > 0) {
    if (!ACCEPTED_COURRIER_MIME_TYPES.includes(file.type)) return;
    fileFields = {
      fileName: file.name,
      fileMime: file.type,
      fileSize: file.size,
      fileData: Buffer.from(await file.arrayBuffer()),
    };
  }

  await prisma.courrier.update({
    where: { id },
    data: {
      societe,
      data: { ...(existing.data as object), immatriculation },
      ...fileFields,
    },
  });

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function deleteCertificat(id: string) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing) notFound();

  await prisma.courrier.delete({ where: { id } });
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}
