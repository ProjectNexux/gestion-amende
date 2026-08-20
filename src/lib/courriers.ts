import type { ParsedMiseEnDemeure } from "@/lib/mise-en-demeure-parser";
import type { Transmission } from "@/lib/transmission";

export type CourrierTypeKey = "certificat_immatriculation" | "mise_en_demeure" | "pub" | "retard_paiement";

// Registry of "Courriers" document types. Only certificat_immatriculation (manual),
// mise_en_demeure and pub (both automatic, via the email pipeline) are wired up today; future
// types (facture, sinistre, ...) can be appended here without touching the rest of the architecture.
export const COURRIER_TYPES: { key: CourrierTypeKey; label: string }[] = [
  { key: "certificat_immatriculation", label: "Certificat d'immatriculation" },
  { key: "mise_en_demeure", label: "Mise en demeure" },
  { key: "pub", label: "Pub" },
  { key: "retard_paiement", label: "Retard de paiement" },
];

export function courrierTypeLabel(type: string): string {
  return COURRIER_TYPES.find((t) => t.key === type)?.label ?? type;
}

export const ACCEPTED_COURRIER_MIME_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

/** Uppercases/tidies a plate number without forcing the modern AA-000-AA dashed format on older plates. */
export function normalizeImmatriculation(raw: string): string {
  const value = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (!value) return value;
  const compact = value.replace(/[\s.-]/g, "");
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(compact)) {
    return `${compact.slice(0, 2)}-${compact.slice(2, 5)}-${compact.slice(5)}`;
  }
  return value;
}

/** Reads the type-specific `immatriculation` field out of a Courrier's generic JSON `data` column. */
export function getImmatriculation(data: unknown): string {
  if (data && typeof data === "object" && "immatriculation" in data) {
    const v = (data as Record<string, unknown>).immatriculation;
    return typeof v === "string" ? v : "";
  }
  return "";
}

export type MiseEnDemeureOrigine = "auto" | "manuel";

export type MiseEnDemeureData = ParsedMiseEnDemeure & {
  societeConcernee: string | null;
  statut: string;
  origine: MiseEnDemeureOrigine;
  transmission?: Transmission | null;
};

export const MISE_EN_DEMEURE_STATUTS = ["Nouveau", "À vérifier", "À traiter", "En cours", "Traité", "Archivé"] as const;

export function origineLabel(origine: MiseEnDemeureOrigine | undefined): string {
  return origine === "manuel" ? "Manuel" : "Automatique";
}

/** Minutes a document classified as "pub" stays visible before automatic server-side deletion. */
export const PUB_RETENTION_MINUTES = 15;

export type PubData = {
  expediteur: string | null;
  classifiedAt: string; // ISO
  conserve: boolean; // true once the user clicked "Conserver" — cancels the automatic deletion
};

/** Reads the pub-specific fields out of a Courrier's generic JSON `data` column. */
export function getPubData(data: unknown): Partial<PubData> {
  return data && typeof data === "object" ? (data as Partial<PubData>) : {};
}

/** Minutes remaining before automatic deletion (0 if already due, null if not scheduled). */
export function pubMinutesRemaining(expiresAt: Date | null): number | null {
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 60000));
}

export const RETARD_PAIEMENT_STATUTS = [
  "Non payé",
  "Partiellement payé",
  "Paiement en attente",
  "Payé",
  "Échec de paiement",
  "Remboursé",
] as const;

export type RetardPaiementData = {
  beneficiaire: string; // CSPL | NETECO | Optimove Consulting
  debiteur: string;
  montantDu: number; // cents
  montantPaye: number; // cents — recalculated from successful Paiement rows only
  reference: string | null;
  dateEcheance: string | null; // dd/mm/yyyy
  statutPaiement: string;
};

/** Reads the retard-de-paiement specific fields out of a Courrier's generic JSON `data` column. */
export function getRetardPaiementData(data: unknown): Partial<RetardPaiementData> {
  return data && typeof data === "object" ? (data as Partial<RetardPaiementData>) : {};
}

export function resteAPayer(data: Partial<RetardPaiementData>): number {
  return Math.max(0, (data.montantDu ?? 0) - (data.montantPaye ?? 0));
}

// Re-exported here so callers dealing with retard-de-paiement Courrier data can import everything
// from a single module; the canonical definition lives in @/lib/payments/beneficiaries.
export { isBeneficiaireValide } from "@/lib/payments/beneficiaries";

/** Reads the mise-en-demeure specific fields out of a Courrier's generic JSON `data` column. */
export function getMiseEnDemeureData(data: unknown): Partial<MiseEnDemeureData> {
  return data && typeof data === "object" ? (data as Partial<MiseEnDemeureData>) : {};
}
