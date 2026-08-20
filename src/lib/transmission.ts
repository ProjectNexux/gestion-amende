/**
 * Generic "transmission to client" architecture, shared by any future organisme (URSSAF today,
 * others later). It only ever prepares a transmission — it never sends anything. The pipeline is
 * intentionally split into separable stages so automatic sending can be enabled later without
 * rewriting this module:
 *
 *   1. detectOrganisme()      — detection/analyse
 *   2. (caller) société lookup — client identification
 *   3. buildTransmission()    — preparation (+ historique)
 *   4. (human, via UI)        — validation
 *   5. NOT IMPLEMENTED        — sending (gated by AUTO_FORWARD_URSSAF, hardcoded false)
 */

// Kept hardcoded to false on purpose: no outgoing e-mail is ever sent automatically yet, and no
// sending code path exists at all. This constant only documents the future activation switch.
export const AUTO_FORWARD_URSSAF = false;

const ORGANISME_PATTERNS: { label: string; patterns: RegExp[] }[] = [
  { label: "URSSAF", patterns: [/urssaf/i] },
];

/** Detects the sending organisme from OCR text and/or the extracted expéditeur — content-based, not filename-based. */
export function detectOrganisme(...texts: (string | null | undefined)[]): string | null {
  const haystack = texts.filter(Boolean).join(" ").toLowerCase();
  for (const org of ORGANISME_PATTERNS) {
    if (org.patterns.some((re) => re.test(haystack))) return org.label;
  }
  return null;
}

export type TransmissionConfiance = "Élevée" | "Moyenne" | "Faible";
export type TransmissionStatut = "À vérifier" | "À transmettre" | "Prêt à envoyer" | "Envoyé" | "Erreur d'envoi";

export type TransmissionHistoriqueEntry = { date: string; action: string; acteur?: string | null };

export type Transmission = {
  organisme: string | null;
  clientDetecte: string | null;
  confiance: TransmissionConfiance;
  historique: TransmissionHistoriqueEntry[];
};

/** Builds (or rebuilds) the transmission block, appending one historique entry for this event. */
export function buildTransmission(opts: {
  organisme: string | null;
  societeConcernee: string | null;
  societeConnue: boolean;
  identificationConfidence: number; // 0-1, carried over from the document parser
  acteur: string;
  actionLabel: string;
  previousHistorique?: TransmissionHistoriqueEntry[];
}): Transmission | null {
  if (!opts.organisme) return null;

  let confiance: TransmissionConfiance = "Faible";
  if (opts.societeConnue && opts.identificationConfidence >= 0.8) confiance = "Élevée";
  else if (opts.societeConnue && opts.identificationConfidence >= 0.5) confiance = "Moyenne";

  return {
    organisme: opts.organisme,
    clientDetecte: opts.societeConnue ? opts.societeConcernee : null,
    confiance,
    historique: [
      ...(opts.previousHistorique ?? []),
      { date: new Date().toISOString(), action: opts.actionLabel, acteur: opts.acteur },
    ],
  };
}

/** Statut is always derived live (never trusted as stale JSON) from the current confiance + e-mail on file. */
export function deriveTransmissionStatut(t: Transmission | null | undefined, email: string | null): TransmissionStatut {
  if (!t || !t.organisme || t.confiance === "Faible" || !t.clientDetecte) return "À vérifier";
  if (!email) return "À transmettre";
  return "Prêt à envoyer";
}
