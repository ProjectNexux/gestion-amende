import { NextRequest, NextResponse } from "next/server";
import { constructStripeWebhookEvent } from "@/lib/payments/stripe-provider";
import { confirmerPaiement } from "@/lib/payments/service";
import type Stripe from "stripe";

// Real, signature-verified server-to-server confirmation path (never trusts the browser). Inert
// until a beneficiary has STRIPE_SECRET_KEY_<BENEFICIAIRE> and STRIPE_WEBHOOK_SECRET_<BENEFICIAIRE>
// configured — see src/lib/payments/stripe-provider.ts.
export async function POST(request: NextRequest, { params }: { params: Promise<{ beneficiaire: string }> }) {
  const { beneficiaire } = await params;
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(decodeURIComponent(beneficiaire), rawBody, signature);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Signature invalide" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paiementId = session.metadata?.paiementId;
    if (paiementId && session.payment_status === "paid") {
      await confirmerPaiement(paiementId, "reussi", { acteur: "stripe-webhook" });
    }
  } else if (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paiementId = session.metadata?.paiementId;
    if (paiementId) {
      await confirmerPaiement(paiementId, "echec", { acteur: "stripe-webhook" });
    }
  }

  return NextResponse.json({ received: true });
}
