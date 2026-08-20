import type { PaymentProvider, CreatePaymentInput, CreatePaymentResult } from "./provider";

/**
 * Sandbox provider used by default. No card data is ever requested — there is no fake bank form —
 * the "checkout" is just our own /paiement/[id] page where a tester explicitly picks the simulated
 * outcome (accepted / declined / error). No money moves, real or otherwise.
 */
export const mockProvider: PaymentProvider = {
  name: "mock",
  isConfigured() {
    return true; // always available — that's the point of a sandbox
  },
  async createCheckout(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return { providerRef: `MOCK-${input.paiementId}`, checkoutUrl: `/paiement/${input.paiementId}` };
  },
};
