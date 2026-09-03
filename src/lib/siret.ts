/**
 * SIRET normalization + validation. Purely pure functions, no I/O.
 * A SIRET is 14 digits (SIREN = first 9 + NIC = last 5).
 */

export function normalizeSiret(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function formatSiret(siret: string): string {
  const n = normalizeSiret(siret);
  if (n.length !== 14) return siret;
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`;
}

/**
 * Full SIRET check: exactly 14 digits. The Luhn checksum is not enforced here because the
 * official French Business Register has real exceptions (La Poste, certain public-sector
 * établissements) and the `recherche-entreprises.api.gouv.fr` API is anyway the authoritative
 * source of truth on whether a SIRET really exists. A 14-digit syntax check + successful API
 * lookup is the strong guarantee we actually need.
 */
export function isValidSiret(siret: string): boolean {
  return /^\d{14}$/.test(normalizeSiret(siret));
}

export function siretToSiren(siret: string): string {
  return normalizeSiret(siret).slice(0, 9);
}
