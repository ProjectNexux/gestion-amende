"use server";

import { prisma } from "@/lib/prisma";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { ACCEPTED_COURRIER_MIME_TYPES, MISE_EN_DEMEURE_STATUTS, getMiseEnDemeureData } from "@/lib/courriers";
import type { SensMiseEnDemeure } from "@/lib/mise-en-demeure-parser";
import { detectOrganisme, buildTransmission } from "@/lib/transmission";

const LIST_PATH = "/courriers/mise-en-demeure";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// Only allows assigning a mise en demeure to a société that already exists — never auto-creates one.
async function resolveSociete(fd: FormData, isAdmin: boolean, fallback: string): Promise<string | null> {
  const requested = str(fd, "societeConcernee");
  const societe = isAdmin && requested ? requested : fallback;
  const exists = await prisma.societe.findUnique({ where: { nom: societe } });
  return exists ? societe : null;
}

export async function createMiseEnDemeureManuelle(formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const societe = await resolveSociete(formData, isAdmin, userSociete);
  if (!societe) return;

  const sensInput = str(formData, "sens");
  const sens: SensMiseEnDemeure = sensInput === "envoyee" ? "envoyee" : "recue";

  const statutInput = str(formData, "statut");
  const statut = MISE_EN_DEMEURE_STATUTS.find((s) => s === statutInput) ?? "Nouveau";

  const montantRaw = str(formData, "montant");
  const montant = montantRaw ? parseFloat(montantRaw.replace(",", ".")) : null;

  const file = formData.get("fichier");
  if (!(file instanceof File) || file.size === 0) return;
  if (!ACCEPTED_COURRIER_MIME_TYPES.includes(file.type)) return;
  const fileData = Buffer.from(await file.arrayBuffer());

  const dateReceptionRaw = str(formData, "dateReception");
  const receivedAt = dateReceptionRaw ? new Date(dateReceptionRaw) : new Date();

  const expediteur = str(formData, "expediteur");
  const organisme = detectOrganisme(expediteur, str(formData, "motif"));
  const transmission = buildTransmission({
    organisme,
    societeConcernee: societe,
    societeConnue: true,
    identificationConfidence: 1, // manually entered by a human
    acteur: userSociete,
    actionLabel: "Ajout manuel",
  });

  await prisma.courrier.create({
    data: {
      societe,
      type: "mise_en_demeure",
      data: {
        expediteur,
        destinataire: str(formData, "destinataire"),
        sens,
        societeConcernee: societe,
        motif: str(formData, "motif"),
        motifBrut: null,
        dateDocument: str(formData, "dateDocument"),
        echeance: str(formData, "echeance"),
        echeanceTexte: null,
        montant: montant != null && !isNaN(montant) ? montant : null,
        montantIncertain: false,
        reference: str(formData, "reference"),
        confiance: { expediteur: 1, destinataire: 1, date: 1, motif: 1, montant: 1, echeance: 1, sens: 1 },
        statut,
        origine: "manuel",
        transmission,
      },
      fileName: file.name,
      fileMime: file.type,
      fileSize: file.size,
      fileData,
      receivedAt,
    },
  });

  revalidatePath(LIST_PATH);
  revalidatePath("/courriers");
  redirect(LIST_PATH);
}

export async function updateMiseEnDemeure(id: string, formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing) notFound();

  const current = getMiseEnDemeureData(existing.data);

  const sensInput = str(formData, "sens");
  const sens: SensMiseEnDemeure = sensInput === "recue" || sensInput === "envoyee" ? sensInput : "a_verifier";

  const statutInput = str(formData, "statut");
  const statut = MISE_EN_DEMEURE_STATUTS.find((s) => s === statutInput) ?? current.statut ?? "Nouveau";

  const montantRaw = str(formData, "montant");
  const montant = montantRaw ? parseFloat(montantRaw.replace(",", ".")) : null;

  const expediteur = str(formData, "expediteur");
  const societeConcernee = str(formData, "societeConcernee");
  const societeConnue = societeConcernee ? !!(await prisma.societe.findUnique({ where: { nom: societeConcernee } })) : false;
  const organisme = detectOrganisme(expediteur, str(formData, "motif")) ?? current.transmission?.organisme ?? null;
  const transmission = buildTransmission({
    organisme,
    societeConcernee,
    societeConnue,
    identificationConfidence: 1, // manually corrected by a human
    acteur: userSociete,
    actionLabel: "Corrig\u00e9 manuellement",
    previousHistorique: current.transmission?.historique,
  });

  await prisma.courrier.update({
    where: { id },
    data: {
      data: {
        ...current,
        expediteur,
        destinataire: str(formData, "destinataire"),
        sens,
        societeConcernee,
        motif: str(formData, "motif"),
        dateDocument: str(formData, "dateDocument"),
        echeance: str(formData, "echeance"),
        montant: montant != null && !isNaN(montant) ? montant : null,
        montantIncertain: montant == null,
        reference: str(formData, "reference"),
        statut,
        transmission,
      },
    },
  });

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  redirect(`${LIST_PATH}/${id}`);
}

export async function deleteMiseEnDemeure(id: string) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing) notFound();

  await prisma.courrier.delete({ where: { id } });
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

// Only sets/replaces the société's transmission e-mail when a non-empty value is submitted —
// never silently clears or auto-generates one.
export async function updateSocieteEmailTransmission(societeNom: string, formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();
  if (!isAdmin && societeNom !== userSociete) notFound();

  const email = str(formData, "emailTransmission");
  if (!email) return;

  await prisma.societe.update({ where: { nom: societeNom }, data: { emailTransmission: email } });
  revalidatePath(LIST_PATH);
}

// Records that a transmission preview was generated and reviewed. Purely an audit/historique
// entry — it never sends anything (see AUTO_FORWARD_URSSAF in lib/transmission.ts).
export async function preparerEnvoi(id: string) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing) notFound();

  const current = getMiseEnDemeureData(existing.data);
  if (!current.transmission) return;

  await prisma.courrier.update({
    where: { id },
    data: {
      data: {
        ...current,
        transmission: {
          ...current.transmission,
          historique: [
            ...current.transmission.historique,
            { date: new Date().toISOString(), action: "Aper\u00e7u de transmission g\u00e9n\u00e9r\u00e9 (envoi automatique d\u00e9sactiv\u00e9)", acteur: userSociete },
          ],
        },
      },
    },
  });

  redirect(`${LIST_PATH}/${id}?apercu=1`);
}
