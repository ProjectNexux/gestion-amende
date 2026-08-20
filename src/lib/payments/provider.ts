/**
 * Generic payment provider abstraction, so the rest of the app (retards de paiement today, other
 * features later — see service.ts) never talks to a specific vendor SDK directly. Swapping the
 * active provider for a beneficiary is a config concern (see beneficiaries.ts), not a code change.
 */

export type PaymentOutcome = "reussi" | "echec" | "abandonne";

export type CreatePaymentInput = {
  paiementId: string; // our own Paiement.id — passed as metadata for reconciliation
  beneficiaire: string;
  montant: number; // cents
  devise: string;
  description: string;
};

export type CreatePaymentResult = {
  providerRef: string;
  checkoutUrl: string;
};

export interface PaymentProvider {
  readonly name: string;
  isConfigured(beneficiaire: string): boolean;
  createCheckout(input: CreatePaymentInput): Promise<CreatePaymentResult>;
}
