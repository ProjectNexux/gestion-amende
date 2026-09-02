import type { BadgeTone } from "@/components/ui/Badge";
import type { ParsedFacture, ParsedImpot } from "@/lib/comptabilite-parser";

// "Non transmis" is the default for manually-added documents (never auto-sent on save — the user
// keeps full control, see comptabilite-forward.ts / the "Transmettre à la comptabilité" flow).
export const FORWARD_STATUTS = ["Non transmis", "À transmettre", "En cours d'envoi", "Envoyé", "Erreur d'envoi", "À vérifier"] as const;
export type ForwardStatut = (typeof FORWARD_STATUTS)[number];

// Presentation-only option lists for the manual entry forms — not enforced server-side beyond
// being free text, so a document created before a list changes never becomes "invalid".
export const IMPOT_ORGANISME_OPTIONS = ["DGFiP", "Service des impôts", "Trésor Public", "Autre"];
export const IMPOT_TYPE_OPTIONS = ["TVA", "CFE", "Impôt sur les sociétés", "Taxe foncière", "Avis d'imposition", "Relance", "Autre"];
export const DEVISE_OPTIONS = ["EUR", "USD", "GBP", "CHF"];

export type ForwardHistoriqueEntry = { date: string; action: string; details?: string | null };

// Tracks the automatic (or manual) e-mail transmission of a Facture/Impôt document — never
// contains any secret, only the outcome. `messageId` + `envoyeAt` are what prevents a duplicate
// send (see comptabilite-forward.ts): once statut is "Envoyé" the document is never re-sent
// automatically.
export type ForwardData = {
  statut: ForwardStatut;
  destinataires: string[];
  envoyeAt: string | null; // ISO
  messageId: string | null;
  tentatives: number;
  derniereErreur: string | null;
  historique: ForwardHistoriqueEntry[];
};

export function buildInitialForward(statut: ForwardStatut, actionLabel: string): ForwardData {
  return {
    statut,
    destinataires: [],
    envoyeAt: null,
    messageId: null,
    tentatives: 0,
    derniereErreur: null,
    historique: [{ date: new Date().toISOString(), action: actionLabel }],
  };
}

export function forwardStatutTone(statut: ForwardStatut | string | undefined): BadgeTone {
  if (statut === "Envoyé") return "success";
  if (statut === "Erreur d'envoi") return "danger";
  if (statut === "À vérifier") return "warning";
  if (statut === "Non transmis") return "neutral";
  return "warning"; // À transmettre, En cours d'envoi
}

export function origineLabel(origine: "auto" | "manuel" | string | undefined): string {
  return origine === "manuel" ? "Manuel" : "Automatique";
}

// Manual-entry-only fields (left null/undefined by the automatic OCR pipeline) — deliberately part
// of the SAME type as the automatic fields (not a separate FactureManuelle/FactureAutomatique
// shape) so both entry methods share one data structure and appear in the same lists.
export type FactureCourrierData = ParsedFacture & {
  societeConcernee: string;
  statutClassification: "Nouveau" | "À vérifier";
  origine: "auto" | "manuel";
  forward: ForwardData;
  echeance?: string | null;
  montantHT?: number | null;
  tva?: number | null;
  montantTTC?: number | null;
  devise?: string;
  referenceCommande?: string | null;
  commentaire?: string | null;
};

export type ImpotCourrierData = ParsedImpot & {
  societeConcernee: string;
  statutClassification: "Nouveau" | "À vérifier";
  origine: "auto" | "manuel";
  forward: ForwardData;
  periodeConcernee?: string | null;
  commentaire?: string | null;
};

export function getFactureData(data: unknown): Partial<FactureCourrierData> {
  return data && typeof data === "object" ? (data as Partial<FactureCourrierData>) : {};
}

export function getImpotData(data: unknown): Partial<ImpotCourrierData> {
  return data && typeof data === "object" ? (data as Partial<ImpotCourrierData>) : {};
}
