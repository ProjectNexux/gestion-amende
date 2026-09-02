/**
 * Heuristic (pattern-based, not ML) extractor for "mise en demeure" letters, in the same spirit
 * as fine-parser.ts for contraventions. Confidence scores are best-effort: when signals are weak
 * or conflicting the field is left null / statut is forced to "À vérifier" rather than guessed.
 */

export type SensMiseEnDemeure = "recue" | "envoyee" | "a_verifier";

export type ParsedMiseEnDemeure = {
  expediteur: string | null;
  destinataire: string | null;
  sens: SensMiseEnDemeure;
  motif: string | null;
  motifBrut: string | null;
  dateDocument: string | null; // dd/mm/yyyy
  echeance: string | null; // dd/mm/yyyy, computed or extracted
  echeanceTexte: string | null; // original wording, e.g. "sous 8 jours"
  montant: number | null;
  montantIncertain: boolean;
  reference: string | null;
  confiance: {
    expediteur: number;
    destinataire: number;
    date: number;
    motif: number;
    montant: number;
    echeance: number;
    sens: number;
  };
  statut: "Nouveau" | "À vérifier";
};

const SENDER_KEYWORDS = [
  /urssaf[^\n]{0,40}/i,
  /tr[ée]sor\s+public/i,
  /direction\s+g[ée]n[ée]rale\s+des\s+finances\s+publiques|dgfip/i,
  /cabinet\s+d[''’]avocats?[^\n]{0,40}/i,
  /huissier(?:\s+de\s+justice)?[^\n]{0,40}/i,
  /soci[ée]t[ée]\s+de\s+recouvrement[^\n]{0,40}/i,
  /compagnie\s+d[''’]assurances?[^\n]{0,40}/i,
  /assurances?[^\n]{0,40}/i,
  /banque[^\n]{0,40}/i,
  /caisse\s+(?:d[''’])?(?:assurance|allocations|retraite)[^\n]{0,40}/i,
];

const SIGNER_ROLE_KEYWORDS = /le\s+directeur|la\s+direction|le\s+g[ée]rant|service\s+contentieux|service\s+recouvrement|le\s+repr[ée]sentant\s+l[ée]gal/i;

const MOTIF_PATTERNS: [RegExp, string][] = [
  [/facture\s+n[°ºo]?\s*(\S+)[^\n]{0,25}(?:non\s+r[ée]gl[ée]e|impay[ée]e)/i, "Facture __REF__ non réglée"],
  [/cotisations?\s+sociales?/i, "Cotisations sociales impayées"],
  [/loyers?\s+impay[ée]s?/i, "Loyers impayés"],
  [/prime\s+d[''’]assurance/i, "Prime d'assurance impayée"],
  [/retard\s+de\s+paiement/i, "Retard de paiement"],
  [/d[ée]faut\s+de\s+d[ée]claration/i, "Défaut de déclaration"],
  [/solde\s+restant\s+d[ûu]|somme\s+restant\s+due/i, "Somme restant due"],
  [/non[-\s]respect\s+d[''’]un\s+engagement/i, "Non-respect d'un engagement"],
  [/r[ée]gularisation/i, "Régularisation administrative demandée"],
];

