/**
 * Very small heuristic document-type classifier for scanned mail.
 *
 * IMPORTANT: contravention hints always win. This guarantees the existing
 * Contraventions pipeline (fine-parser.ts) keeps behaving exactly as before —
 * we only ever redirect a scan to the "mise en demeure" pipeline when there
 * is zero contravention signal in the text at all.
 */

export type DocumentType = "contravention" | "mise_en_demeure" | "pub" | "inconnu";

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

export function classifyDocument(ocrText: string): { type: DocumentType; score: number } {
  const lower = ocrText.toLowerCase();
  const contraventionScore = CONTRAVENTION_HINTS.reduce((n, re) => n + (re.test(lower) ? 1 : 0), 0);
  if (contraventionScore > 0) return { type: "contravention", score: contraventionScore };

  const miseEnDemeureScore = MISE_EN_DEMEURE_HINTS.reduce((n, re) => n + (re.test(lower) ? 1 : 0), 0);
  if (miseEnDemeureScore > 0) return { type: "mise_en_demeure", score: miseEnDemeureScore };

  const hasExclusion = PUB_EXCLUSION_HINTS.some((re) => re.test(lower));
  const pubScore = PUB_HINTS.reduce((n, re) => n + (re.test(lower) ? 1 : 0), 0);
  if (!hasExclusion && pubScore > 0) return { type: "pub", score: pubScore };

  return { type: "inconnu", score: 0 };
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

