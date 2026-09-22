"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mail, Copy, CheckCircle2, Clock, AlertTriangle, FileText,
  Loader2, RefreshCw, ExternalLink, Trash2, X, Eye,
} from "lucide-react";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";
import { getEmailScanRecordHref } from "@/lib/scan-record-href";

type EmailScanItem = {
  id: string;
  societe: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  fromAddress: string | null;
  subject: string | null;
  status: string;
  errorMessage: string | null;
  contraventionId: string | null;
  courrierId: string | null;
  courrierType: string | null;
  parsedData: string | null;
  receivedAt: string;
  processedAt: string | null;
  updatedAt: string;
  origine?: string;
};

const STALE_PROCESSING_MINUTES = 10;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  received: { label: "Reçu", color: "text-blue-700 bg-blue-50 border-blue-200", icon: <Mail size={12} /> },
  waiting_parts: { label: "En attente des autres parties", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <Clock size={12} /> },
  processing: { label: "Analyse en cours", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <Loader2 size={12} className="animate-spin" /> },
  analyzed: { label: "Analysé", color: "text-brand-700 bg-brand-50 border-brand-200", icon: <CheckCircle2 size={12} /> },
  created: { label: "Dossier créé", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <CheckCircle2 size={12} /> },
  error: { label: "À vérifier", color: "text-red-700 bg-red-50 border-red-200", icon: <AlertTriangle size={12} /> },
};

function StatusBadge({ status, needsReview, staleProcessing }: { status: string; needsReview: boolean; staleProcessing: boolean }) {
  if (staleProcessing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-red-700 bg-red-50 border-red-200">
        <AlertTriangle size={12} /> Analyse bloquée
      </span>
    );
  }
  if (needsReview) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-50 border-amber-200">
        <AlertTriangle size={12} /> À vérifier
      </span>
    );
  }
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.received;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isStaleProcessing(scan: EmailScanItem): boolean {
  if (scan.status !== "processing") return false;
  const startedAt = new Date(scan.updatedAt).getTime();
  if (Number.isNaN(startedAt)) return false;
  return Date.now() - startedAt > STALE_PROCESSING_MINUTES * 60 * 1000;
}

function shouldAutoProcessScans(scans: Array<{ status?: string; processedAt?: string | null; updatedAt?: string | null }>): boolean {
  if (!Array.isArray(scans) || scans.length === 0) return false;

  return scans.some((scan) => {
    const status = (scan.status ?? "received").toLowerCase();
    if (status === "received" || status === "error" || status === "processing" || status === "waiting_parts") return true;
    if (status === "analyzed") {
      const updated = scan.updatedAt ? new Date(scan.updatedAt).getTime() : 0;
      const processed = scan.processedAt ? new Date(scan.processedAt).getTime() : 0;
      const last = Number.isFinite(updated) && updated > 0 ? updated : processed;
      if (!last) return true;
      return Date.now() - last > 30_000;
    }
    return false;
  });
}

