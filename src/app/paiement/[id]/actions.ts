"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { confirmerPaiement } from "@/lib/payments/service";
import { retrieveStripeSessionStatus } from "@/lib/payments/stripe-provider";
import type { PaymentOutcome } from "@/lib/payments/provider";

// Test/sandbox only: lets a tester pick the simulated outcome instead of guessing magic amounts.
// No card data is ever involved — this exists purely to exercise the accepted/declined/error paths.
export async function simulerPaiement(paiementId: string, outcome: PaymentOutcome) {
  const paiement = await prisma.paiement.findUnique({ where: { id: paiementId } });
  if (!paiement || paiement.provider !== "mock") return;

  await confirmerPaiement(paiementId, outcome, { acteur: "simulation" });
  revalidatePath(`/paiement/${paiementId}`);
  if (paiement.linkedType === "retard_paiement") {
    revalidatePath(`/courriers/retards-paiement/${paiement.linkedId}`);
  }
}

// Real path: never trust the browser landing back on a "success" URL — ask Stripe itself.
// (The webhook route is the primary confirmation path; this is a manual fallback for local dev.)
export async function verifierStatutStripe(paiementId: string) {
  const paiement = await prisma.paiement.findUnique({ where: { id: paiementId } });
  if (!paiement || paiement.provider !== "stripe" || !paiement.providerRef) return;

  const status = await retrieveStripeSessionStatus(paiement.societe, paiement.providerRef);
  if (status.paid) {
    await confirmerPaiement(paiementId, "reussi", { acteur: "stripe-check" });
  }
  revalidatePath(`/paiement/${paiementId}`);
  if (paiement.linkedType === "retard_paiement") {
    revalidatePath(`/courriers/retards-paiement/${paiement.linkedId}`);
  }
}
