import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { getFactureData, getImpotData, type ForwardData } from "@/lib/comptabilite";
import { fmtMoney } from "@/lib/utils";

function log(msg: string) { console.log(`[COMPTA-FORWARD] ${msg}`); }

// Centralized recipients config — change COMPTABILITE_FORWARD_EMAILS in .env to update the list
// everywhere at once (no addresses hardcoded elsewhere in the codebase).
const DEFAULT_RECIPIENTS = ["sfede@optimove.fr", "wfede@optimove.fr", "mboujelida@optimove.fr"];

const RECIPIENTS: string[] = (() => {
  const fromEnv = (process.env.COMPTABILITE_FORWARD_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_RECIPIENTS;
})();

export const COMPTABILITE_FORWARD_RECIPIENTS = RECIPIENTS;

// Subject format: "Facture – [Émetteur] – [Société]" / "Document fiscal – [Type] – [Société]" —
// shared by both the automatic pipeline and the manual "Transmettre à la comptabilité" flow, and
// exported so the confirmation modal can preview the exact e-mail before it is actually sent.
export function buildFactureEmail(d: ReturnType<typeof getFactureData>, societe: string) {
  const subject = ["Facture", d.emetteur, societe].filter(Boolean).join(" – ");
  const lines = [
    "Bonjour,",
    "",
    "Une facture est transmise à la comptabilité.",
    "",
    "Type : Facture",
    `Société concernée : ${societe}`,
  ];
  if (d.emetteur) lines.push(`Émetteur / Fournisseur : ${d.emetteur}`);
  if (d.reference) lines.push(`N° facture : ${d.reference}`);
  if (d.dateDocument) lines.push(`Date de facture : ${d.dateDocument}`);
  if (d.echeance) lines.push(`Date d'échéance : ${d.echeance}`);
  if (d.montantHT != null) lines.push(`Montant HT : ${fmtMoney(d.montantHT)}`);
  if (d.tva != null) lines.push(`TVA : ${fmtMoney(d.tva)}`);
  if (d.montant != null) lines.push(`Montant TTC : ${fmtMoney(d.montant)}${d.devise && d.devise !== "EUR" ? ` (${d.devise})` : ""}`);
  if (d.referenceCommande) lines.push(`Référence / Bon de commande : ${d.referenceCommande}`);
  if (d.commentaire) lines.push(`Commentaire : ${d.commentaire}`);
  lines.push("", "Le document original est joint à cet e-mail.", "", "Cordialement,", "ScanAppAmendes");
  return { subject, text: lines.join("\n") };
}

export function buildImpotEmail(d: ReturnType<typeof getImpotData>, societe: string) {
  const subject = ["Document fiscal", d.typeDocument, societe].filter(Boolean).join(" – ");
  const lines = [
    "Bonjour,",
    "",
    "Un document fiscal est transmis à la comptabilité.",
    "",
    `Type : ${d.typeDocument ?? "Non détecté"}`,
    `Société concernée : ${societe}`,
  ];
  if (d.organisme) lines.push(`Organisme : ${d.organisme}`);
  if (d.reference) lines.push(`Référence : ${d.reference}`);
  if (d.dateDocument) lines.push(`Date du document : ${d.dateDocument}`);
  if (d.montant != null) lines.push(`Montant : ${fmtMoney(d.montant)}`);
  if (d.echeance) lines.push(`Échéance : ${d.echeance}`);
  if (d.periodeConcernee) lines.push(`Période concernée : ${d.periodeConcernee}`);
  if (d.commentaire) lines.push(`Commentaire : ${d.commentaire}`);
  lines.push("", "Le document original est joint à cet e-mail.", "", "Cordialement,", "ScanAppAmendes");
  return { subject, text: lines.join("\n") };
}

export type ForwardOutcome = { ok: boolean; skipped?: string; error?: string };

/**
 * Sends (or re-sends) the Facture/Impôt document to the configured recipients.
 * Idempotent by default: a document whose forward.statut is already "Envoyé" is never re-sent —
 * this is what protects against duplicate sends on IMAP re-polling or a server restart. Passing
 * `force: true` (only ever done from an explicit, user-confirmed "Renvoyer" click) bypasses that
 * one guard so a deliberate manual resend still works after a document was already sent.
 */
export async function forwardComptabiliteDocument(courrierId: string, acteur: string, opts?: { force?: boolean }): Promise<ForwardOutcome> {
  const courrier = await prisma.courrier.findUnique({ where: { id: courrierId } });
  if (!courrier || (courrier.type !== "facture" && courrier.type !== "impot")) {
    return { ok: false, skipped: "Document introuvable ou type non concerné." };
  }

  const isFacture = courrier.type === "facture";
  const current = isFacture ? getFactureData(courrier.data) : getImpotData(courrier.data);
  const forward = current.forward as ForwardData | undefined;

  if (!forward) return { ok: false, skipped: "Aucune donnée de transmission sur ce document." };
  if (forward.statut === "Envoyé" && !opts?.force) {
    log(`Ignoré (déjà envoyé): ${courrierId}`);
    return { ok: true, skipped: "Déjà envoyé." };
  }
  if (forward.statut === "En cours d'envoi") {
    return { ok: false, skipped: "Envoi déjà en cours." };
  }

  const inProgress: ForwardData = {
    ...forward,
    statut: "En cours d'envoi",
    historique: [...forward.historique, { date: new Date().toISOString(), action: "envoi_declenche", details: acteur }],
  };
  await prisma.courrier.update({ where: { id: courrierId }, data: { data: { ...current, forward: inProgress } } });

  const societe = current.societeConcernee ?? courrier.societe;
  const { subject, text } = isFacture ? buildFactureEmail(current, societe) : buildImpotEmail(current, societe);

  try {
    const { messageId } = await sendMail({
      to: RECIPIENTS,
      subject,
      text,
      attachment: { filename: courrier.fileName, content: Buffer.from(courrier.fileData), contentType: courrier.fileMime },
    });

    const sent: ForwardData = {
      ...inProgress,
      statut: "Envoyé",
      destinataires: RECIPIENTS,
      envoyeAt: new Date().toISOString(),
      messageId,
      derniereErreur: null,
      historique: [...inProgress.historique, { date: new Date().toISOString(), action: "envoi_reussi", details: `${RECIPIENTS.length} destinataire(s)` }],
    };
    await prisma.courrier.update({ where: { id: courrierId }, data: { data: { ...current, forward: sent } } });
    log(`Envoyé avec succès: ${courrierId} (${courrier.type})`);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const failed: ForwardData = {
      ...inProgress,
      statut: "Erreur d'envoi",
      tentatives: inProgress.tentatives + 1,
      derniereErreur: message,
      historique: [...inProgress.historique, { date: new Date().toISOString(), action: "envoi_echec", details: message }],
    };
    await prisma.courrier.update({ where: { id: courrierId }, data: { data: { ...current, forward: failed } } });
    log(`Échec d'envoi: ${courrierId} — ${message}`);
    return { ok: false, error: message };
  }
}
