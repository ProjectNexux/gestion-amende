/**
 * Very small heuristic document-type classifier for scanned mail.
 *
 * IMPORTANT: contravention hints always win. This guarantees the existing
 * Contraventions pipeline (fine-parser.ts) keeps behaving exactly as before —
 * we only ever redirect a scan to the "mise en demeure" pipeline when there
 * is zero contravention signal in the text at all.
 */

export type DocumentType =
  | "contravention"
  | "mise_en_demeure"
  | "certificat_immatriculation"
  | "sinistre"
  | "permis_conduire"
  | "carte_identite"
  | "facture"
  | "impot"
  | "pub"
  | "inconnu";

const CONTRAVENTION_HINTS = [
  /avis\s+de\s+contravention/i,
  /amende\s+forfaitaire/i,
  /officier\s+du\s+minist[èe]re\s+public/i,
  /\bantai\b/i,
  /exc[èe]s\s+de\s+vitesse/i,
  /infraction\s+au\s+code\s+de\s+la\s+route/i,
];

const MISE_EN_DEMEURE_HINTS = [
  /mise\s+en\s+demeure\s+de\s+payer/i,
  /mise\s+en\s+demeure\s+avant\s+poursuites?/i,
  /derni[èe]re\s+relance\s+avant\s+mise\s+en\s+demeure/i,
  /mise\s+en\s+demeure\s+pr[ée]alable/i,
  /lettre\s+de\s+mise\s+en\s+demeure/i,
  /mise\s+en\s+demeure/i,
];

// Only used by the manual-import pipeline today (see document-import.ts) — the automatic
// e-mail pipeline never branches on this type, so adding it here is a no-op for that pipeline
// (falls through to the same contravention-parsing attempt as "inconnu" always did).
const CERTIFICAT_IMMATRICULATION_HINTS = [
  /certificat\s+d[''’]immatriculation/i,
  /carte\s+grise/i,
  /titulaire\s+du\s+certificat/i,
  /num[ée]ro\s+d[''’]immatriculation\s+du\s+v[ée]hicule/i,
  /genre\s+national[^\n]{0,40}carrosserie/i,
];

// Accident/insurance-claim correspondence — constat amiable, expertise, garage repair quotes.
const SINISTRE_HINTS = [
  /constat\s+amiable/i,
  /d[ée]claration\s+de\s+sinistre/i,
  /num[ée]ro\s+de\s+sinistre/i,
  /\bsinistre\s+n[°ºo]?/i,
  /accident\s+de\s+la\s+circulation/i,
  /expert(?:ise)?\s+automobile/i,
  /rapport\s+d[''’]expertise/i,
  /devis\s+de\s+r[ée]paration/i,
  /franchise\s+contractuelle/i,
  /v[ée]hicule\s+endommag[ée]/i,
];

// Driving licence — kept specific (never matches on "permis de" alone, which could appear in
// unrelated administrative wording).
const PERMIS_CONDUIRE_HINTS = [
  /permis\s+de\s+conduire/i,
  /num[ée]ro\s+de\s+permis/i,
  /titulaire\s+du\s+permis/i,
  /cat[ée]gories?\s+de\s+permis/i,
];

// National ID card — deliberately does NOT include generic "République française" wording
// (present on almost every French official document, incl. carte grise/permis) to avoid
// misclassifying those as carte_identite.
const CARTE_IDENTITE_HINTS = [
  /carte\s+nationale\s+d[''’]identit[ée]/i,
  /carte\s+d[''’]identit[ée]/i,
  /signature\s+du\s+titulaire/i,
  /taille[^\n]{0,15}m[^\n]{0,15}yeux/i,
];

