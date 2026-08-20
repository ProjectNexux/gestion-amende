import Stripe from "stripe";
import type { PaymentProvider, CreatePaymentInput, CreatePaymentResult } from "./provider";
import { stripeSecretKeyFor } from "./beneficiaries";

// Hard safety guard: this module refuses to run against anything but a Stripe TEST key
// (sk_test_...). Nothing in this codebase ever flips this — going live is an explicit,
// separate decision the user has to make later, not something a code change can trigger.
function assertTestKey(key: string) {
  if (!key.startsWith("sk_test_")) {
    throw new Error("Clé Stripe non-test détectée : le mode production n'est pas activé dans cette application.");
  }
}

function clientFor(beneficiaire: string): Stripe {
  const key = stripeSecretKeyFor(beneficiaire);
  if (!key) throw new Error(`Compte de paiement Stripe non configuré pour ${beneficiaire}`);
  assertTestKey(key);
  return new Stripe(key);
}

/**
 * Real Stripe adapter — inactive by default. It only ever gets selected for a beneficiary once a
 * STRIPE_SECRET_KEY_<BENEFICIAIRE> test-mode env var exists (see beneficiaries.ts / service.ts).
 * Card data never touches our server: Stripe Checkout is a Stripe-hosted page.
 */
export const stripeProvider: PaymentProvider = {
  name: "stripe",
  isConfigured(beneficiaire: string) {
    return !!stripeSecretKeyFor(beneficiaire);
  },
  async createCheckout(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const stripe = clientFor(input.beneficiaire);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: input.devise.toLowerCase(),
            product_data: { name: input.description },
            unit_amount: input.montant,
          },
          quantity: 1,
        },
      ],
      metadata: { paiementId: input.paiementId, beneficiaire: input.beneficiaire },
      success_url: `${appUrl}/paiement/${input.paiementId}?from=stripe`,
      cancel_url: `${appUrl}/paiement/${input.paiementId}?from=stripe`,
    });

    return { providerRef: session.id, checkoutUrl: session.url ?? `${appUrl}/paiement/${input.paiementId}` };
  },
};

/** Server-side status check against Stripe itself — never trust the browser's return URL alone. */
export async function retrieveStripeSessionStatus(beneficiaire: string, sessionId: string) {
  const stripe = clientFor(beneficiaire);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return {
    paid: session.payment_status === "paid",
    amountTotal: session.amount_total,
    paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
  };
}

/** Verifies the Stripe webhook signature — the real, trusted, server-to-server confirmation path. */
export function constructStripeWebhookEvent(beneficiaire: string, rawBody: string, signature: string) {
  const secret = process.env[`STRIPE_WEBHOOK_SECRET_${beneficiaire.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`];
  if (!secret) throw new Error(`Webhook Stripe non configuré pour ${beneficiaire}`);
  const stripe = clientFor(beneficiaire);
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