export function ScanEmailInfo() {
  const email = process.env.NEXT_PUBLIC_SCAN_EMAIL ?? "";
  const [copied, setCopied] = useState(false);

  function copyEmail() {
    if (!email) return;
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!email) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-card">
          <Mail size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">Scanner depuis une imprimante</h3>
          <p className="mt-1 text-xs text-slate-500">
            Ajoutez cette adresse dans le carnet d'adresses de votre imprimante puis utilisez la fonction
            « Scanner vers e-mail ». Les documents reçus seront automatiquement importés et analysés.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800">{email}</code>
            <button
              onClick={copyEmail}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {copied ? <><CheckCircle2 size={14} className="text-emerald-600" /> Copié</> : <><Copy size={14} /> Copier</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmailScanList() {
  const [scans, setScans] = useState<EmailScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [manualType, setManualType] = useState("document");
  const [manualNote, setManualNote] = useState("");
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewingScan, setViewingScan] = useState<EmailScanItem | null>(null);
  const [expanded, setExpanded] = useState(false);
  const autoProcessingRef = useRef(false);

  const selectedScans = scans.filter((scan) => selection.includes(scan.id));
  const staleScanIds = scans.filter(isStaleProcessing).map((s) => s.id);
  const allSelected = scans.length > 0 && selection.length === scans.length;

  function toggleSelection(id: string) {
    setSelection((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelectAll() {
    setSelection(allSelected ? [] : scans.map((scan) => scan.id));
  }

  function parseFields(scan: EmailScanItem) {
    if (!scan.parsedData) return {};
    try {
      const parsed = JSON.parse(scan.parsedData);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  async function submitManualClassification() {
    if (selectedScans.length === 0) return;
    setClassifying(true);
    try {
      const source = selectedScans[0];
      const res = await fetch("/api/scan-email/manual-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanIds: selectedScans.map((scan) => scan.id),
          orderedIds: selectedScans.map((scan) => scan.id),
          finalType: manualType,
          fields: parseFields(source),
          manualClassificationNote: manualNote.trim() || null,
          visibleClient: false,
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setManualModalOpen(false);
      setManualNote("");
      setSelection([]);
      await fetchScans();
    } finally {
      setClassifying(false);
    }
  }

  const triggerAutoProcessing = useCallback(async () => {
    if (autoProcessingRef.current) return;
    autoProcessingRef.current = true;
    try {
      await fetch("/api/scan-email/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drain: true }),
      });
      await fetchScans();
    } finally {
      autoProcessingRef.current = false;
    }
  }, []);

  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch("/api/scan-email/list");
      if (res.ok) {
        const nextScans = await res.json();
        setScans(nextScans);

        if (shouldAutoProcessScans(nextScans)) {
          await triggerAutoProcessing();
        }
      }
    } catch {
      // Transient network error (e.g. dev server restart) — silently retried on next poll.
    } finally {
      setLoading(false);
    }
  }, [triggerAutoProcessing]);

  useEffect(() => {
    fetchScans();
    const interval = setInterval(fetchScans, 15000);
    return () => clearInterval(interval);
  }, [fetchScans]);

  async function retryProcess(id: string) {
    setProcessing(id);
    try {
      await fetch("/api/scan-email/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchScans();
    } catch {
      // Transient network error — user can retry via the button.
    } finally {
      setProcessing(null);
    }
  }

  async function retryAllStale() {
    if (staleScanIds.length === 0) return;
    setBulkRetrying(true);
    try {
      for (const id of staleScanIds) {
        await fetch("/api/scan-email/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      }
      await fetchScans();
    } finally {
      setBulkRetrying(false);
    }
  }

  async function processAllPending() {
    setBulkProcessing(true);
    try {
      await fetch("/api/scan-email/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drain: true }),
      });
      await fetchScans();
    } finally {
      setBulkProcessing(false);
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setDeleting(id);
    try {
      await fetch(`/api/scan-email/${id}`, { method: "DELETE" });
      setScans((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // Transient network error — user can retry via the button.
    } finally {
      setDeleting(null);
      setConfirmDeleteId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <Loader2 className="mx-auto animate-spin text-slate-400" size={24} />
        <p className="mt-2 text-sm text-slate-500">Chargement des scans reçus…</p>
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <Mail className="mx-auto text-slate-300" size={32} />
        <p className="mt-2 text-sm font-medium text-slate-500">Aucun scan reçu par e-mail</p>
        <p className="mt-1 text-xs text-slate-400">Les documents envoyés depuis votre imprimante apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Scans reçus depuis l'imprimante</h3>
          <p className="text-xs text-slate-500">{scans.length} document(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {selection.length > 0 && (
            <button
              onClick={() => setManualModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Classer manuellement ({selection.length})
            </button>
          )}
          <button
            onClick={processAllPending}
            disabled={bulkProcessing}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
          >
            {bulkProcessing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Traiter tout
          </button>
          {staleScanIds.length > 0 && (
            <button
              onClick={retryAllStale}
              disabled={bulkRetrying}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              {bulkRetrying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Relancer les bloqués ({staleScanIds.length})
            </button>
          )}
          <button
            onClick={fetchScans}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw size={12} /> Actualiser
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-slate-500">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            Sélectionner tout
          </label>
          <span>{selection.length} sélectionné(s)</span>
        </div>
        {scans.map((scan) => (
          <div key={scan.id} className={`flex items-center gap-4 px-5 py-3 transition ${isStaleProcessing(scan) ? "bg-red-50/40 hover:bg-red-50" : "hover:bg-slate-50"}`}>
            <input
              type="checkbox"
              checked={selection.includes(scan.id)}
              onChange={() => toggleSelection(scan.id)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              aria-label={`Sélectionner ${scan.fileName}`}
            />
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
              <FileText size={16} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800 truncate">{scan.fileName}</span>
                <span className="text-xs text-slate-400">{formatSize(scan.fileSize)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span>{formatDate(scan.receivedAt)} à {formatTime(scan.receivedAt)}</span>
                {scan.fromAddress && <span className="truncate max-w-[200px]">{scan.fromAddress}</span>}
                <span className={scan.origine === "manuel" ? "text-slate-500" : "text-slate-400"}>
                  {scan.origine === "manuel" ? "Import manuel" : "Scan imprimante"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge
                status={scan.status}
                needsReview={!!scan.errorMessage && (scan.status === "analyzed" || scan.status === "created")}
                staleProcessing={isStaleProcessing(scan)}
              />

              {scan.status === "created" && (() => {
                const href = getEmailScanRecordHref(scan);
                return href ? (
                  <a
                    href={href}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-[var(--color-brand)] transition hover:bg-brand-50"
                  >
                    <ExternalLink size={12} /> Voir
                  </a>
                ) : null;
              })()}

              {(scan.status === "error" || scan.status === "processing") && (
                <button
                  onClick={() => retryProcess(scan.id)}
                  disabled={processing === scan.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                >
                  {processing === scan.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RefreshCw size={12} />}
                  Relancer
                </button>
              )}

              <button
                onClick={() => { setExpanded(false); setViewingScan(scan); }}
                aria-label="Visualiser le document"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-[var(--color-brand)] hover:bg-brand-50 hover:text-[var(--color-brand)]"
              >
                <Eye size={12} /> Visualiser
              </button>

              <button
                onClick={() => setConfirmDeleteId(scan.id)}
                disabled={deleting === scan.id}
                aria-label="Supprimer ce scan"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                {deleting === scan.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Trash2 size={14} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <h4 className="text-sm font-semibold text-slate-900">Supprimer ce scan ?</h4>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="text-slate-400 transition hover:text-slate-600"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Le document sera supprimé de la liste des scans reçus. La contravention déjà créée à partir de ce scan, le cas échéant, ne sera pas supprimée.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting === confirmDeleteId}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting === confirmDeleteId && <Loader2 size={12} className="animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingScan && (
        <DocumentViewerModal
          open
          onClose={() => setViewingScan(null)}
          fileUrl={`/api/scan-email/${viewingScan.id}`}
          downloadUrl={`/api/scan-email/${viewingScan.id}?download=1`}
          fileName={viewingScan.fileName}
          fileMime={viewingScan.fileMime}
          expanded={expanded}
          onToggleExpand={() => setExpanded((v) => !v)}
        />
      )}

      {manualModalOpen && selectedScans.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Classer la sélection</h4>
                <p className="mt-1 text-xs text-slate-500">{selectedScans.length} scan(s) sélectionné(s). Le premier scan sert de référence pour les champs OCR déjà présents.</p>
              </div>
              <button onClick={() => setManualModalOpen(false)} className="text-slate-400 transition hover:text-slate-600" aria-label="Fermer">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-slate-500">Type cible</span>
                <select value={manualType} onChange={(e) => setManualType(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
                  <option value="document">Document à classer</option>
                  <option value="contravention">Contravention</option>
                  <option value="mise_en_demeure">Mise en demeure</option>
                  <option value="facture">Facture</option>
                  <option value="impot">Impôt</option>
                  <option value="certificat_immatriculation">Certificat d'immatriculation</option>
                  <option value="pub">Pub</option>
                  <option value="retard_paiement">Retard de paiement</option>
                  <option value="sinistre">Sinistre</option>
                  <option value="permis_conduire">Permis de conduire</option>
                  <option value="carte_identite">Carte d'identité</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-slate-500">Note manuelle</span>
                <textarea
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  rows={3}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  placeholder="Précisez pourquoi ces scans ont été regroupés ou corrigés manuellement"
                />
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                {selectedScans.map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between gap-2 py-1">
                    <span className="truncate">{scan.fileName}</span>
                    <span>{scan.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setManualModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={submitManualClassification}
                disabled={classifying}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {classifying && <Loader2 size={12} className="animate-spin" />}
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
