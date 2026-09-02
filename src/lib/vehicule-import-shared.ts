// ---------------------------------------------------------------------------
// Pure/client-safe helpers for the vehicule Excel import feature (no prisma,
// no exceljs) — kept separate from `vehicule-import.ts` so the mapping UI can
// import this module directly in a client component without bundling prisma.
//
// Fields kept strictly in sync with the real `Vehicule` model
// (prisma/schema.prisma). Do NOT add fields here that don't exist on the
// model (e.g. there is no dedicated VIN column today, only `numCarteGrise`).
// ---------------------------------------------------------------------------
export type VehiculeImportField =
  | "code"
  | "immatriculation"
  | "marque"
  | "modele"
  | "typeVehicule"
  | "datePremiereImmat"
  | "dateAcquisition"
  | "numCarteGrise"
  | "ptac"
  | "service"
  | "statut"
  | "dateControleTech"
  | "assuranceNum"
  | "observations"
  | "societe"
  | "conducteur";

export const FIELD_LABELS: Record<VehiculeImportField, string> = {
  code: "Code véhicule",
  immatriculation: "Immatriculation",
  marque: "Marque",
  modele: "Modèle",
  typeVehicule: "Type",
  datePremiereImmat: "Date 1ère immatriculation",
  dateAcquisition: "Date d'acquisition",
  numCarteGrise: "N° Carte grise",
  ptac: "PTAC (kg)",
  service: "Service",
  statut: "Statut",
  dateControleTech: "Date contrôle technique",
  assuranceNum: "N° Assurance",
  observations: "Observations",
  societe: "Société",
  conducteur: "Conducteur",
};

// Order used for the downloadable template and the mapping UI.
export const TEMPLATE_FIELDS: VehiculeImportField[] = [
  "immatriculation",
  "code",
  "marque",
  "modele",
  "typeVehicule",
  "societe",
  "conducteur",
  "datePremiereImmat",
  "dateAcquisition",
  "numCarteGrise",
  "ptac",
  "service",
  "statut",
  "dateControleTech",
  "assuranceNum",
  "observations",
];

const FIELD_ALIASES: Record<VehiculeImportField, string[]> = {
  immatriculation: [
    "immatriculation", "immat", "plaque", "plaque immatriculation", "plaque vehicule",
    "n immatriculation", "no immatriculation", "numero immatriculation", "registration", "plate", "license plate",
  ],
  code: ["code", "code vehicule", "id vehicule", "identifiant", "reference", "ref"],
  marque: ["marque", "brand", "constructeur"],
  modele: ["modele", "model"],
  typeVehicule: ["type", "type vehicule", "categorie", "category", "genre"],
  societe: ["societe", "entreprise", "company", "client", "filiale"],
  conducteur: ["conducteur", "chauffeur", "driver", "conducteur attitre"],
  datePremiereImmat: [
    "date premiere immatriculation", "date 1ere immatriculation", "date mise en circulation",
    "1ere immatriculation", "date immatriculation", "mise en circulation",
  ],
  dateAcquisition: ["date acquisition", "date achat", "acquisition"],
  numCarteGrise: [
    "carte grise", "numero carte grise", "n carte grise", "no carte grise",
    "certificat immatriculation", "n certificat immatriculation",
  ],
  ptac: ["ptac", "poids total autorise en charge", "ptac kg"],
  service: ["service", "departement", "site", "affectation"],
  statut: ["statut", "etat", "status"],
  dateControleTech: ["date controle technique", "controle technique", "ct", "prochain controle technique"],
  assuranceNum: ["assurance", "numero assurance", "n assurance", "no assurance", "police assurance", "n police assurance"],
  observations: ["observations", "remarques", "notes", "commentaire", "commentaires"],
};

/** Lowercases, strips accents/punctuation, collapses spaces — used to fuzzy-match column headers. */
export function normalizeHeaderText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Attempts to auto-detect which known field each Excel column header corresponds to. */
export function autoMapHeaders(headers: string[]): Record<number, VehiculeImportField | null> {
  const mapping: Record<number, VehiculeImportField | null> = {};
  const used = new Set<VehiculeImportField>();

  headers.forEach((header, idx) => {
    const normalized = normalizeHeaderText(header);
    if (!normalized) {
      mapping[idx] = null;
      return;
    }
    let found: VehiculeImportField | null = null;
    for (const field of TEMPLATE_FIELDS) {
      if (used.has(field)) continue;
      const aliases = FIELD_ALIASES[field];
      const match = aliases.some((alias) => normalized === alias || normalized.includes(alias) || alias.includes(normalized));
      if (match) {
        found = field;
        break;
      }
    }
    if (found) used.add(found);
    mapping[idx] = found;
  });

  return mapping;
}

/**
 * Normalizes a French registration plate to the modern SIV format (AA-123-AA) when recognized.
 * Falls back to an uppercased/trimmed value for older formats (kept compatible, not rewritten).
 */
export function normalizeImmatriculation(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  const compact = cleaned.replace(/[\s\-.]/g, "");
  const sivMatch = compact.match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/);
  if (sivMatch) return `${sivMatch[1]}-${sivMatch[2]}-${sivMatch[3]}`;
  // Old FNI format (until 2009): 1-4 digits, 1-3 letters, 2-3 digits (dept) — keep spaced, not dashed.
  const fniMatch = compact.match(/^(\d{1,4})([A-Z]{1,3})(\d{2,3})$/);
  if (fniMatch) return `${fniMatch[1]} ${fniMatch[2]} ${fniMatch[3]}`;
  return cleaned;
}

export type PreviewRowStatus = "ready" | "duplicate" | "warning" | "error";

export type PreviewRow = {
  index: number;
  raw: Record<string, string>;
  data: Partial<Record<Exclude<VehiculeImportField, "societe" | "conducteur">, string>>;
  societeInput: string | null;
  societeResolved: string | null;
  societeStatus: "matched" | "default" | "unverified";
  conducteurInput: string | null;
  conducteurResolvedId: string | null;
  conducteurCandidates: { id: string; label: string }[];
  conducteurStatus: "matched" | "ambiguous" | "none" | "not-applicable";
  duplicate: { id: string; code: string; marque: string | null; modele: string | null } | null;
  status: PreviewRowStatus;
  issues: string[];
};

export type PreviewSummary = { total: number; ready: number; duplicates: number; warnings: number; errors: number };
