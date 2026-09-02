"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { requireSociete, isAdminSession } from "@/lib/auth";

function s(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function normalizeMime(file: File): string {
  if (file.type === "image/jpg") return "image/jpeg";
  return file.type;
}

async function readIdentityFile(fd: FormData, key: "cniRecto" | "cniVerso") {
  const raw = fd.get(key);
  if (!(raw instanceof File)) return null;
  if (!raw.name || raw.size === 0) return null;

  const mime = normalizeMime(raw);
  if (!ACCEPTED_MIME_TYPES.has(mime)) {
    throw new Error("Format non pris en charge. Utilisez PDF, JPG/JPEG ou PNG.");
  }
  if (raw.size > MAX_FILE_SIZE) {
    throw new Error("Le fichier dépasse 8 Mo.");
  }

  const buffer = await raw.arrayBuffer();
  return {
    name: raw.name,
    mime,
    data: Buffer.from(buffer),
  };
}

async function nextCode(societe: string): Promise<string> {
  const last = await prisma.conducteur.findFirst({
    where: { societe },
    orderBy: { code: "desc" },
  });
  let n = 1;
  if (last) {
    const m = last.code.match(/(\d+)/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `COND${String(n).padStart(3, "0")}`;
}

export async function createConducteur(fd: FormData) {
  const societe = await requireSociete();
  const code = s(fd, "code") ?? (await nextCode(societe));
  const nom = s(fd, "nom");
  const prenom = s(fd, "prenom");
  if (!nom || !prenom) return;

  const recto = await readIdentityFile(fd, "cniRecto");
  const verso = await readIdentityFile(fd, "cniVerso");

  await prisma.conducteur.create({
    data: {
      societe,
      code, nom, prenom,
      civilite: s(fd, "civilite"),
      telephone: s(fd, "telephone"),
      email: s(fd, "email"),
      numPermis: s(fd, "numPermis"),
      numCarteIdentite: s(fd, "numCarteIdentite"),
      dateDelivranceCni: s(fd, "dateDelivranceCni"),
      dateExpirationCni: s(fd, "dateExpirationCni"),
      cniRectoNom: recto?.name,
      cniRectoMime: recto?.mime,
      cniRectoData: recto?.data,
      cniVersoNom: verso?.name,
      cniVersoMime: verso?.mime,
      cniVersoData: verso?.data,
    },
  });
  revalidatePath("/conducteurs");
  redirect("/conducteurs");
}

export async function updateConducteur(id: string, fd: FormData) {
  const societe = await requireSociete();
  const existing = await prisma.conducteur.findFirst({ where: { id, societe } });
  if (!existing) notFound();

  const recto = await readIdentityFile(fd, "cniRecto");
  const verso = await readIdentityFile(fd, "cniVerso");

  await prisma.conducteur.update({
    where: { id },
    data: {
      civilite: s(fd, "civilite"),
      nom: s(fd, "nom") ?? existing.nom,
      prenom: s(fd, "prenom") ?? existing.prenom,
      telephone: s(fd, "telephone"),
      email: s(fd, "email"),
      numPermis: s(fd, "numPermis"),
      numCarteIdentite: s(fd, "numCarteIdentite"),
      dateDelivranceCni: s(fd, "dateDelivranceCni"),
      dateExpirationCni: s(fd, "dateExpirationCni"),
      ...(recto
        ? {
            cniRectoNom: recto.name,
            cniRectoMime: recto.mime,
            cniRectoData: recto.data,
          }
        : {}),
      ...(verso
        ? {
            cniVersoNom: verso.name,
            cniVersoMime: verso.mime,
            cniVersoData: verso.data,
          }
        : {}),
    },
  });

  revalidatePath("/conducteurs");
  revalidatePath(`/conducteurs/${id}`);
  redirect(`/conducteurs/${id}`);
}

export async function deleteConducteur(id: string) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const existing = await prisma.conducteur.findFirst({ where: isAdmin ? { id } : { id, societe } });
  if (!existing) notFound();
  await prisma.conducteur.delete({ where: { id } });
  revalidatePath("/conducteurs");
}
