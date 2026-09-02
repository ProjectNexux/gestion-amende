/**
 * Heuristic (pattern-based, not ML) extractor for "facture" and "impôt" documents, in the same
 * spirit as fine-parser.ts / mise-en-demeure-parser.ts. Never invents a value: a field that
 * cannot be found stays null.
 */

export type ParsedFacture = {
  emetteur: string | null;
  dateDocument: string | null; // dd/mm/yyyy
  montant: number | null;
  reference: string | null;
};

export type ParsedImpot = {
  typeDocument: string | null; // "TVA" | "CFE" | "Impôt sur les sociétés" | "Taxe foncière" | "Avis d'imposition" | ...
  organisme: string | null;
  dateDocument: string | null;
  montant: number | null;
  echeance: string | null;
  reference: string | null;
};

const reDateDoc = /\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/;
// {1,4} on the leading digit group: OCR often drops the thousands separator (e.g. "3250,00 €"
// instead of "3 250,00 €") — {1,3} would then only capture "250" and silently lose a digit.
const reMontantTotal = /(?:total\s+ttc|net\s+[àa]\s+payer|total|montant\s+d[ûu]|s[''’]?[ée]l[èe]ve\s+[àa])[^\d]{0,20}(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2})?)\s*€/i;
const reMontantAny = /(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2})?)\s*€/g;
const reReference = /(?:facture|dossier|r[ée]f[ée]rence|contrat)\s*n?[°ºo]?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_.]{2,30})/i;
const reEcheanceAbsolute = /(?:date\s+limite\s+de\s+paiement|[àa]\s+r[ée]gler\s+avant\s+le|avant\s+le)\s*[:#]?\s*(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i;

function normalize(s: string): string {
  return s.replace(/\u00A0/g, " ").replace(/[\r\t]+/g, " ").replace(/ +/g, " ");
}

function extractMontant(text: string): number | null {
  const total = text.match(reMontantTotal);
  const raw = total?.[1] ?? [...text.matchAll(reMontantAny)].map((m) => m[1]).sort((a, b) => b.length - a.length)[0];
  if (!raw) return null;
  const val = parseFloat(raw.replace(/[ .]/g, "").replace(",", "."));
  return isNaN(val) || val <= 0 ? null : val;
}

function trimToWordBoundary(s: string, maxLen: number): string {
  const trimmed = s.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 5 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Best-effort issuer guess — first non-empty letterhead-like line of the document. */
function guessEmetteur(text: string): string | null {
  const line = text
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 2 && l.length < 80 && !/^\d/.test(l));
  return line ? trimToWordBoundary(line, 60) : null;
}

export function parseFacture(rawText: string): ParsedFacture {
  const text = normalize(rawText);
  const dm = text.match(reDateDoc);
  const refMatch = text.match(reReference);
  return {
    emetteur: guessEmetteur(text),
    dateDocument: dm ? `${dm[1]}/${dm[2]}/${dm[3]}` : null,
    montant: extractMontant(text),
    reference: refMatch ? trimToWordBoundary(refMatch[1], 30) : null,
  };
}

const IMPOT_TYPE_PATTERNS: [RegExp, string][] = [
  [/avis\s+d[''’]imposition/i, "Avis d'imposition"],
  [/cotisation\s+fonci[èe]re\s+des\s+entreprises|\bcfe\b/i, "Cotisation foncière des entreprises (CFE)"],
  [/taxe\s+fonci[èe]re/i, "Taxe foncière"],
  [/d[ée]claration\s+de\s+tva|\btva\b/i, "TVA"],
  [/imp[ôo]t\s+sur\s+les\s+soci[ée]t[ée]s/i, "Impôt sur les sociétés"],
  [/avis\s+de\s+mise\s+en\s+recouvrement/i, "Avis de mise en recouvrement"],
];

const ORGANISME_PATTERNS = [
  /direction\s+g[ée]n[ée]rale\s+des\s+finances\s+publiques|\bdgfip\b/i,
  /service\s+des\s+imp[ôo]ts/i,
  /centre\s+des\s+finances\s+publiques/i,
  /tr[ée]sor\s+public/i,
];

export function parseImpot(rawText: string): ParsedImpot {
  const text = normalize(rawText);
  const dm = text.match(reDateDoc);
  const refMatch = text.match(reReference);
  const echeanceMatch = text.match(reEcheanceAbsolute);

  let typeDocument: string | null = null;
  for (const [re, label] of IMPOT_TYPE_PATTERNS) {
    if (re.test(text)) {
      typeDocument = label;
      break;
    }
  }

  let organisme: string | null = null;
  for (const re of ORGANISME_PATTERNS) {
    const m = text.match(re);
    if (m) {
      organisme = trimToWordBoundary(m[0].replace(/\s+/g, " "), 50);
      break;
    }
  }

  return {
    typeDocument,
    organisme,
    dateDocument: dm ? `${dm[1]}/${dm[2]}/${dm[3]}` : null,
    montant: extractMontant(text),
    echeance: echeanceMatch ? echeanceMatch[1] : null,
    reference: refMatch ? trimToWordBoundary(refMatch[1], 30) : null,
  };
}
