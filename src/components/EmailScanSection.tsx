"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail, Copy, CheckCircle2, Clock, AlertTriangle, FileText,
  Loader2, RefreshCw, ExternalLink, Trash2, X, Eye,
} from "lucide-react";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";

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
  parsedData: string | null;
  receivedAt: string;
  processedAt: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  received: { label: "Reçu", color: "text-blue-700 bg-blue-50 border-blue-200", icon: <Mail size={12} /> },
  processing: { label: "Analyse en cours", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <Loader2 size={12} className="animate-spin" /> },
  analyzed: { label: "Analysé", color: "text-indigo-700 bg-indigo-50 border-indigo-200", icon: <CheckCircle2 size={12} /> },
  created: { label: "Dossier créé", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <CheckCircle2 size={12} /> },
  error: { label: "À vérifier", color: "text-red-700 bg-red-50 border-red-200", icon: <AlertTriangle size={12} /> },
};

function StatusBadge({ status }: { status: string }) {
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
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20">
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewingScan, setViewingScan] = useState<EmailScanItem | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch("/api/scan-email/list");
      if (res.ok) setScans(await res.json());
    } catch {
      // Transient network error (e.g. dev server restart) — silently retried on next poll.
    } finally {
      setLoading(false);
    }
  }, []);

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
        <button
          onClick={fetchScans}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {scans.map((scan) => (
          <div key={scan.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition">
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
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={scan.status} />

              {scan.status === "created" && scan.contraventionId && (
                <a
                  href={`/contraventions/${scan.contraventionId}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-[var(--color-brand)] transition hover:bg-indigo-50"
                >
                  <ExternalLink size={12} /> Voir
                </a>
              )}

              {scan.status === "error" && (
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
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-[var(--color-brand)] hover:bg-indigo-50 hover:text-[var(--color-brand)]"
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
    </div>
  );
}
