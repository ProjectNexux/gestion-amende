/**
 * Heuristic (pattern-based, not ML) extractor for "permis de conduire" and "carte d'identité"
 * documents, in the same spirit as fine-parser.ts / sinistre-parser.ts. Never invents a value: a
 * field that cannot be found stays null.
 */

export type ParsedPermis = {
  numPermis: string | null;
  dateDelivrance: string | null; // dd/mm/yyyy
  dateExpiration: string | null; // dd/mm/yyyy
};

export type ParsedCarteIdentite = {
  numCarteIdentite: string | null;
  dateDelivrance: string | null; // dd/mm/yyyy
  dateExpiration: string | null; // dd/mm/yyyy
};

const reDateGeneric = /\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/g;
const reDelivrance = /d[ée]livr[ée]e?\s+le\s*[:#]?\s*(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i;
const reExpiration = /(?:valable\s+jusqu[''’]au|expire\s+le|date\s+d[''’]expiration)\s*[:#]?\s*(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i;
const reNumPermis = /(?:permis\s+n[°ºo]?|num[ée]ro\s+de\s+permis)\s*[:#]?\s*([0-9]{6,15})/i;
const reNumCni = /(?:carte\s+d[''’]identit[ée]\s+n[°ºo]?|n[°ºo]?\s*(?:de\s+)?(?:la\s+)?carte)\s*[:#]?\s*([A-Z0-9]{6,15})/i;

function normalize(s: string): string {
  return s.replace(/\u00A0/g, " ").replace(/[\r\t]+/g, " ").replace(/ +/g, " ");
}

function toDate(s: string): string {
  return s.replace(/[.-]/g, "/");
}

export function parsePermisConduire(rawText: string): ParsedPermis {
  const text = normalize(rawText);
  const numMatch = text.match(reNumPermis);
  const delivranceMatch = text.match(reDelivrance);
  const expirationMatch = text.match(reExpiration);

  return {
    numPermis: numMatch ? numMatch[1] : null,
    dateDelivrance: delivranceMatch ? toDate(delivranceMatch[1]) : null,
    dateExpiration: expirationMatch ? toDate(expirationMatch[1]) : null,
  };
}

export function parseCarteIdentite(rawText: string): ParsedCarteIdentite {
  const text = normalize(rawText);
  const numMatch = text.match(reNumCni);
  const delivranceMatch = text.match(reDelivrance);
  const expirationMatch = text.match(reExpiration);

  // Fallback: no labeled expiration found — a CNI always prints its dates in chronological order
  // (naissance, délivrance, expiration), so the LAST date on the document is the best guess,
  // provided it isn't the same one already used as dateDelivrance.
  let dateExpiration = expirationMatch ? toDate(expirationMatch[1]) : null;
  if (!dateExpiration) {
    const dates = [...text.matchAll(reDateGeneric)].map((m) => `${m[1]}/${m[2]}/${m[3]}`);
    const last = dates[dates.length - 1];
    if (last && dates.length >= 2 && last !== delivranceMatch?.[1]?.replace(/[.-]/g, "/")) dateExpiration = last;
  }

  return {
    numCarteIdentite: numMatch ? numMatch[1] : null,
    dateDelivrance: delivranceMatch ? toDate(delivranceMatch[1]) : null,
    dateExpiration,
  };
}
