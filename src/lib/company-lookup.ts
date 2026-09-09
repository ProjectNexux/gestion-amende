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

export type CompanyLookupErrorCode =
  | "invalid_siret"
  | "api_unavailable"
  | "rate_limited"
  | "invalid_response"
  | "unexpected";

export class CompanyLookupError extends Error {
  constructor(
    public readonly code: CompanyLookupErrorCode,
    public readonly retryable: boolean,
    message: string,
    public readonly status: number = 503,
  ) {
    super(message);
    this.name = "CompanyLookupError";
  }
}

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
  const parts = [e.numero_voie, e.type_voie, e.libelle_voie].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (!e.adresse) return null;
  return e.adresse.replace(/\s+\d{5}\s+\S.*$/u, "").trim() || e.adresse;
}

function computeFrenchVatNumber(siren: string): string | null {
  if (!/^\d{9}$/.test(siren)) return null;
  const key = (12 + 3 * (parseInt(siren, 10) % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${siren}`;
}

export async function lookupCompanyBySiret(siret: string): Promise<CompanyLookupResult | null> {
  const clean = normalizeSiret(siret);
  if (!clean) {
    throw new CompanyLookupError("invalid_siret", false, "Merci de saisir un SIRET.", 400);
  }
  if (clean.length !== 14) {
    throw new CompanyLookupError("invalid_siret", false, "Le SIRET doit contenir exactement 14 chiffres.", 400);
  }

  const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(clean)}&per_page=1`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 0 } });
  } catch (error) {
    console.error("[company-lookup] fetch failed", { siret: clean, error });
    throw new CompanyLookupError(
      "api_unavailable",
      true,
      "La recherche automatique est temporairement indisponible.",
      503,
    );
  }

  if (response.status === 429) {
    console.error("[company-lookup] rate limited", { siret: clean, status: response.status });
    throw new CompanyLookupError(
      "rate_limited",
      true,
      "La recherche automatique est momentanément limitée. Merci de réessayer dans quelques instants.",
      429,
    );
  }

  if (response.status >= 500) {
    console.error("[company-lookup] upstream 5xx", { siret: clean, status: response.status });
    throw new CompanyLookupError("api_unavailable", true, "La recherche automatique est temporairement indisponible.", response.status);
  }

  if (!response.ok) {
    console.error("[company-lookup] unexpected upstream status", { siret: clean, status: response.status });
    throw new CompanyLookupError("api_unavailable", true, "La recherche automatique est temporairement indisponible.", response.status || 503);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    console.error("[company-lookup] invalid JSON payload", { siret: clean, error });
    throw new CompanyLookupError("invalid_response", true, "La recherche automatique a renvoyé une réponse invalide.", 502);
  }

  if (!json || typeof json !== "object" || !Array.isArray((json as { results?: unknown[] }).results)) {
    console.error("[company-lookup] unexpected response shape", { siret: clean, payload: json });
    throw new CompanyLookupError("invalid_response", true, "La recherche automatique a renvoyé une réponse invalide.", 502);
  }

  const payload = json as { results?: ResultApi[] };
  const first = payload.results?.[0];
  if (!first) return null;

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
