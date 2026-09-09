import { normalizeSiret } from "@/lib/siret";

/**
 * Public French company data via the "Recherche d'entreprises" API (annuaire-entreprises.data.gouv.fr).
 * No auth, no rate-limit for reasonable use — the official government-run endpoint replacing the
 * old Sirene download service for lookup use cases.
 *
 * Docs: https://recherche-entreprises.api.gouv.fr/docs
 */

export type CompanyLookupResult = {
  siret: string;
  siren: string;
  companyName: string;
  tradeName: string | null;
  legalForm: string | null;
  nafCode: string | null;
  activityLabel: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  isActive: boolean;
  createdAt: string | null; // dd/mm/yyyy
  dirigeants: Array<{ nom: string | null; prenom: string | null; fonction: string | null }>;
};

// The API returns a wrapped shape { results: [{ siege, matching_etablissements, ... }] }. Only the
// fields we actually use are typed — the rest is `unknown` on purpose (never trust the whole shape).
type EtablissementApi = {
  siret?: string;
  activite_principale?: string;
  libelle_activite_principale?: string;
  adresse?: string;
  numero_voie?: string;
  type_voie?: string;
  libelle_voie?: string;
  complement_adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  etat_administratif?: string;
  date_creation?: string;
};

type ResultApi = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  denomination_usuelle?: string;
  nature_juridique?: string;
  categorie_entreprise?: string;
  activite_principale?: string;
  libelle_activite_principale?: string;
  date_creation?: string;
  siege?: EtablissementApi;
  matching_etablissements?: EtablissementApi[];
  dirigeants?: Array<{ nom?: string; prenoms?: string; qualite?: string }>;
};

function buildAddressLine1(e: EtablissementApi | undefined): string | null {
  if (!e) return null;
  // Prefer the structured parts when available (cleaner than the concatenated `adresse` field,
  // which usually already contains "<code postal> <ville>" appended and would then duplicate the
  // postalCode/city columns we store separately).
  const parts = [e.numero_voie, e.type_voie, e.libelle_voie].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (!e.adresse) return null;
  // Fallback: strip a trailing "<5 digits> <city>" from the flat `adresse` field.
  return e.adresse.replace(/\s+\d{5}\s+\S.*$/u, "").trim() || e.adresse;
}

// The SIREN prefix "FR" + a checksum computed from the SIREN. This exact formula is the official
// French Business Register rule (bulletin officiel des impôts) — no external call needed.
function computeFrenchVatNumber(siren: string): string | null {
  if (!/^\d{9}$/.test(siren)) return null;
  const key = (12 + 3 * (parseInt(siren, 10) % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${siren}`;
}

export async function lookupCompanyBySiret(siret: string): Promise<CompanyLookupResult | null> {
  const clean = normalizeSiret(siret);
  if (clean.length !== 14) return null;

  const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(clean)}&per_page=1`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 0 } });
  } catch {
    throw new Error("La recherche automatique est temporairement indisponible.");
  }
  if (!response.ok) throw new Error("La recherche automatique est temporairement indisponible.");

  const json = (await response.json()) as { results?: ResultApi[] };
  const first = json.results?.[0];
  if (!first) return null;

  // The lookup was by SIRET; pick the exact matching établissement rather than the siège when they
  // differ (a query by a secondary établissement's SIRET must return that établissement's address).
  const matching = first.matching_etablissements?.find((e) => e.siret && normalizeSiret(e.siret) === clean);
  const etab = matching ?? first.siege;

  const siren = first.siren ?? clean.slice(0, 9);
  const nafCode = etab?.activite_principale ?? first.activite_principale ?? null;
  const activityLabel = etab?.libelle_activite_principale ?? first.libelle_activite_principale ?? null;

  return {
    siret: clean,
    siren,
    companyName: first.nom_raison_sociale ?? first.nom_complet ?? clean,
    tradeName: first.denomination_usuelle ?? null,
    legalForm: first.nature_juridique ?? null,
    nafCode,
    activityLabel,
    vatNumber: computeFrenchVatNumber(siren),
    addressLine1: buildAddressLine1(etab),
    addressLine2: etab?.complement_adresse ?? null,
    postalCode: etab?.code_postal ?? null,
    city: etab?.libelle_commune ?? null,
    country: "France",
    isActive: (etab?.etat_administratif ?? "A") === "A",
    createdAt: etab?.date_creation ?? first.date_creation ?? null,
    dirigeants: (first.dirigeants ?? []).map((d) => ({
      nom: d.nom ?? null,
      prenom: d.prenoms ?? null,
      fonction: d.qualite ?? null,
    })),
  };
}
