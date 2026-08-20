"use server";

import { prisma } from "@/lib/prisma";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import {
  RETARD_PAIEMENT_STATUTS,
  getRetardPaiementData,
  resteAPayer,
  isBeneficiaireValide,
} from "@/lib/courriers";
import { creerPaiement } from "@/lib/payments/service";
import { generatePaymentQrCode } from "@/lib/payments/qrcode";

const LIST_PATH = "/courriers/retards-paiement";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function euroToCents(raw: string | null): number | null {
  if (!raw) return null;
  const n = Math.round(parseFloat(raw.replace(",", ".")) * 100);
  return isNaN(n) ? null : n;
}

export async function createRetardPaiementManuelle(formData: FormData) {
  const userSociete = await requireSociete();

  const beneficiaire = str(formData, "beneficiaire");
  if (!beneficiaire || !isBeneficiaireValide(beneficiaire)) return;

  const debiteur = str(formData, "debiteur");
  if (!debiteur) return;

  const montantDu = euroToCents(str(formData, "montantDu"));
  if (montantDu == null || montantDu <= 0) return;

  // No document is strictly required for a retard de paiement — a small internal placeholder is
  // stored only to satisfy the shared Courrier schema (fileName/fileData are NOT NULL), it is
  // never presented as an official document.
  const file = formData.get("fichier");
  const hasFile = file instanceof File && file.size > 0;
  const fileFields = hasFile
    ? { fileName: (file as File).name, fileMime: (file as File).type, fileSize: (file as File).size, fileData: Buffer.from(await (file as File).arrayBuffer()) }
    : {
        fileName: "aucun-document.txt",
        fileMime: "text/plain",
        fileSize: 0,
        fileData: Buffer.from("Aucun document joint à ce retard de paiement."),
      };

  await prisma.courrier.create({
    data: {
      societe: userSociete,
      type: "retard_paiement",
      data: {
        beneficiaire,
        debiteur,
        montantDu,
        montantPaye: 0,
        reference: str(formData, "reference"),
        dateEcheance: str(formData, "dateEcheance"),
        statutPaiement: "Non payé",
      },
      ...fileFields,
      receivedAt: new Date(),
    },
  });

  revalidatePath(LIST_PATH);
  revalidatePath("/courriers");
  redirect(LIST_PATH);
}

export async function updateRetardPaiement(id: string, formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing) notFound();
  const current = getRetardPaiementData(existing.data);

  const beneficiaire = str(formData, "beneficiaire");
  const debiteur = str(formData, "debiteur");
  const montantDu = euroToCents(str(formData, "montantDu"));
  const statutInput = str(formData, "statutPaiement");
  const statutPaiement = RETARD_PAIEMENT_STATUTS.find((s) => s === statutInput) ?? current.statutPaiement ?? "Non payé";

  await prisma.courrier.update({
    where: { id },
    data: {
      data: {
        ...current,
        beneficiaire: beneficiaire && isBeneficiaireValide(beneficiaire) ? beneficiaire : current.beneficiaire,
        debiteur: debiteur ?? current.debiteur,
        montantDu: montantDu ?? current.montantDu,
        reference: str(formData, "reference"),
        dateEcheance: str(formData, "dateEcheance"),
        statutPaiement,
      },
    },
  });

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  redirect(`${LIST_PATH}/${id}`);
}

export async function deleteRetardPaiement(id: string) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing) notFound();

  await prisma.courrier.delete({ where: { id } });
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

// Starts a card payment: creates a Paiement row + a provider checkout, then redirects the user
// there. The amount is always clamped server-side to the real reste à payer — a tampered client
// value can never authorize paying more than what is actually owed.
export async function demarrerPaiementCarte(id: string, formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing || existing.type !== "retard_paiement") notFound();

  const data = getRetardPaiementData(existing.data);
  const reste = resteAPayer(data);
  if (reste <= 0) return;

  const requested = euroToCents(str(formData, "montant")) ?? reste;
  const montant = Math.min(Math.max(requested, 1), reste);

  const { checkoutUrl } = await creerPaiement({
    societe: data.beneficiaire!,
    linkedType: "retard_paiement",
    linkedId: id,
    montant,
    mode: "carte",
    description: `Retard de paiement ${data.reference ?? id} — ${data.debiteur ?? ""}`,
    creePar: userSociete,
  });

  redirect(checkoutUrl);
}

// Generates a shareable payment link + QR code (never sent automatically — copy/paste by a human).
export async function genererLienPaiement(id: string, formData: FormData) {
  const userSociete = await requireSociete();
  const isAdmin = await isAdminSession();

  const existing = await prisma.courrier.findFirst({ where: isAdmin ? { id } : { id, societe: userSociete } });
  if (!existing || existing.type !== "retard_paiement") notFound();

  const data = getRetardPaiementData(existing.data);
  const reste = resteAPayer(data);
  if (reste <= 0) return;

  const requested = euroToCents(str(formData, "montant")) ?? reste;
  const montant = Math.min(Math.max(requested, 1), reste);

  const { paiement, checkoutUrl } = await creerPaiement({
    societe: data.beneficiaire!,
    linkedType: "retard_paiement",
    linkedId: id,
    montant,
    mode: "lien",
    description: `Retard de paiement ${data.reference ?? id} — ${data.debiteur ?? ""}`,
    creePar: userSociete,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const absoluteUrl = checkoutUrl.startsWith("http") ? checkoutUrl : `${appUrl}${checkoutUrl}`;
  const qrCode = await generatePaymentQrCode(absoluteUrl);

  revalidatePath(`${LIST_PATH}/${id}`);
  return { paiementId: paiement.id, url: absoluteUrl, qrCode };
}

// Refunds are not wired to a real provider call yet — this only records the intent/status change
// for now, gated to admins since it involves moving money back.
export async function marquerRembourseManuel(paiementId: string) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) return;

  const paiement = await prisma.paiement.findUnique({ where: { id: paiementId } });
  if (!paiement || paiement.statut !== "reussi") return;

  await prisma.paiement.update({ where: { id: paiementId }, data: { statut: "rembourse" } });
  await prisma.paiementAuditLog.create({ data: { paiementId, action: "rembourse", details: null, acteur: "admin" } });

  if (paiement.linkedType === "retard_paiement") {
    const { recalculerRetardPaiement } = await import("@/lib/payments/service");
    await recalculerRetardPaiement(paiement.linkedId);
  }

  revalidatePath(`${LIST_PATH}/${paiement.linkedId}`);
}
