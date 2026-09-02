/**
 * Parseur d'avis de contravention français.
 * Extrait les champs depuis du texte brut OCR (Tesseract).
 *
 * Cible : avis ANTAI / amendes papier (excès vitesse, stationnement, péage, feu rouge, etc.)
 */

export type ParsedFine = {
  numAvis?: string;
  dateReceptionAvis?: string; // dd/mm/yyyy (date de l'avis / réception)
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
const reTelepaiement = /(?:n[°ºo]?\s*de\s*)?t[ée]l[ée]paiement\s*[:#]?\s*([0-9\s]{8,24})/i;
const reCleTelepaiement = /\bcl[ée]\s*[:#]?\s*(\d{2,3})\b/i;
const rePoints = /(\d)\s*point/i;

const natures: { pattern: RegExp; label: string }[] = [
  { pattern: /exc[èe]s\s+de\s+vitesse[^.\n]*(?:<\s*5\s*km)/i, label: "Excès de vitesse < 5 km/h" },
  { pattern: /exc[èe]s\s+de\s+vitesse[^.\n]*(?:<\s*20\s*km)/i, label: "Excès de vitesse < 20 km/h" },
  { pattern: /exc[èe]s\s+de\s+vitesse[^.\n]*(?:20\s*-\s*30)/i, label: "Excès de vitesse 20-30 km/h" },
  { pattern: /exc[èe]s\s+de\s+vitesse/i, label: "Excès de vitesse" },
  { pattern: /d[ée]passement\s+(?:de\s+)?la\s+vitesse\s+maximale/i, label: "Excès de vitesse" },
  { pattern: /vitesse\s+sup[ée]rieure/i, label: "Excès de vitesse" },
  { pattern: /stationnement\s+(?:tr[èe]s\s+)?g[êe]nant/i, label: "Stationnement gênant" },
  { pattern: /stationnement\s+(?:interdit|abusif|irr[ée]gulier)/i, label: "Stationnement interdit" },
  { pattern: /arr[êe]t\s+(?:ou\s+stationnement|interdit)/i, label: "Arrêt ou stationnement interdit" },
  { pattern: /feu\s+rouge/i, label: "Franchissement d'un feu rouge" },
  { pattern: /signal(?:isation)?\s+(?:d[''']?arr[êe]t|stop)/i, label: "Non-respect d'un stop" },
  { pattern: /ligne\s+continue/i, label: "Franchissement d'une ligne continue" },
  { pattern: /non[-\s]paiement\s+du\s+p[ée]age|refus.*p[ée]age/i, label: "Non-paiement du péage" },
  { pattern: /voie\s+r[ée]serv[ée]e/i, label: "Circulation sur voie réservée" },
  { pattern: /plaque.*illisible/i, label: "Plaque d'immatriculation illisible" },
  { pattern: /non\s+d[ée]signation/i, label: "Non désignation d'une personne physique" },
  { pattern: /t[ée]l[ée]phone|portable\s+(?:en\s+)?main/i, label: "Usage du téléphone au volant" },
  { pattern: /ceinture\s+de\s+s[ée]curit[ée]/i, label: "Non-port de la ceinture" },
  { pattern: /distance\s+(?:de\s+)?s[ée]curit[ée]/i, label: "Non-respect des distances de sécurité" },
  { pattern: /sens\s+interdit/i, label: "Circulation en sens interdit" },
  { pattern: /priorit[ée]/i, label: "Non-respect de la priorité" },
  { pattern: /d[ée]passement\s+dangereux/i, label: "Dépassement dangereux" },
  { pattern: /contr[ôo]le\s+technique/i, label: "Défaut de contrôle technique" },
  { pattern: /assurance/i, label: "Défaut d'assurance" },
];

// Phrases parasites souvent captées par OCR au lieu de la vraie infraction
const NATURE_NOISE = [
  /personne\s+morale/i,
  /repr[ée]sentant.*l[ée]gal/i,
  /titulaire\s+du\s+certificat/i,
  /avec\s+un\s+v[ée]hicule\s+de/i,
  /est\s+redevable/i,
  /vous\s+[êe]tes\s+(?:pri[ée]|invit[ée])/i,
  /amende\s+forfaitaire/i,
  /pr[ée]vu\s+(?:par|et\s+r[ée]prim[ée])/i,
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

/** Exported for reuse by the manual-import certificat-d'immatriculation classification (document-import.ts). */
export function findImmat(text: string): string | undefined {
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

  // Cas ANTAI / carte de paiement : "Date de l'avis"
  const dateAvis = text.match(/date\s+de\s+l[''']?avis[^\d]{0,20}(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i);
  if (dateAvis) {
    result.dateReceptionAvis = dateAvis[1].replace(/[.-]/g, "/");
  }

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

  // Fallback : chercher la ligne contenant "infraction", "contravention" ou "article" avec le libellé réel
  if (!result.natureInfraction) {
    const naturePatterns = [
      /(?:infraction|contravention)\s*[:\-–]?\s*([^\n]{10,120})/i,
      /(?:nature|motif)\s*[:\-–]?\s*([^\n]{10,120})/i,
      /(?:article\s+R?\d[\d\-\.]*[^\n]{0,10})\s*[:\-–]?\s*([^\n]{10,100})/i,
    ];
    for (const re of naturePatterns) {
      const m = text.match(re);
      if (m) {
        let candidate = m[1].trim();
        // Nettoyer : couper après un point ou un retour
        candidate = candidate.split(/[.\n]/)[0].trim();
        // Vérifier que ce n'est pas du bruit
        const isNoise = NATURE_NOISE.some((noise) => noise.test(candidate));
        if (!isNoise && candidate.length > 5 && candidate.length < 120) {
          result.natureInfraction = candidate;
          break;
        }
      }
    }
  }

  // Dernier recours : chercher un article du code de la route
  if (!result.natureInfraction) {
    const articleMatch = text.match(/(?:article|art\.?)\s+(R?\.?\s*\d[\d\-\.]*(?:\s*(?:du\s+)?(?:code|CR|C\.?\s*route))?[^\n]{0,60})/i);
    if (articleMatch) {
      const candidate = articleMatch[1].trim().split(/[.\n]/)[0].trim();
      const isNoise = NATURE_NOISE.some((noise) => noise.test(candidate));
      if (!isNoise && candidate.length > 3) {
        result.natureInfraction = `Art. ${candidate}`;
      }
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

  // Fallback ANTAI : n° de télépaiement (+ clé) si le n° avis n'a pas été trouvé.
  if (!result.numAvis) {
    const tele = text.match(reTelepaiement);
    if (tele) {
      const teleNum = tele[1].replace(/\s+/g, "").trim();
      const cle = text.match(reCleTelepaiement)?.[1];
      result.numAvis = cle ? `${teleNum}-${cle}` : teleNum;
    }
  }

  // Lieu : ligne contenant "lieu" ou "commise" ou route nationale/autoroute
  const lieuPatterns = [
    /(?:lieu\s+(?:de\s+l[''']?)?(?:infraction|commission))[^A-Za-z0-9]{1,5}([^\n]{5,80})/i,
    /(?:commise\s+[àa]|commise\s+sur|commise)[^A-Za-z0-9]{1,5}([^\n]{5,80})/i,
    /(?:lieu)[^A-Za-z0-9]{1,5}([^\n]{5,80})/i,
  ];
  for (const re of lieuPatterns) {
    const m = text.match(re);
    if (m) {
      let candidate = m[1].trim().split(/\s{2,}/)[0];
      const isNoise = NATURE_NOISE.some((noise) => noise.test(candidate));
      if (!isNoise && candidate.length > 3) {
        result.lieuInfraction = candidate;
        break;
      }
    }
  }
  if (!result.lieuInfraction) {
    const routeM = text.match(/\b(A\d{1,3}|N\d{1,3}|D\d{1,3}|RD\d{1,3}|RN\d{1,3})\b[^\n]{0,80}/);
    if (routeM) result.lieuInfraction = routeM[0].trim();
  }

  return result;
}
