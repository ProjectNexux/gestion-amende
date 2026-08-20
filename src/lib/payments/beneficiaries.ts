/**
 * Fixed list of beneficiary sociétés that can receive a payment. Deliberately not tied to the
 * multi-tenant `Societe` table — this is a payments business rule, not a login account.
 *
 * Each beneficiary can have its own payment account (its own Stripe test secret key), read from
 * environment variables only — no secret ever lives in source code.
 */
export const BENEFICIAIRES = ["CSPL", "NETECO", "Optimove Consulting"] as const;
export type Beneficiaire = (typeof BENEFICIAIRES)[number];

export function isBeneficiaireValide(value: string): value is Beneficiaire {
  return (BENEFICIAIRES as readonly string[]).includes(value);
}

function envKey(beneficiaire: string) {
  return beneficiaire.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

/** Test-mode Stripe secret key configured for this beneficiary, if any (never a live key — see stripe-provider.ts). */
export function stripeSecretKeyFor(beneficiaire: string): string | undefined {
  return process.env[`STRIPE_SECRET_KEY_${envKey(beneficiaire)}`];
}

/** Whether a beneficiary has a real (test-mode) payment account configured. False ⇒ mock/sandbox only. */
export function isStripeConfigure(beneficiaire: string): boolean {
  return !!stripeSecretKeyFor(beneficiaire);
}