const reDateDoc = /\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/;
// \d{1,4} (not {1,3}) for the leading group: OCR often drops the space/period thousands
// separator (e.g. "3250,00 €" instead of "3 250,00 €") — {1,3} would then only capture the
// last 3 digits ("250") and silently lose the leading digit. Same fix as fine-parser.ts.
const reMontant = /(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2})?)\s*€/g;
const reMontantTotal = /(?:total|s[''’]?[ée]l[èe]ve\s+[àa]|somme\s+de|montant\s+d[ûu])[^\d]{0,20}(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2})?)\s*€/i;
const reReferenceLine = /(?:dossier|r[ée]f[ée]rence|contrat|facture|courrier)\s*n?[°ºo]?\s*[:#]?\s*([^\n.]{2,60})/i;
const reDelayRelative = /(?:sous\s+|dans\s+un\s+d[ée]lai\s+de\s+|d[''’]un\s+d[ée]lai\s+de\s+)(\d{1,3})\s+jours?/i;
const reDelayAbsolute = /avant\s+le\s+(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i;

function normalize(s: string) {
  return s.replace(/\u00A0/g, " ").replace(/[\r\t]+/g, " ").replace(/ +/g, " ");
}

// Native PDF text extraction joins lines with plain spaces (no \n), so a naive "rest of the
// line" capture can bleed into the next entity's name. Cut back to the last full word within
// maxLen instead of stopping mid-word.
function trimToWordBoundary(s: string, maxLen: number): string {
  const trimmed = s.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 5 ? cut.slice(0, lastSpace) : cut).trim();
}

function addDays(dateStr: string, days: number): string | null {
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  d.setDate(d.getDate() + days);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * `ourSociete` is the tenant that received the scan (trusted from the mailbox routing, not
 * guessed from the OCR text). It is used only to work out the "sens" (reçue/envoyée) and as the
 * default expéditeur/destinataire counterpart — never to invent a new société.
 */
export function parseMiseEnDemeure(rawText: string, ourSociete: string): ParsedMiseEnDemeure {
  const text = normalize(rawText);
  const lower = text.toLowerCase();
  const len = text.length || 1;

  // Check both the first mention (usually the address/letterhead block) and the last one
  // (usually the signature block) — a letter we signed will have our société's name again
  // near a signer-role keyword at the very end, even if it also appears earlier as a recipient-like block.
  const ourIdxFirst = lower.indexOf(ourSociete.toLowerCase());
  const ourIdxLast = lower.lastIndexOf(ourSociete.toLowerCase());
  const signatureZoneStart = len * 0.6;
  const recipientZoneEnd = len * 0.25;

  let sens: SensMiseEnDemeure = "recue";
  let expediteur: string | null = null;
  let destinataire: string | null = null;
  let sensConfidence = 0.6;

  const looksOutgoing =
    ourIdxLast >= 0 &&
    ourIdxLast >= signatureZoneStart &&
    SIGNER_ROLE_KEYWORDS.test(lower.slice(Math.max(0, ourIdxLast - 60), ourIdxLast + 60));

  if (looksOutgoing) {
    sens = "envoyee";
    expediteur = ourSociete;
    sensConfidence = 0.75;
  } else {
    sens = "recue";
    destinataire = ourSociete;
    sensConfidence = ourIdxFirst >= 0 && ourIdxFirst <= recipientZoneEnd ? 0.85 : 0.6;
  }

  if (sens === "recue") {
    for (const re of SENDER_KEYWORDS) {
      const m = text.match(re);
      if (m) {
        expediteur = trimToWordBoundary(m[0].replace(/\s+/g, " "), 32);
        break;
      }
    }
    if (!expediteur) {
      const labeled = text.match(/exp[ée]diteur\s*[:\-]?\s*([^\n]{2,80})/i);
      if (labeled) expediteur = trimToWordBoundary(labeled[1], 40);
    }
  } else {
    const labeled = text.match(/(?:destinataire|[àa]\s+l[''’]attention\s+de)\s*[:\-]?\s*([^\n]{2,80})/i);
    if (labeled) destinataire = trimToWordBoundary(labeled[1], 40);
  }

  const expediteurConfidence = expediteur ? (sens === "envoyee" ? 1 : 0.55) : 0;
  const destinataireConfidence = destinataire ? (sens === "recue" ? 1 : 0.55) : 0;

  let dateDocument: string | null = null;
  let dateConfidence = 0;
  const dm = text.match(reDateDoc);
  if (dm) {
    dateDocument = `${dm[1]}/${dm[2]}/${dm[3]}`;
    dateConfidence = 0.7;
  }

  let motif: string | null = null;
  let motifBrut: string | null = null;
  let motifConfidence = 0;
  for (const [re, label] of MOTIF_PATTERNS) {
    const m = text.match(re);
    if (m) {
      motif = label.includes("__REF__") ? label.replace("__REF__", m[1] ?? "") : label;
      motifBrut = m[0].trim();
      motifConfidence = 0.7;
      break;
    }
  }

  const montants: number[] = [];
  for (const m of text.matchAll(reMontant)) {
    const val = parseFloat(m[1].replace(/[ .]/g, "").replace(",", "."));
    if (!isNaN(val) && val > 0) montants.push(val);
  }
  let montant: number | null = null;
  let montantIncertain = false;
  let montantConfidence = 0;
  const totalMatch = text.match(reMontantTotal);
  if (totalMatch) {
    montant = parseFloat(totalMatch[1].replace(/[ .]/g, "").replace(",", "."));
    montantConfidence = 0.85;
  } else if (montants.length === 1) {
    montant = montants[0];
    montantConfidence = 0.6;
  } else if (montants.length > 1) {
    montantIncertain = true;
    montantConfidence = 0.2;
  }

  let echeance: string | null = null;
  let echeanceTexte: string | null = null;
  let echeanceConfidence = 0;
  const absm = text.match(reDelayAbsolute);
  const relm = text.match(reDelayRelative);
  if (absm) {
    echeance = absm[1].replace(/[.-]/g, "/");
    echeanceTexte = absm[0].trim();
    echeanceConfidence = 0.75;
  } else if (relm) {
    const days = parseInt(relm[1] ?? relm[2], 10);
    echeanceTexte = relm[0].trim();
    if (dateDocument) {
      echeance = addDays(dateDocument, days);
      echeanceConfidence = dateConfidence >= 0.7 ? 0.7 : 0.3;
    } else {
      echeanceConfidence = 0.2;
    }
  }

  let reference: string | null = null;
  const refm = text.match(reReferenceLine);
  if (refm) {
    // The keyword itself (e.g. "dossier" preceding "Référence") can otherwise be re-captured as
    // the value under a case-insensitive regex — require the token to actually contain a digit.
    const tokens = refm[1].split(/\s+/);
    const withDigit = tokens.find((t) => /\d/.test(t) && /^[A-Z0-9\-\/]+$/i.test(t));
    if (withDigit) reference = withDigit;
  }

  const essentialScores = [
    sensConfidence,
    sens === "recue" ? expediteurConfidence : expediteurConfidence || destinataireConfidence,
    dateConfidence,
  ];
  const lowConfidenceCount = essentialScores.filter((s) => s < 0.5).length;
  const statut: "Nouveau" | "À vérifier" = lowConfidenceCount >= 2 || montantIncertain ? "À vérifier" : "Nouveau";

  return {
    expediteur,
    destinataire,
    sens,
    motif,
    motifBrut,
    dateDocument,
    echeance,
    echeanceTexte,
    montant,
    montantIncertain,
    reference,
    confiance: {
      expediteur: expediteurConfidence,
      destinataire: destinataireConfidence,
      date: dateConfidence,
      motif: motifConfidence,
      montant: montantConfidence,
      echeance: echeanceConfidence,
      sens: sensConfidence,
    },
    statut,
  };
}
