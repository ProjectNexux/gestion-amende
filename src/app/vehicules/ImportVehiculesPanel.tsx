"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, XCircle, Copy, ArrowRight, ArrowLeft } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  VehiculeImportField,
  FIELD_LABELS,
  TEMPLATE_FIELDS,
  PreviewRow,
  PreviewSummary,
} from "@/lib/vehicule-import-shared";

type Step = "select" | "mapping" | "preview" | "result";

type Overrides = Record<number, { societe?: string | null; conducteurId?: string | null; skip?: boolean }>;

type CommitResult = { created: number; updated: number; skippedDuplicates: number; rejected: { index: number; reason: string }[]; total: number };

const MAX_DISPLAYED_ROWS = 300;

export default function ImportVehiculesPanel() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, VehiculeImportField | null>>({});
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [availableSocietes, setAvailableSocietes] = useState<string[]>([]);
  const [conducteursBySociete, setConducteursBySociete] = useState<Record<string, { id: string; label: string }[]>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<"ignore" | "update">("ignore");
  const [overrides, setOverrides] = useState<Overrides>({});
  const [result, setResult] = useState<CommitResult | null>(null);

  function resetAll() {
    setStep("select");
    setError(null);
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setPreviewRows([]);
    setSummary(null);
    setOverrides({});
    setDuplicateStrategy("ignore");
    setResult(null);
  }

  function closeModal() {
    setOpen(false);
    resetAll();
  }

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/vehicules/import/parse", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Échec de la lecture du fichier.");
      setHeaders(json.headers);
      setRows(json.rows);
      setMapping(json.mapping);
      setPreviewRows(json.previewRows ?? []);
      setSummary(json.summary);
      setAvailableSocietes(json.availableSocietes ?? []);
      setConducteursBySociete(json.conducteursBySociete ?? {});
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function recomputePreview(newMapping: Record<number, VehiculeImportField | null>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vehicules/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, rows, mapping: newMapping }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Échec du calcul de la prévisualisation.");
      setPreviewRows(json.previewRows ?? []);
      setSummary(json.summary);
      setAvailableSocietes(json.availableSocietes ?? []);
      setConducteursBySociete(json.conducteursBySociete ?? {});
      setOverrides({});
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vehicules/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers,
          rows,
          mapping,
          duplicateStrategy,
          overrides,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Échec de l'import.");
      setResult(json);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  function downloadRejectedReport() {
    if (!result) return;
    const lines = ["Ligne;Motif", ...result.rejected.map((r) => `${r.index + 2};"${r.reason.replace(/"/g, '""')}"`)];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rapport_import_vehicules.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const displayRows = previewRows.slice(0, MAX_DISPLAYED_ROWS);
  const readyToImport = summary ? summary.total - summary.errors - (duplicateStrategy === "ignore" ? summary.duplicates : 0) : 0;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary inline-flex items-center gap-2">
        <Upload size={16} /> Importer
      </button>

      <Modal
        open={open}
        onClose={closeModal}
        title={
          step === "select" ? "Importer des véhicules" :
          step === "mapping" ? "Correspondance des colonnes" :
          step === "preview" ? "Prévisualisation de l'import" :
          "Import terminé"
        }
        className="max-w-4xl"
        footer={
          <>
            {step === "mapping" && (
              <>
                <button className="btn-secondary" onClick={() => setStep("select")}><ArrowLeft size={14} className="inline -mt-0.5 mr-1" />Retour</button>
                <button className="btn-primary" disabled={loading} onClick={() => recomputePreview(mapping)}>
                  {loading ? <Loader2 size={14} className="inline animate-spin mr-1" /> : null}
                  Prévisualiser <ArrowRight size={14} className="inline -mt-0.5 ml-1" />
                </button>
              </>
            )}
            {step === "preview" && (
              <>
                <button className="btn-secondary" onClick={() => setStep("mapping")}><ArrowLeft size={14} className="inline -mt-0.5 mr-1" />Retour</button>
                <button className="btn-primary" disabled={loading || !summary || summary.total - summary.errors === 0} onClick={handleCommit}>
                  {loading ? <Loader2 size={14} className="inline animate-spin mr-1" /> : null}
                  Importer {Math.max(readyToImport, 0)} véhicule{readyToImport > 1 ? "s" : ""}
                </button>
              </>
            )}
            {step === "result" && (
              <button className="btn-primary" onClick={closeModal}>Fermer</button>
            )}
          </>
        }
      >
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        {step === "select" && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition " +
                (dragOver ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50")
              }
            >
              {loading ? (
                <Loader2 className="animate-spin text-slate-400" size={28} />
              ) : (
                <FileSpreadsheet className="text-slate-400" size={28} />
              )}
              <p className="text-sm font-medium text-slate-700">Glissez-déposez un fichier ou cliquez pour sélectionner</p>
              <p className="text-xs text-slate-500">Formats acceptés : .xlsx, .csv (.xls non pris en charge)</p>
              {fileName && <p className="text-xs text-slate-400">{fileName}</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
            <a href="/api/vehicules/import/template" className="inline-flex items-center gap-2 text-sm text-[var(--color-brand)] hover:underline">
              <Download size={14} /> Télécharger un modèle Excel
            </a>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Vérifiez la correspondance entre vos colonnes Excel et les champs ScanAppAmendes. Les colonnes non reconnues peuvent être mappées manuellement, ou ignorées.</p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left font-medium text-slate-600">Colonne Excel</th>
                    <th className="p-2 text-left font-medium text-slate-600">Exemple</th>
                    <th className="p-2 text-left font-medium text-slate-600">Champ ScanAppAmendes</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="p-2 font-medium text-slate-700">{h || <span className="text-slate-400">(vide)</span>}</td>
                      <td className="p-2 text-slate-500">{rows[0]?.[idx] ?? "—"}</td>
                      <td className="p-2">
                        <select
                          className="field"
                          value={mapping[idx] ?? ""}
                          onChange={(e) => setMapping((m) => ({ ...m, [idx]: (e.target.value || null) as VehiculeImportField | null }))}
                        >
                          <option value="">— Ignorer —</option>
                          {TEMPLATE_FIELDS.map((f) => (
                            <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === "preview" && summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <SummaryTile label="Lignes détectées" value={summary.total} />
              <SummaryTile label="Prêtes" value={summary.ready} tone="success" />
              <SummaryTile label="Doublons" value={summary.duplicates} tone="info" />
              <SummaryTile label="À vérifier" value={summary.warnings} tone="warning" />
              <SummaryTile label="Erreurs" value={summary.errors} tone="danger" />
            </div>

            {summary.duplicates > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <span className="font-medium text-slate-700">Véhicules déjà existants ({summary.duplicates}) :</span>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" checked={duplicateStrategy === "ignore"} onChange={() => setDuplicateStrategy("ignore")} /> Ignorer tous les doublons
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" checked={duplicateStrategy === "update"} onChange={() => setDuplicateStrategy("update")} /> Mettre à jour les véhicules existants
                </label>
              </div>
            )}

            <div className="max-h-[380px] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="p-2 text-left font-medium text-slate-600">Ligne</th>
                    <th className="p-2 text-left font-medium text-slate-600">Immat.</th>
                    <th className="p-2 text-left font-medium text-slate-600">Marque / Modèle</th>
                    <th className="p-2 text-left font-medium text-slate-600">Société</th>
                    <th className="p-2 text-left font-medium text-slate-600">Conducteur</th>
                    <th className="p-2 text-left font-medium text-slate-600">État</th>
                    <th className="p-2 text-left font-medium text-slate-600">Ignorer</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r) => (
                    <RowLine
                      key={r.index}
                      row={r}
                      availableSocietes={availableSocietes}
                      conducteursBySociete={conducteursBySociete}
                      override={overrides[r.index] ?? {}}
                      onChange={(patch) => setOverrides((o) => ({ ...o, [r.index]: { ...o[r.index], ...patch } }))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {previewRows.length > MAX_DISPLAYED_ROWS && (
              <p className="text-xs text-slate-500">Affichage des {MAX_DISPLAYED_ROWS} premières lignes sur {previewRows.length} ; toutes les lignes seront traitées lors de l'import.</p>
            )}
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 font-medium text-emerald-800"><CheckCircle2 size={18} /> Import terminé</p>
            </div>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600" /> {result.created} véhicule(s) ajouté(s)</li>
              <li className="flex items-center gap-2"><Copy size={15} className="text-blue-600" /> {result.updated} véhicule(s) mis à jour</li>
              <li className="flex items-center gap-2"><ArrowRight size={15} className="text-slate-400" /> {result.skippedDuplicates} doublon(s) ignoré(s)</li>
              <li className="flex items-center gap-2"><AlertTriangle size={15} className="text-amber-600" /> {result.rejected.length} ligne(s) non importée(s)</li>
            </ul>
            {result.rejected.length > 0 && (
              <button onClick={downloadRejectedReport} className="inline-flex items-center gap-2 text-sm text-[var(--color-brand)] hover:underline">
                <Download size={14} /> Télécharger le rapport d'import
              </button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" | "info" }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center">
      <div className={
        "text-xl font-semibold " +
        (tone === "success" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : tone === "danger" ? "text-rose-600" : tone === "info" ? "text-blue-600" : "text-slate-800")
      }>
        {value}
      </div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function RowLine({
  row,
  availableSocietes,
  conducteursBySociete,
  override,
  onChange,
}: {
  row: PreviewRow;
  availableSocietes: string[];
  conducteursBySociete: Record<string, { id: string; label: string }[]>;
  override: { societe?: string | null; conducteurId?: string | null; skip?: boolean };
  onChange: (patch: { societe?: string | null; conducteurId?: string | null; skip?: boolean }) => void;
}) {
  const effectiveSociete = override.societe !== undefined ? override.societe : row.societeResolved;
  const candidates = effectiveSociete ? conducteursBySociete[effectiveSociete] ?? [] : [];
  const effectiveConducteur = override.conducteurId !== undefined ? override.conducteurId : row.conducteurResolvedId;

  const statusBadge =
    row.status === "ready" ? <Badge tone="success"><CheckCircle2 size={12} /> Prêt</Badge> :
    row.status === "duplicate" ? <Badge tone="info"><Copy size={12} /> Doublon</Badge> :
    row.status === "warning" ? <Badge tone="warning"><AlertTriangle size={12} /> À vérifier</Badge> :
    <Badge tone="danger"><XCircle size={12} /> Erreur</Badge>;

  return (
    <tr className={"border-t border-slate-100 align-top " + (override.skip ? "opacity-40" : "")}>
      <td className="p-2 text-slate-500">{row.index + 2}</td>
      <td className="p-2 font-medium text-slate-700">{row.data.immatriculation ?? <span className="text-rose-500">manquante</span>}</td>
      <td className="p-2 text-slate-600">{[row.data.marque, row.data.modele].filter(Boolean).join(" ") || "—"}</td>
      <td className="p-2">
        {row.societeStatus === "unverified" ? (
          <select
            className="field !py-1 text-xs"
            value={override.societe ?? ""}
            onChange={(e) => onChange({ societe: e.target.value || null })}
          >
            <option value="">— À vérifier ({row.societeInput}) —</option>
            {availableSocietes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <span className="text-slate-600">{effectiveSociete ?? "—"}</span>
        )}
      </td>
      <td className="p-2">
        <select
          className="field !py-1 text-xs"
          value={effectiveConducteur ?? ""}
          onChange={(e) => onChange({ conducteurId: e.target.value || null })}
          disabled={!effectiveSociete}
        >
          <option value="">— Aucun —</option>
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {row.conducteurStatus === "ambiguous" && <p className="mt-0.5 text-[10px] text-amber-600">Ambigu, choisissez manuellement</p>}
      </td>
      <td className="p-2">
        {statusBadge}
        {row.issues.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[10px] text-slate-500">
            {row.issues.map((iss, i) => <li key={i}>{iss}</li>)}
          </ul>
        )}
        {row.duplicate && (
          <p className="mt-1 text-[10px] text-slate-500">Existant : {row.duplicate.code} — {[row.duplicate.marque, row.duplicate.modele].filter(Boolean).join(" ") || "—"}</p>
        )}
      </td>
      <td className="p-2">
        <input type="checkbox" checked={!!override.skip} onChange={(e) => onChange({ skip: e.target.checked })} />
      </td>
    </tr>
  );
}
