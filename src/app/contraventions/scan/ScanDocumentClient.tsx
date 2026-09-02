"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload, FileText, Image as ImageIcon, X, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Copy,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_FIELD_LABELS, RECLASS_OPTIONS } from "@/lib/document-labels-shared";
import type { DocumentAnalysis, DuplicateMatch, DuplicateAction, ConfidenceLabel } from "@/lib/document-import";

type Step = "select" | "analyzing" | "review" | "duplicate-file" | "result";

function confidenceTone(label: ConfidenceLabel): "success" | "warning" | "danger" {
  if (label === "Élevée") return "success";
  if (label === "Moyenne") return "warning";
  return "danger";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// A 500 (e.g. transient DB/network outage) can come back with an empty or non-JSON body —
// res.json() would then throw its own cryptic "unexpected end of data" error instead of ours.
async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * "Scanner un document" (2026-09-02): full-page equivalent of the "+ Nouveau document" modal
 * (see NewDocumentMenu.tsx) — same server-side OCR + classification pipeline
 * (/api/documents/import + /api/documents/[id]/confirm), reused unmodified, so every document
 * type it already supports (contravention, mise en demeure/URSSAF, certificat d'immatriculation,
 * facture, impôt, sinistre, permis de conduire, carte d'identité, pub) is recognized here too —
 * not just contraventions.
 */
export default function ScanDocumentClient() {
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [duplicateFileInfo, setDuplicateFileInfo] = useState<{ id: string; fileName: string; status: string; contraventionId: string | null; courrierId: string | null } | null>(null);
  const [finalType, setFinalType] = useState<string>("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>("ignorer");
  const [result, setResult] = useState<{ redirectPath?: string; societe?: string } | null>(null);
  const [societes, setSocietes] = useState<string[]>([]);
  const [targetSociete, setTargetSociete] = useState<string>("");
  const [sendToClient, setSendToClient] = useState(true);

  function resetAll() {
    setStep("select");
    setError(null);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setScanId(null);
    setAnalysis(null);
    setDuplicate(null);
    setDuplicateFileInfo(null);
    setFinalType("");
    setFields({});
    setDuplicateAction("ignorer");
    setResult(null);
    setSocietes([]);
    setTargetSociete("");
    setSendToClient(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleFile = useCallback((f: File) => {
    setError(null);
    setFile(f);
    if (f.type.startsWith("image/")) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(null);
  }, []);

  async function submitConfirm(payload: {
    scanId: string;
    finalType: string;
    fields: Record<string, string>;
    duplicate: DuplicateMatch;
    duplicateAction: DuplicateAction;
    societe: string;
    visibleClient: boolean;
  }) {
    const res = await fetch(`/api/documents/${payload.scanId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        finalType: payload.finalType,
        fields: payload.fields,
        duplicate: payload.duplicate,
        duplicateAction: payload.duplicateAction,
        societe: payload.societe,
        visibleClient: payload.visibleClient,
      }),
    });
    const json = await safeJson(res);
    if (!res.ok) {
      throw new Error(
        typeof json.error === "string"
          ? json.error
          : `Le serveur n'a pas répondu correctement (HTTP ${res.status}). Vérifiez la connexion à la base de données et réessayez.`,
      );
    }
    return json as { redirectPath?: string; societe?: string };
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setStep("analyzing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/documents/import", { method: "POST", body: fd });
      const json = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : `Le serveur n'a pas répondu correctement (HTTP ${res.status}). Vérifiez la connexion à la base de données et réessayez.`,
        );
      }

      if (json.duplicateFile) {
        setDuplicateFileInfo(json.existingScan as typeof duplicateFileInfo);
        setStep("duplicate-file");
        return;
      }
      if (json.status === "error") {
        setError(typeof json.error === "string" ? json.error : "Analyse impossible.");
        setStep("select");
        return;
      }

      const analysisResult = json.analysis as DocumentAnalysis;
      const scanIdValue = json.id as string;
      const duplicateMatch = (json.duplicate as DuplicateMatch) ?? null;
      const initialFields: Record<string, string> = {};
      Object.entries(analysisResult.fields as Record<string, unknown>).forEach(([k, v]) => {
        initialFields[k] = v === null || v === undefined ? "" : String(v);
      });
      const societesList = (json.societes as string[]) ?? [];
      const defaultSociete = (json.defaultSociete as string) ?? "";
      // Destinataire auto-detection: file the document under whichever known société it actually
      // names, instead of always defaulting to the uploader's own société.
      const detectedSociete = (json.detectedSociete as string | null) ?? null;
      const targetSocieteValue = detectedSociete ?? defaultSociete;

      setScanId(scanIdValue);
      setAnalysis(analysisResult);
      setDuplicate(duplicateMatch);
      setFinalType(analysisResult.type);
      setFields(initialFields);
      setDuplicateAction("ignorer");
      setSocietes(societesList);
      setTargetSociete(targetSocieteValue);

      // No conflicting duplicate: file it straight into its section, no manual review needed —
      // a genuine potential-duplicate match (numAvis/immat/référence already existing) is the
      // only case that still requires a human decision (ignorer/rattacher/créer quand même).
      if (!duplicateMatch) {
        const saved = await submitConfirm({
          scanId: scanIdValue,
          finalType: analysisResult.type,
          fields: initialFields,
          duplicate: null,
          duplicateAction: "ignorer",
          societe: targetSocieteValue,
          // Safe default: auto-filing skips the review step, so it must NOT also auto-publish to
          // the client portal — visibilité stays an explicit admin action from the record itself.
          visibleClient: false,
        });
        setResult(saved);
        setStep("result");
        return;
      }

      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
      setStep("select");
    } finally {
      setLoading(false);
    }
  }

  async function confirmAndSave() {
    if (!scanId) return;
    setLoading(true);
    setError(null);
    try {
      const saved = await submitConfirm({ scanId, finalType, fields, duplicate, duplicateAction, societe: targetSociete, visibleClient: sendToClient });
      setResult(saved);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  const isImage = file?.type.startsWith("image/");
  const isPdf = file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name));

  return (
    <div className="card p-6 space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {step === "select" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Importez n&apos;importe quel document (contravention, mise en demeure / URSSAF, certificat d&apos;immatriculation,
            facture, impôt, sinistre, permis de conduire, carte d&apos;identité, pub…) : l&apos;OCR détecte automatiquement de quoi il s&apos;agit
            et l&apos;enregistre directement dans la bonne section.
          </p>

          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onClick={() => fileInputRef.current?.click()}
              className={
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition " +
                (dragOver ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50")
              }
            >
              <Upload className="text-slate-400" size={28} />
              <p className="text-sm font-medium text-slate-700">Glissez-déposez un fichier ou cliquez pour sélectionner</p>
              <p className="text-xs text-slate-500">Formats acceptés : PDF, JPG, JPEG, PNG</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
              {isImage && previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Aperçu" className="h-20 w-20 rounded-lg object-cover" />
              ) : (
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
                  {isPdf ? <FileText size={28} /> : <ImageIcon size={28} />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500">{isPdf ? "PDF" : file.type} · {formatSize(file.size)}</p>
              </div>
              <button onClick={() => { setFile(null); setPreviewUrl(null); }} aria-label="Retirer" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
          )}

          {file && (
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => { setFile(null); setPreviewUrl(null); }}>Changer / supprimer</button>
              <button className="btn-primary" onClick={analyze}>Analyser le document</button>
            </div>
          )}
        </div>
      )}

      {step === "analyzing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Loader2 className="animate-spin text-brand-600" size={32} />
          <p className="text-sm font-medium text-slate-700">Stockage sécurisé, OCR, classification et enregistrement dans la bonne section…</p>
          <p className="text-xs text-slate-500">Cela peut prendre quelques secondes selon la taille du document.</p>
        </div>
      )}

      {step === "duplicate-file" && duplicateFileInfo && (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">Ce fichier a déjà été importé précédemment (« {duplicateFileInfo.fileName} »).</p>
            <p className="mt-1 text-xs">Aucun doublon n&apos;a été créé.</p>
          </div>
          {(duplicateFileInfo.contraventionId || duplicateFileInfo.courrierId) && (
            <a
              href={duplicateFileInfo.contraventionId ? `/contraventions/${duplicateFileInfo.contraventionId}` : `/courriers`}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-brand)] hover:underline"
            >
              Ouvrir le document existant <ArrowRight size={14} />
            </a>
          )}
          <div className="flex justify-end">
            <button className="btn-secondary" onClick={resetAll}>Scanner un autre document</button>
          </div>
        </div>
      )}

      {step === "review" && analysis && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 p-4">
            <div>
              <p className="text-xs font-medium text-slate-400">Type détecté</p>
              <p className="text-base font-semibold text-slate-800">{DOCUMENT_TYPE_LABELS[analysis.type] ?? analysis.type}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Confiance</p>
              <Badge tone={confidenceTone(analysis.confidenceLabel)}>{analysis.confidenceLabel}</Badge>
            </div>
          </div>

          {analysis.type === "inconnu" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p>Le type de ce document n&apos;a pas pu être déterminé avec certitude. Il sera enregistré comme « Document à classer » dans Tous les documents, sauf si vous choisissez une catégorie manuellement ci-dessous.</p>
            </div>
          )}

          {duplicate && (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="flex items-center gap-1.5 font-medium"><Copy size={14} /> Doublon potentiel : {duplicate.label}</p>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5"><input type="radio" checked={duplicateAction === "ignorer"} onChange={() => setDuplicateAction("ignorer")} /> Ignorer ce document</label>
                <label className="inline-flex items-center gap-1.5"><input type="radio" checked={duplicateAction === "rattacher"} onChange={() => setDuplicateAction("rattacher")} /> Rattacher au document existant</label>
                <label className="inline-flex items-center gap-1.5"><input type="radio" checked={duplicateAction === "creer_quand_meme"} onChange={() => setDuplicateAction("creer_quand_meme")} /> Créer quand même</label>
              </div>
            </div>
          )}

          {societes.length > 0 && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Société concernée</span>
                <select className="field w-full" value={targetSociete} onChange={(e) => setTargetSociete(e.target.value)}>
                  {societes.map((nom) => (
                    <option key={nom} value={nom}>{nom}</option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={sendToClient} onChange={(e) => setSendToClient(e.target.checked)} />
                Envoyer directement dans l&apos;espace client de cette société
              </label>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Reclasser dans une autre catégorie</label>
            <select className="field" value={finalType} onChange={(e) => setFinalType(e.target.value)}>
              {RECLASS_OPTIONS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {(!duplicate || duplicateAction === "creer_quand_meme") && Object.keys(fields).length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(fields).map(([key, value]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">{DOCUMENT_FIELD_LABELS[key] ?? key}</span>
                  <input
                    className="field w-full"
                    value={value}
                    onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button className="btn-secondary" onClick={resetAll}>Annuler</button>
            <button className="btn-primary" disabled={loading} onClick={confirmAndSave}>
              {loading ? <Loader2 size={14} className="inline animate-spin mr-1" /> : null}
              Confirmer et enregistrer
            </button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 size={20} />
            <div>
              <p className="font-medium">Document classé automatiquement.</p>
              {result.societe && <p className="text-xs text-emerald-700">Société concernée : {result.societe}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={resetAll}>Scanner un autre document</button>
            {result.redirectPath && (
              <a href={result.redirectPath} className="btn-primary">Ouvrir le document classé</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
