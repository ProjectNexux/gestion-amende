"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireSociete } from "@/lib/auth";

const ACCEPTED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function normalizeMime(file: File): string {
  if (file.type === "image/jpg") return "image/jpeg";
  return file.type;
}

async function readFile(fd: FormData, key: string) {
  const raw = fd.get(key);
  if (!(raw instanceof File) || !raw.name || raw.size === 0) return null;
  const mime = normalizeMime(raw);
  if (!ACCEPTED_MIME_TYPES.has(mime)) throw new Error("Format non pris en charge. Utilisez PDF, JPG/JPEG ou PNG.");
  if (raw.size > MAX_FILE_SIZE) throw new Error("Le fichier dépasse 8 Mo.");
  return { name: raw.name, mime, data: Buffer.from(await raw.arrayBuffer()) };
}

/**
 * Permis de conduire / pièce d'identité recto-verso, uploadés directement par le client depuis la
 * fiche contravention. Toujours scopé par société (jamais par id seul) — un client ne peut jamais
 * écrire sur le conducteur d'une autre société, même en devinant son id.
 */
export async function clientUploadPermisAction(conducteurId: string, contraventionId: string, fd: FormData) {
  const societe = await requireSociete();
  const recto = await readFile(fd, "permisRecto");
  const verso = await readFile(fd, "permisVerso");

  await prisma.conducteur.updateMany({
    where: { id: conducteurId, societe },
    data: {
      ...(recto ? { permisRectoNom: recto.name, permisRectoMime: recto.mime, permisRectoData: recto.data } : {}),
      ...(verso ? { permisVersoNom: verso.name, permisVersoMime: verso.mime, permisVersoData: verso.data } : {}),
    },
  });

  revalidatePath(`/client/contraventions/${contraventionId}`);
}

export async function clientUploadCniAction(conducteurId: string, contraventionId: string, fd: FormData) {
  const societe = await requireSociete();
  const recto = await readFile(fd, "cniRecto");
  const verso = await readFile(fd, "cniVerso");

  await prisma.conducteur.updateMany({
    where: { id: conducteurId, societe },
    data: {
      ...(recto ? { cniRectoNom: recto.name, cniRectoMime: recto.mime, cniRectoData: recto.data } : {}),
      ...(verso ? { cniVersoNom: verso.name, cniVersoMime: verso.mime, cniVersoData: verso.data } : {}),
    },
  });

  revalidatePath(`/client/contraventions/${contraventionId}`);
}
