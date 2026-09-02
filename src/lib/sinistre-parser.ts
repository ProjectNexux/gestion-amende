/**
 * Heuristic (pattern-based, not ML) extractor for "sinistre" (accident/insurance claim)
 * documents, in the same spirit as fine-parser.ts / mise-en-demeure-parser.ts. Never invents a
 * value: a field that cannot be found stays null.
 */

import { SINISTRE_TYPES } from "@/lib/sinistres";

export type ParsedSinistre = {
  typeSinistre: (typeof SINISTRE_TYPES)[number] | null;
  dateSinistre: string | null; // dd/mm/yyyy
  lieuSinistre: string | null;
  assureur: string | null;
  referenceAssureur: string | null;
  montantDommage: number | null;
};

const reDateSinistre = /\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/;
const reReferenceAssureur = /(?:sinistre|dossier)\s*n?[°ºo]?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_.]{2,30})/i;
const reMontant = /(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2})?)\s*€/g;
const reLieu = /(?:lieu\s+(?:du\s+)?sinistre|survenue?\s+[àa])[^A-Za-z0-9]{1,5}([^\n]{5,80})/i;

const ASSUREUR_HINTS = [
  /axa[^\n]{0,20}/i,
  /maif[^\n]{0,20}/i,
  /macif[^\n]{0,20}/i,
  /allianz[^\n]{0,20}/i,
  /groupama[^\n]{0,20}/i,
  /gan\s+assurances?[^\n]{0,20}/i,
  /matmut[^\n]{0,20}/i,
  /compagnie\s+d[''’]assurances?[^\n]{0,40}/i,
  /assureur[^\n]{0,40}/i,
];

const TYPE_PATTERNS: [RegExp, (typeof SINISTRE_TYPES)[number]][] = [
  [/vol\s+(?:du\s+)?v[ée]hicule|vol\s+qualifi[ée]/i, "Vol"],
  [/vandalisme/i, "Vandalisme"],
  [/bris\s+de\s+glace/i, "Bris de glace"],
  [/d[ée]g[âa]t\s+des\s+eaux/i, "Dégât des eaux"],
  [/incendie/i, "Incendie"],
  [/accident|collision|choc\s+(?:avant|arri[èe]re)/i, "Accident"],
  [/dommage\s+mat[ée]riel/i, "Dommage matériel"],
];

function normalize(s: string): string {
  return s.replace(/\u00A0/g, " ").replace(/[\r\t]+/g, " ").replace(/ +/g, " ");
}

function trimToWordBoundary(s: string, maxLen: number): string {
  // Native PDF text extraction joins lines/sentences with plain spaces (no newlines), so cut at
  // the first sentence-ending period first, then fall back to a plain word-boundary trim.
  const bySentence = s.trim().split(/\.\s/)[0].trim();
  const trimmed = bySentence.length > 2 ? bySentence : s.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 5 ? cut.slice(0, lastSpace) : cut).trim();
}

export function parseSinistre(rawText: string): ParsedSinistre {
  const text = normalize(rawText);

  let typeSinistre: (typeof SINISTRE_TYPES)[number] | null = null;
  for (const [re, label] of TYPE_PATTERNS) {
    if (re.test(text)) {
      typeSinistre = label;
      break;
    }
  }

  const dm = text.match(reDateSinistre);
  const refMatch = text.match(reReferenceAssureur);
  const lieuMatch = text.match(reLieu);

  let assureur: string | null = null;
  for (const re of ASSUREUR_HINTS) {
    const m = text.match(re);
    if (m) {
      assureur = trimToWordBoundary(m[0].replace(/\s+/g, " ").split(/[-–,]/)[0], 40);
      break;
    }
  }

  const montants: number[] = [];
  for (const m of text.matchAll(reMontant)) {
    const val = parseFloat(m[1].replace(/[ .]/g, "").replace(",", "."));
    if (!isNaN(val) && val > 0) montants.push(val);
  }
  const montantDommage = montants.length > 0 ? Math.max(...montants) : null;

  return {
    typeSinistre,
    dateSinistre: dm ? `${dm[1]}/${dm[2]}/${dm[3]}` : null,
    lieuSinistre: lieuMatch ? trimToWordBoundary(lieuMatch[1], 60) : null,
    assureur,
    referenceAssureur: refMatch ? trimToWordBoundary(refMatch[1], 30).replace(/\.$/, "") : null,
    montantDommage,
  };
}
