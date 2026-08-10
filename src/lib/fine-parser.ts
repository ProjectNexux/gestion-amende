/**
 * Parseur d'avis de contravention français.
 * Extrait les champs depuis du texte brut OCR (Tesseract).
 *
 * Cible : avis ANTAI / amendes papier (excès vitesse, stationnement, péage, feu rouge, etc.)
 */

export type ParsedFine = {
  numAvis?: string;
  dateInfraction?: string; // dd/mm/yyyy
  heureInfraction?: string; // HH:MM
  immatriculation?: string;
  immatriculationRaw?: string;
  immatriculationSuggestions?: string[];
  natureInfraction?: string;
  lieuInfraction?: string;
  vitesseConstatee?: number;
  vitesseAutorisee?: number;
  montantAmende?: number;
  dateLimitePaiement?: string;
  pointsRetires?: number;
};

// Normalise les caractères OCR (O→0, l→1, etc. sur les zones numériques)
function normalize(s: string) {
  return s
    .replace(/\u00A0/g, " ")
    .replace(/[\r\t]+/g, " ")
    .replace(/ +/g, " ");
}

const reImmat = /([A-Z]{2})[\s\-–—·.]{0,2}(\d{3})[\s\-–—·.]{0,2}([A-Z]{2})/gi;
const reDate = /\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/;
const reHeure = /\b(\d{1,2})[hH:](\d{2})\b/;
const reMontant = /(\d{1,4}(?:[ .,]\d{3})*(?:[,.]\d{2})?)\s*€/;
const reVitesse = /(\d{2,3})\s*km\/?h/gi;
const reAvis = /(?:N[°ºo]?\s*(?:d[''']?avis|avis)\s*[:#]?\s*)([0-9A-Z\-\/]{8,})/i;
const reAvisFallback = /\b(\d{10,}(?:[-\d]{3,}){0,5})\b/;
const rePoints = /(\d)\s*point/i;

const natures: { pattern: RegExp; label: string }[] = [
  { pattern: /exc[èe]s\s+de\s+vitesse[^.\n]*(?:<\s*5\s*km)/i, label: "Excès de vitesse < 5 km/h" },
  { pattern: /exc[èe]s\s+de\s+vitesse[^.\n]*(?:<\s*20\s*km)/i, label: "Excès de vitesse < 20 km/h" },
  { pattern: /exc[èe]s\s+de\s+vitesse[^.\n]*(?:20\s*-\s*30)/i, label: "Excès de vitesse 20-30 km/h" },
  { pattern: /exc[èe]s\s+de\s+vitesse/i, label: "Excès de vitesse" },
  { pattern: /stationnement\s+(?:tr[èe]s\s+)?g[êe]nant/i, label: "Stationnement gênant" },
  { pattern: /feu\s+rouge/i, label: "Franchissement d'un feu rouge" },
  { pattern: /ligne\s+continue/i, label: "Franchissement d'une ligne continue" },
  { pattern: /non[-\s]paiement\s+du\s+p[ée]age|refus.*p[ée]age/i, label: "Non-paiement du péage" },
  { pattern: /voie\s+r[ée]serv[ée]e/i, label: "Circulation sur voie réservée" },
  { pattern: /plaque.*illisible/i, label: "Plaque d'immatriculation illisible" },
  { pattern: /non\s+d[ée]signation/i, label: "Non désignation d'une personne physique" },
];

// Mots qui ressemblent au format AA-000-AA mais ne sont PAS des plaques
const IMMAT_BLACKLIST = new Set([
  "PV", "ID", "OK", "KO", "AN", "PM",
]);

// Confusions OCR fréquentes : lettre <-> chiffre / lettre <-> lettre
const OCR_LETTER_EQUIV: Record<string, string[]> = {
  E: ["F", "T", "L", "B"],
  F: ["E", "P", "T"],
  T: ["E", "F", "I", "L", "7"],
  B: ["E", "8", "R", "P"],
  D: ["O", "Q", "P", "H"],
  H: ["N", "M", "K", "D", "R"],
  M: ["N", "H", "W"],
  N: ["M", "H", "R"],
  O: ["Q", "D", "0", "C", "G"],
  Q: ["O", "D", "0"],
  R: ["B", "P", "H", "K"],
  G: ["C", "O", "Q", "6"],
  C: ["G", "O", "Q"],
  I: ["1", "L", "T"],
  L: ["I", "T", "1"],
  S: ["5", "8"],
  Z: ["2", "7"],
  U: ["V", "Y"],
  V: ["U", "Y", "W"],
  W: ["V", "M"],
  K: ["H", "R", "X"],
  X: ["K", "Y"],
  Y: ["V", "X", "U"],
  A: ["4", "R"],
  P: ["R", "F", "B"],
  J: ["I", "1", "L"],
};
const OCR_DIGIT_EQUIV: Record<string, string[]> = {
  "0": ["O", "Q", "D", "8"],
  "1": ["I", "L", "T", "7"],
  "2": ["Z", "7"],
  "3": ["8", "5"],
  "4": ["A", "9"],
  "5": ["S", "3", "6"],
  "6": ["G", "5", "8", "0"],
  "7": ["T", "1", "Z"],
  "8": ["B", "3", "0", "6"],
  "9": ["4", "0"],
};

/** Distance pondérée tenant compte des confusions OCR. */
function ocrDistance(a: string, b: string): number {
  if (a.length !== b.length) return Math.abs(a.length - b.length) + 5;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const isDigit = /\d/.test(a[i]) || /\d/.test(b[i]);
    const equiv = isDigit ? OCR_DIGIT_EQUIV : OCR_LETTER_EQUIV;
    const list = equiv[a[i]] ?? [];
    d += list.includes(b[i]) ? 0.5 : 1;
  }
  return d;
}

/** Retourne la plaque connue la plus proche + alternatives ordonnées. */
export function rankKnownPlates(candidate: string, known: string[]): { plate: string; score: number }[] {
  const norm = candidate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return known
    .map((k) => ({ plate: k, score: ocrDistance(norm, k.toUpperCase().replace(/[^A-Z0-9]/g, "")) }))
    .sort((a, b) => a.score - b.score);
}

/**
 * Renvoie la plaque connue la plus proche si la confiance est suffisante.
 * - score ≤2  : confiance élevée, on accepte
 * - score ≤4  : on accepte uniquement si le 2ᵉ candidat est ≥2 plus loin (gain d'au moins 2)
 * - sinon       : on garde le candidat brut
 */
export function snapToKnownPlate(candidate: string, known: string[]): string {
  if (!known.length) return candidate;
  const ranked = rankKnownPlates(candidate, known);
  const best = ranked[0];
  const second = ranked[1];
  if (!best) return candidate;
  if (best.score <= 2) return best.plate;
  if (best.score <= 4 && second && second.score - best.score >= 2) return best.plate;
  return candidate;
}

function normalizeImmat(a: string, b: string, c: string): string {
  return `${a.toUpperCase()}-${b}-${c.toUpperCase()}`;
}

function findImmat(text: string): string | undefined {
  // 1) près d'un mot-clé prioritaire
  const labeled = text.match(
    /(?:immatriculation|plaque|v[ée]hicule)[^A-Z0-9]{0,12}([A-Z]{2})[\s\-–—·.]{0,2}(\d{3})[\s\-–—·.]{0,2}([A-Z]{2})/i,
  );
  if (labeled) return normalizeImmat(labeled[1], labeled[2], labeled[3]);

  // 2) sinon, on parcourt toutes les occurrences et on garde la 1ère qui n'est pas blacklistée
  for (const m of text.matchAll(reImmat)) {
    const a = m[1].toUpperCase();
    const c = m[3].toUpperCase();
    if (IMMAT_BLACKLIST.has(a)) continue;
    // évite "PV-2024-XX" : le bloc central est typiquement 3 chiffres, donc OK,
    // mais on saute si le contexte avant contient "PV"/"dossier"/"avis"
    const start = m.index ?? 0;
    const before = text.slice(Math.max(0, start - 20), start).toLowerCase();
    if (/\b(pv|dossier|avis|n[°ºo])\b[^a-z0-9]{0,5}$/i.test(before)) continue;
    return normalizeImmat(a, m[2], c);
  }
  return undefined;
}

export function parseFine(rawText: string, knownPlates: string[] = []): ParsedFine {
  const text = normalize(rawText);
  const lower = text.toLowerCase();
  const result: ParsedFine = {};

  // Immatriculation : on cherche d'abord près d'un mot-clé, puis dans tout le texte.
  const detected = findImmat(text);
  if (detected) {
    const snapped = snapToKnownPlate(detected, knownPlates);
    result.immatriculation = snapped;
    result.immatriculationRaw = detected;
    if (snapped === detected && knownPlates.length) {
      // Aucun match fiable : propose les 3 plus proches
      result.immatriculationSuggestions = rankKnownPlates(detected, knownPlates)
        .slice(0, 3)
        .map((r) => r.plate);
    }
  }

  // Dates : on prend la 1ère après "date de l'infraction" si possible
  const dateLabels = [
    /date\s+(?:de\s+l[''']?\s*)?infraction[^\d]{0,30}(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i,
    /constat[ée][^\d]{0,30}(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i,
  ];
  for (const re of dateLabels) {
    const dm = text.match(re);
    if (dm) {
      result.dateInfraction = dm[1].replace(/[.-]/g, "/");
      break;
    }
  }
  if (!result.dateInfraction) {
    const all = text.match(reDate);
    if (all) result.dateInfraction = `${all[1]}/${all[2]}/${all[3]}`;
  }

  // Date limite paiement
  const dlim = text.match(/(?:limite|avant le|paiement avant)[^\d]{0,30}(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i);
  if (dlim) result.dateLimitePaiement = dlim[1].replace(/[.-]/g, "/");

  // Heure
  const hm = text.match(reHeure);
  if (hm) result.heureInfraction = `${hm[1].padStart(2, "0")}h${hm[2]}`;

  // Montant
  const mm = text.match(reMontant);
  if (mm) {
    const val = mm[1].replace(/[ .]/g, "").replace(",", ".");
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0 && n < 5000) result.montantAmende = n;
  }

  // Vitesse
  const vits: number[] = [];
  for (const vm of text.matchAll(reVitesse)) vits.push(parseInt(vm[1], 10));
  if (vits.length >= 2) {
    vits.sort((a, b) => a - b);
    result.vitesseAutorisee = vits[0];
    result.vitesseConstatee = vits[vits.length - 1];
  } else if (vits.length === 1) {
    result.vitesseConstatee = vits[0];
  }

  // Points retirés
  const pm = text.match(rePoints);
  if (pm) result.pointsRetires = parseInt(pm[1], 10);

  // Nature
  for (const n of natures) {
    if (n.pattern.test(lower)) {
      result.natureInfraction = n.label;
      break;
    }
  }

  // N° avis
  const am = text.match(reAvis);
  if (am) {
    result.numAvis = am[1];
  } else {
    const af = text.match(reAvisFallback);
    if (af) result.numAvis = af[1];
  }

  // Lieu : ligne contenant "lieu" ou "commise" ou route nationale/autoroute
  const lieuM = text.match(/(?:lieu|commise)[^A-Za-z0-9]{1,5}([^\n]{5,80})/i);
  if (lieuM) {
    result.lieuInfraction = lieuM[1].trim().split(/\s{2,}/)[0];
  } else {
    const routeM = text.match(/\b(A\d{1,3}|N\d{1,3}|D\d{1,3}|RD\d{1,3})\b[^\n]{0,80}/);
    if (routeM) result.lieuInfraction = routeM[0].trim();
  }

  return result;
}
