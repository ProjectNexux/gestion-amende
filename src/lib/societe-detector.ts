/**
 * Detects which known société (client) a scanned document is addressed to / concerns, by
 * looking for a real word-boundary mention of its name in the OCR text — never a fuzzy/guessed
 * match. Longer, more specific names are checked first so a short name (e.g. an acronym) can't
 * be shadowed by a coincidental substring of a longer one, and so that the more specific match
 * wins when a document happens to mention two known names.
 */
export function detectDestinataireSociete(text: string, societeNames: string[]): string | null {
  const lower = text.toLowerCase();
  const candidates = societeNames.filter((n) => n.trim().length > 0).sort((a, b) => b.length - a.length);

  for (const nom of candidates) {
    const escaped = nom.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^a-z0-9à-ÿ])${escaped}(?:[^a-z0-9à-ÿ]|$)`, "i");
    if (re.test(lower)) return nom;
  }
  return null;
}
