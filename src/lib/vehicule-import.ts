import ExcelJS from "exceljs";
import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import {
  VehiculeImportField,
  FIELD_LABELS,
  TEMPLATE_FIELDS,
  normalizeHeaderText,
  normalizeImmatriculation,
  PreviewRow,
  PreviewRowStatus,
  PreviewSummary,
} from "@/lib/vehicule-import-shared";

// Server-only (prisma/exceljs) import logic. Pure/client-safe helpers (types, field labels,
// header fuzzy-matching, plate normalization) live in `vehicule-import-shared.ts` and are
// re-exported here for convenience so existing server-side callers don't need two imports.
export * from "@/lib/vehicule-import-shared";

export type ParsedSheet = { headers: string[]; rows: string[][] };

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${value.getFullYear()}`;
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellToString((value as { result: ExcelJS.CellValue }).result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join("");
    }
    return "";
  }
  return String(value).trim();
}

/** Parses an uploaded .xlsx/.csv file into a plain headers+rows structure. Legacy .xls (binary) is not supported by the underlying library. */
export async function parseUploadedFile(buffer: Buffer, filename: string): Promise<ParsedSheet> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "xls") {
    throw new Error("Le format .xls (Excel 97-2003) n'est pas pris en charge. Merci d'enregistrer le fichier au format .xlsx ou .csv.");
  }

  const workbook = new ExcelJS.Workbook();
  let worksheet: ExcelJS.Worksheet | undefined;

  if (ext === "csv") {
    worksheet = await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    worksheet = workbook.worksheets[0];
  }
  if (!worksheet) throw new Error("Impossible de lire le fichier : aucune feuille trouvée.");

  const allRows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[]; // index 0 is unused by ExcelJS
    const cells = values.slice(1).map((v) => cellToString(v));
    allRows.push(cells);
  });
  if (allRows.length === 0) throw new Error("Le fichier est vide.");

  const headers = allRows[0];
  const rows = allRows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  return { headers, rows };
}

const norm = (s: string) => normalizeHeaderText(s);

/**
 * Recomputes the full import preview (mapping applied, duplicates, société/conducteur matching)
 * for a set of raw rows. Batches all DB lookups (no per-cell/per-row query) for performance.
 */
export async function buildPreview({
  headers,
  rows,
  mapping,
  sessionSociete,
  isAdmin,
}: {
  headers: string[];
  rows: string[][];
  mapping: Record<number, VehiculeImportField | null>;
  sessionSociete: string;
  isAdmin: boolean;
}): Promise<{ rows: PreviewRow[]; summary: PreviewSummary; availableSocietes: string[]; conducteursBySociete: Record<string, { id: string; label: string }[]> }> {
  const fieldToIndex = new Map<VehiculeImportField, number>();
  Object.entries(mapping).forEach(([idx, field]) => {
    if (field) fieldToIndex.set(field, Number(idx));
  });

  const getRaw = (row: string[], field: VehiculeImportField): string | null => {
    const idx = fieldToIndex.get(field);
    if (idx === undefined) return null;
    const v = row[idx];
    return v && v.trim() !== "" ? v.trim() : null;
  };

  // --- Pass 1: build candidate data + resolve société per row (no DB yet) ---
  const allSocietes = await prisma.societe.findMany({ select: { nom: true } });
  const societeByNorm = new Map(allSocietes.map((s) => [norm(s.nom), s.nom]));

  type Interim = Omit<PreviewRow, "duplicate" | "conducteurResolvedId" | "conducteurCandidates" | "conducteurStatus" | "status" | "issues"> & { issues: string[] };
  const interim: Interim[] = rows.map((row, index) => {
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => { raw[h] = row[i] ?? ""; });

    const issues: string[] = [];
    const immatRaw = getRaw(row, "immatriculation");
    const data: PreviewRow["data"] = {};
    if (immatRaw) data.immatriculation = normalizeImmatriculation(immatRaw);
    else issues.push("Immatriculation manquante");

    const code = getRaw(row, "code");
    if (code) data.code = code;
    const marque = getRaw(row, "marque"); if (marque) data.marque = marque;
    const modele = getRaw(row, "modele"); if (modele) data.modele = modele;
    const typeVehicule = getRaw(row, "typeVehicule"); if (typeVehicule) data.typeVehicule = typeVehicule;
    const datePremiereImmat = getRaw(row, "datePremiereImmat"); if (datePremiereImmat) data.datePremiereImmat = datePremiereImmat;
    const dateAcquisition = getRaw(row, "dateAcquisition"); if (dateAcquisition) data.dateAcquisition = dateAcquisition;
    const numCarteGrise = getRaw(row, "numCarteGrise"); if (numCarteGrise) data.numCarteGrise = numCarteGrise;
    const ptacRaw = getRaw(row, "ptac");
    if (ptacRaw) {
      const n = parseInt(ptacRaw.replace(/[^\d]/g, ""), 10);
      if (!Number.isNaN(n)) data.ptac = String(n);
      else issues.push(`PTAC non numérique ignoré ("${ptacRaw}")`);
    }
    const service = getRaw(row, "service"); if (service) data.service = service;
    const statut = getRaw(row, "statut"); if (statut) data.statut = statut;
    const dateControleTech = getRaw(row, "dateControleTech"); if (dateControleTech) data.dateControleTech = dateControleTech;
    const assuranceNum = getRaw(row, "assuranceNum"); if (assuranceNum) data.assuranceNum = assuranceNum;
    const observations = getRaw(row, "observations"); if (observations) data.observations = observations;

    const societeInput = getRaw(row, "societe");
    let societeResolved: string | null;
    let societeStatus: PreviewRow["societeStatus"];
    if (!isAdmin) {
      // Non-admin accounts are always scoped to their own société — never trust the file here.
      societeResolved = sessionSociete;
      societeStatus = "default";
      if (societeInput && norm(societeInput) !== norm(sessionSociete)) {
        issues.push(`Société "${societeInput}" ignorée (hors de votre périmètre) — rattaché à ${sessionSociete}`);
      }
    } else if (societeInput) {
      const match = societeByNorm.get(norm(societeInput));
      if (match) {
        societeResolved = match;
        societeStatus = "matched";
      } else {
        societeResolved = null;
        societeStatus = "unverified";
        issues.push(`Société inconnue : "${societeInput}" — à vérifier`);
      }
    } else {
      societeResolved = sessionSociete;
      societeStatus = "default";
    }

    const conducteurInput = getRaw(row, "conducteur");

    return { index, raw, data, societeInput, societeResolved, societeStatus, conducteurInput, issues };
  });

  // --- Batch fetch existing vehicules (duplicate check) across all resolved (societe, immat) pairs ---
  const pairs = interim
    .filter((r) => r.societeResolved && r.data.immatriculation)
    .map((r) => ({ societe: r.societeResolved as string, immatriculation: r.data.immatriculation as string }));
  const existingVehicules = pairs.length
    ? await prisma.vehicule.findMany({
        where: { OR: pairs.map((p) => ({ societe: p.societe, immatriculation: p.immatriculation })) },
        select: { id: true, code: true, societe: true, immatriculation: true, marque: true, modele: true },
      })
    : [];
  const existingByKey = new Map(existingVehicules.map((v) => [`${v.societe}::${v.immatriculation}`, v]));

  // --- Batch fetch conducteurs for every distinct société encountered ---
  const distinctSocietes = Array.from(new Set(interim.map((r) => r.societeResolved).filter(Boolean))) as string[];
  const conducteurs = distinctSocietes.length
    ? await prisma.conducteur.findMany({
        where: { societe: { in: distinctSocietes } },
        select: { id: true, societe: true, nom: true, prenom: true },
      })
    : [];
  const conducteursBySociete: Record<string, { id: string; label: string }[]> = {};
  for (const societe of distinctSocietes) conducteursBySociete[societe] = [];
  for (const c of conducteurs) {
    conducteursBySociete[c.societe]?.push({ id: c.id, label: `${c.prenom} ${c.nom}` });
  }

  const previewRows: PreviewRow[] = interim.map((r) => {
    const issues = [...r.issues];
    let duplicate: PreviewRow["duplicate"] = null;
    if (r.societeResolved && r.data.immatriculation) {
      const existing = existingByKey.get(`${r.societeResolved}::${r.data.immatriculation}`);
      if (existing) duplicate = { id: existing.id, code: existing.code, marque: existing.marque, modele: existing.modele };
    }

    let conducteurResolvedId: string | null = null;
    let conducteurStatus: PreviewRow["conducteurStatus"] = "not-applicable";
    let conducteurCandidates: { id: string; label: string }[] = [];
    if (r.societeResolved) {
      conducteurCandidates = conducteursBySociete[r.societeResolved] ?? [];
      if (r.conducteurInput) {
        const wanted = norm(r.conducteurInput);
        const matches = conducteurCandidates.filter((c) => {
          const label = norm(c.label);
          const parts = label.split(" ");
          return label === wanted || wanted.split(" ").every((w) => parts.includes(w)) || label.includes(wanted) || wanted.includes(label);
        });
        if (matches.length === 1) {
          conducteurResolvedId = matches[0].id;
          conducteurStatus = "matched";
        } else if (matches.length > 1) {
          conducteurStatus = "ambiguous";
          issues.push(`Conducteur ambigu ("${r.conducteurInput}" correspond à ${matches.length} conducteurs) — à vérifier`);
        } else {
          conducteurStatus = "none";
          issues.push(`Conducteur "${r.conducteurInput}" introuvable — véhicule importé sans conducteur`);
        }
      }
    } else if (r.conducteurInput) {
      issues.push("Conducteur non résolu (société à vérifier)");
    }

    let status: PreviewRowStatus;
    if (!r.data.immatriculation) status = "error";
    else if (duplicate) status = "duplicate";
    else if (r.societeStatus === "unverified" || conducteurStatus === "ambiguous") status = "warning";
    else status = "ready";

    return {
      index: r.index,
      raw: r.raw,
      data: r.data,
      societeInput: r.societeInput,
      societeResolved: r.societeResolved,
      societeStatus: r.societeStatus,
      conducteurInput: r.conducteurInput,
      conducteurResolvedId,
      conducteurCandidates,
      conducteurStatus,
      duplicate,
      status,
      issues,
    };
  });

  const summary: PreviewSummary = {
    total: previewRows.length,
    ready: previewRows.filter((r) => r.status === "ready").length,
    duplicates: previewRows.filter((r) => r.status === "duplicate").length,
    warnings: previewRows.filter((r) => r.status === "warning").length,
    errors: previewRows.filter((r) => r.status === "error").length,
  };

  return { rows: previewRows, summary, availableSocietes: allSocietes.map((s) => s.nom), conducteursBySociete };
}

/** Generates a blank .xlsx template with the correct, current Vehicule columns. */
export async function buildImportTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Véhicules");
  ws.columns = TEMPLATE_FIELDS.map((f) => ({ header: FIELD_LABELS[f], key: f, width: 22 }));
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 22;
  ws.addRow({ immatriculation: "AB-123-CD", marque: "Renault", modele: "Trafic", statut: "En service" });
  return wb.xlsx.writeBuffer();
}