// Only a real invoice, not a passing mention (contracts, mise en demeure referencing an unpaid
// invoice, etc. already win above) — kept fairly specific on purpose.
const FACTURE_HINTS = [
  /facture\s+n[°ºo]?\s*[:#]?\s*\S+/i,
  /facture\s+fournisseur/i,
  /facture\s+client/i,
  /facture\s+d[''’]achat/i,
  /facture\s+de\s+prestation/i,
  /\bfacture\b/i,
  /montant\s+ht\b/i,
  /montant\s+ttc\b/i,
  /conditions\s+de\s+r[èe]glement/i,
  /d[ée]lai\s+de\s+paiement/i,
];

const IMPOT_HINTS = [
  /avis\s+d[''’]imposition/i,
  /direction\s+g[ée]n[ée]rale\s+des\s+finances\s+publiques|\bdgfip\b/i,
  /imp[ôo]t\s+sur\s+les\s+soci[ée]t[ée]s/i,
  /cotisation\s+fonci[èe]re\s+des\s+entreprises|\bcfe\b/i,
  /taxe\s+fonci[èe]re/i,
  /d[ée]claration\s+de\s+tva/i,
  /\btva\b/i,
  /service\s+des\s+imp[ôo]ts/i,
  /centre\s+des\s+finances\s+publiques/i,
  /avis\s+de\s+mise\s+en\s+recouvrement/i,
  /tr[ée]sor\s+public/i,
];

// Clearly-commercial-and-unimportant wording only. Kept intentionally narrow — see PUB_EXCLUSION_HINTS.
const PUB_HINTS = [
  /publicit[ée]/i,
  /prospectus/i,
  /offre\s+promotionnelle/i,
  /brochure\s+commerciale/i,
  /catalogue/i,
  /communication\s+marketing/i,
  /op[ée]ration\s+commerciale/i,
];

// Any of these signals disqualifies "pub" entirely, even if a PUB_HINT also matched — when in
// doubt we fall through to "inconnu" (never auto-deleted) rather than risk a wrongful deletion.
const PUB_EXCLUSION_HINTS = [
  /urssaf/i,
  /facture/i,
  /sinistre/i,
  /montant\s+d[ûu]/i,
  /date\s+limite/i,
  /[ée]ch[ée]ance/i,
  /certificat\s+d[''’]immatriculation/i,
  /huissier/i,
  /avocat/i,
  /tribunal/i,
  /jugement/i,
  /recouvrement/i,
  /relance/i,
  /r[ée]gularisation/i,
];

function scoreHints(lower: string, hints: RegExp[]): number {
  return hints.reduce((n, re) => n + (re.test(lower) ? 1 : 0), 0);
}

export function classifyDocument(ocrText: string): { type: DocumentType; score: number; competingScore?: number } {
  const lower = ocrText.toLowerCase();
  const contraventionScore = CONTRAVENTION_HINTS.reduce((n, re) => n + (re.test(lower) ? 1 : 0), 0);
  if (contraventionScore > 0) return { type: "contravention", score: contraventionScore };

  const miseEnDemeureScore = MISE_EN_DEMEURE_HINTS.reduce((n, re) => n + (re.test(lower) ? 1 : 0), 0);
  if (miseEnDemeureScore > 0) return { type: "mise_en_demeure", score: miseEnDemeureScore };

  const certificatScore = scoreHints(lower, CERTIFICAT_IMMATRICULATION_HINTS);
  if (certificatScore > 0) return { type: "certificat_immatriculation", score: certificatScore };

  const sinistreScore = scoreHints(lower, SINISTRE_HINTS);
  if (sinistreScore > 0) return { type: "sinistre", score: sinistreScore };

  const permisScore = scoreHints(lower, PERMIS_CONDUIRE_HINTS);
  if (permisScore > 0) return { type: "permis_conduire", score: permisScore };

  const carteIdentiteScore = scoreHints(lower, CARTE_IDENTITE_HINTS);
  if (carteIdentiteScore > 0) return { type: "carte_identite", score: carteIdentiteScore };

  // Facture vs Impôt: both are scored together because their vocabulary overlaps (a facture
  // often mentions "TVA" too) — the caller uses `competingScore` to decide whether the document
  // is confidently one or the other, or ambiguous ("À vérifier", see comptabilite-parser.ts).
  const factureScore = scoreHints(lower, FACTURE_HINTS);
  const impotScore = scoreHints(lower, IMPOT_HINTS);
  if (factureScore > 0 || impotScore > 0) {
    if (factureScore >= impotScore) {
      return { type: "facture", score: factureScore, competingScore: impotScore };
    }
    return { type: "impot", score: impotScore, competingScore: factureScore };
  }

  const hasExclusion = PUB_EXCLUSION_HINTS.some((re) => re.test(lower));
  const pubScore = PUB_HINTS.reduce((n, re) => n + (re.test(lower) ? 1 : 0), 0);
  if (!hasExclusion && pubScore > 0) return { type: "pub", score: pubScore };

  return { type: "inconnu", score: 0 };
}

/** True only when a facture/impot classification is decisive enough to auto-forward without human review. */
export function isComptabiliteClassificationConfident(score: number, competingScore: number): boolean {
  return score >= 2 && (competingScore === 0 || score - competingScore >= 2);
}



/** Best-effort sender guess for a "pub" document — just the first non-empty letterhead-like line. */
export function detectSimpleExpediteur(text: string): string | null {
  const line = text
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 2 && l.length < 80);
  if (line) return line;
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, 60).trim() : null;
}

