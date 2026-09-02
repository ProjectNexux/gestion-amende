"use server";

import { prisma } from "@/lib/prisma";
import { requireSociete } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ACCEPTED_COURRIER_MIME_TYPES } from "@/lib/courriers";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export type EnvoyerDocumentState = { ok: boolean; error?: string };

/**
 * Espace client — the société is ALWAYS taken from the authenticated session (`requireSociete()`),
 * never from anything submitted by the browser. A client can never choose another société here.
 */
export async function envoyerDocumentAction(_prev: EnvoyerDocumentState, formData: FormData): Promise<EnvoyerDocumentState> {
  const societe = await requireSociete();

  const titre = str(formData, "titre");
  if (!titre) return { ok: false, error: "Le titre / objet est obligatoire." };

  const file = formData.get("fichier");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Merci de joindre un fichier." };
  if (!ACCEPTED_COURRIER_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: "Format non pris en charge. Utilisez PDF, JPG/JPEG ou PNG." };
  }
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: "Le fichier dépasse 15 Mo." };

  const fileData = Buffer.from(await file.arrayBuffer());

  await prisma.courrier.create({
    data: {
      societe,
      type: "client_envoi",
      source: "CLIENT",
      // A client's own submission is always visible in "Documents envoyés" — visibleClient here
      // just means "the société connected can see it", which is trivially true for their own file.
      visibleClient: true,
      data: {
        titre,
        typeDocument: str(formData, "typeDocument"),
        message: str(formData, "message"),
        reference: str(formData, "reference"),
        statut: "Nouveau",
        envoyeAt: new Date().toISOString(),
      },
      fileName: file.name,
      fileMime: file.type,
      fileSize: file.size,
      fileData,
    },
  });

  revalidatePath("/client/documents-envoyes");
  revalidatePath("/courriers/clients");
  revalidatePath("/");

  return { ok: true };
}
