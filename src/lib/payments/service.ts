import { prisma } from "@/lib/prisma";
import { getRetardPaiementData, resteAPayer } from "@/lib/courriers";
import { mockProvider } from "./mock-provider";
import { stripeProvider } from "./stripe-provider";
import { isStripeConfigure } from "./beneficiaries";
import type { PaymentOutcome, PaymentProvider } from "./provider";

function log(msg: string) { console.log(`[PAYMENTS] ${msg}`); }

/** Picks the real provider once a beneficiary has a test-mode Stripe key configured, mock otherwise. */
export function resolveProvider(beneficiaire: string): PaymentProvider {
  return isStripeConfigure(beneficiaire) ? stripeProvider : mockProvider;
}

async function logAudit(paiementId: string, action: string, details: string | null, acteur: string | null) {
  await prisma.paiementAuditLog.create({ data: { paiementId, action, details, acteur } });
}

/**
 * Generic entry point: creates a Paiement row + a provider checkout for it. Reusable for any
 * `linkedType` (retard_paiement today, other features later) — this module has no idea what a
 * "retard de paiement" is beyond its id.
 */
export async function creerPaiement(opts: {
  societe: string; // beneficiary
  linkedType: string;
  linkedId: string;
  montant: number; // cents
  mode: "carte" | "lien" | "qrcode";
  description: string;
  creePar: string;
}) {
  if (opts.montant <= 0) throw new Error("Montant invalide");

  const provider = resolveProvider(opts.societe);

  const paiement = await prisma.paiement.create({
    data: {
      societe: opts.societe,
      linkedType: opts.linkedType,
      linkedId: opts.linkedId,
      montant: opts.montant,
      devise: "EUR",
      mode: opts.mode,
      statut: "en_attente",
      provider: provider.name,
      creePar: opts.creePar,
    },
  });
  await logAudit(paiement.id, "cree", `montant=${opts.montant} mode=${opts.mode} beneficiaire=${opts.societe}`, opts.creePar);

  const checkout = await provider.createCheckout({
    paiementId: paiement.id,
    beneficiaire: opts.societe,
    montant: opts.montant,
    devise: "EUR",
    description: opts.description,
  });

  await prisma.paiement.update({ where: { id: paiement.id }, data: { providerRef: checkout.providerRef } });
  if (opts.mode === "lien" || opts.mode === "qrcode") {
    await logAudit(paiement.id, "lien_genere", null, opts.creePar);
  }

  return { paiement, checkoutUrl: checkout.checkoutUrl };
}

/**
 * Applies a confirmed outcome to a Paiement — idempotent so a duplicate confirmation (double
 * webhook delivery, a stray retry, ...) can never be counted twice.
 */
export async function confirmerPaiement(paiementId: string, outcome: PaymentOutcome, opts?: { cardLast4?: string; recuUrl?: string; acteur?: string }) {
  const paiement = await prisma.paiement.findUnique({ where: { id: paiementId } });
  if (!paiement) throw new Error("Paiement introuvable");

  // Already finalized — ignore silently instead of re-applying (dedup / double-confirmation guard).
  if (paiement.statut === "reussi" || paiement.statut === "echec" || paiement.statut === "abandonne" || paiement.statut === "rembourse") {
    log(`Confirmation ignorée (déjà finalisé: ${paiement.statut}): ${paiementId}`);
    return paiement;
  }

  const statut: string = outcome;
  const updated = await prisma.paiement.update({
    where: { id: paiementId },
    data: { statut, cardLast4: opts?.cardLast4 ?? null, recuUrl: opts?.recuUrl ?? null },
  });
  await logAudit(paiementId, statut === "reussi" ? "confirme" : "echoue", null, opts?.acteur ?? null);

  if (statut === "reussi" && paiement.linkedType === "retard_paiement") {
    await recalculerRetardPaiement(paiement.linkedId);
  }

  return updated;
}

/** Recomputes montantPaye/statutPaiement for a "retard_paiement" Courrier from its successful Paiement rows only. */
export async function recalculerRetardPaiement(courrierId: string) {
  const courrier = await prisma.courrier.findUnique({ where: { id: courrierId } });
  if (!courrier || courrier.type !== "retard_paiement") return;

  const data = getRetardPaiementData(courrier.data);
  const paiementsReussis = await prisma.paiement.findMany({
    where: { linkedType: "retard_paiement", linkedId: courrierId, statut: "reussi" },
  });
  const montantPaye = paiementsReussis.reduce((sum, p) => sum + p.montant, 0);
  const reste = resteAPayer({ ...data, montantPaye });
  const statutPaiement = reste <= 0 ? "Payé" : montantPaye > 0 ? "Partiellement payé" : (data.statutPaiement ?? "Non payé");

  await prisma.courrier.update({
    where: { id: courrierId },
    data: { data: { ...data, montantPaye, statutPaiement } },
  });
}
