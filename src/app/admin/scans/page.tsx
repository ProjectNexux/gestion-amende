"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronDown, Clock, Eye, Mail, Loader2, X, Check, FileText, MoreHorizontal, RefreshCw } from "lucide-react";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";
import { TransmettreClientButton } from "@/components/TransmettreClientModal";
import type { TransmissionClientInfo } from "@/app/courriers/actions";

type Scan = {
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
  bundleCount?: number;
  bundlePartTotal?: number;
  transmissionClient?: TransmissionClientInfo | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  received: { label: "Reçu", color: "bg-blue-50 text-blue-700 border-blue-200" },
  processing: { label: "Analyse en cours", color: "bg-amber-50 text-amber-700 border-amber-200" },
  analyzed: { label: "Analysé", color: "bg-brand-50 text-brand-700 border-brand-200" },
  created: { label: "Dossier créé", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  error: { label: "À vérifier", color: "bg-red-50 text-red-700 border-red-200" },
  waiting_parts: { label: "En attente", color: "bg-gray-50 text-gray-700 border-gray-200" },
};

export default function ScansPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const VALID_FILTERS = ["all", "to_review", "created", "error"] as const;
  type FilterId = (typeof VALID_FILTERS)[number];
  const rawFilter = searchParams.get("filter");
  // URL is the single source of truth (survives reload/back-navigation/shared links) — never a
  // plain useState that silently resets to "to_review" whenever the page remounts.
  const filter: FilterId = VALID_FILTERS.includes(rawFilter as FilterId) ? (rawFilter as FilterId) : "to_review";
  const setFilter = useCallback(
    (next: FilterId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("filter", next);
      router.replace(`/admin/scans?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [classifyForm, setClassifyForm] = useState({
    finalType: "certificat_immatriculation",
    visibleClient: false,
    note: "",
  });
  const [classifying, setClassifying] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    fetchScans();
    const interval = setInterval(fetchScans, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchScans = async () => {
    try {
      const res = await fetch("/api/scan-email/list");
      const data = await res.json();
      setScans(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch scans:", err);
      setScans([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredScans = scans.filter((scan) => {
    if (filter === "to_review") return scan.status === "error" || (scan.status === "analyzed" && !scan.courrierId && !scan.contraventionId);
    if (filter === "created") return scan.status === "created";
    if (filter === "error") return scan.status === "error";
    return true;
  });

  // "Relancer l'analyse" (2026-09-23) — un scan resté bloqué à "Reçu" (import IMAP/manuel réussi
  // mais OCR jamais déclenché, ex: crash serveurless mi-traitement) n'a aucun moyen de ressortir de
  // cet état sans ce bouton. Réutilise le MÊME endpoint que EmailScanSection.tsx (aucune divergence
  // de comportement). Sans risque de doublon : processPendingEmailScans(id) ne retraite que les
  // scans dont le statut est encore received/error/processing/analyzed, jamais "created".
  const handleRetryAnalysis = async (scanId: string) => {
    setRetryingId(scanId);
    try {
      await fetch("/api/scan-email/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: scanId }),
      });
      await fetchScans();
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : "Relance échouée"}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleClassify = async () => {
    if (!selectedScan) return;
    setClassifying(true);
    try {
      const res = await fetch("/api/scan-email/manual-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanIds: [selectedScan.id],
          finalType: classifyForm.finalType,
          visibleClient: classifyForm.visibleClient,
          manualClassificationNote: classifyForm.note,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchScans();
      setClassifyOpen(false);
      setSelectedScan(null);
      alert("✓ Document classé avec succès");
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : "Classement échoué"}`);
    } finally {
      setClassifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Scans reçus</h1>
          <p className="text-slate-600">Gérer les documents importés par scan ou téléchargement</p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6 flex-wrap">
          {[
            { id: "to_review", label: "À classer", count: scans.filter(s => s.status === "error" || (s.status === "analyzed" && !s.courrierId && !s.contraventionId)).length },
            { id: "created", label: "Créés", count: scans.filter(s => s.status === "created").length },
            { id: "error", label: "Erreurs", count: scans.filter(s => s.status === "error").length },
            { id: "all", label: "Tous", count: scans.length },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as FilterId)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === f.id
                  ? "bg-brand-600 text-white shadow-lg"
                  : "bg-white text-slate-700 border border-slate-200 hover:border-brand-300"
              }`}
            >
              {f.label} <span className="opacity-60">({f.count})</span>
            </button>
          ))}
        </div>

        {/* Scans Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
            </div>
          ) : filteredScans.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FileText className="w-12 h-12 mx-auto opacity-30 mb-4" />
              <p>Aucun document trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Fichier</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Source</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredScans.map((scan) => {
                    const cfg = STATUS_CONFIG[scan.status] || STATUS_CONFIG.received;
                    const isNeedsReview = scan.status === "error" || (scan.status === "analyzed" && !scan.courrierId && !scan.contraventionId);
                    return (
                      <tr key={scan.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {new Date(scan.receivedAt).toLocaleDateString("fr-FR")}
                          <br />
                          <span className="text-xs opacity-70">
                            {new Date(scan.receivedAt).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="font-medium text-slate-900">{scan.fileName}</div>
                          <div className="text-xs text-slate-500">
                            {(scan.fileSize / 1024 / 1024).toFixed(1)} Mo
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {scan.fromAddress ? (
                            <>
                              <Mail size={14} className="inline mr-1" />
                              {scan.fromAddress}
                            </>
                          ) : (
                            "Manuel"
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border ${cfg.color}`}
                          >
                            {scan.status === "processing" ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : scan.status === "error" ? (
                              <AlertTriangle size={12} />
                            ) : scan.status === "created" ? (
                              <Check size={12} />
                            ) : (
                              <Clock size={12} />
                            )}
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm space-x-2">
                          <button
                            onClick={() => {
                              setSelectedScan(scan);
                              setViewerOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                          >
                            <Eye size={12} /> Voir
                          </button>
                          {isNeedsReview && (
                            <button
                              onClick={() => {
                                setSelectedScan(scan);
                                setClassifyOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-brand-100 hover:bg-brand-200 text-brand-700 font-medium"
                            >
                              Classer
                            </button>
                          )}
                          {(scan.status === "received" || scan.status === "error") && (
                            <button
                              onClick={() => handleRetryAnalysis(scan.id)}
                              disabled={retryingId === scan.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-amber-100 hover:bg-amber-200 text-amber-700 font-medium disabled:opacity-50"
                            >
                              {retryingId === scan.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                              Relancer l&apos;analyse
                            </button>
                          )}
                          {scan.courrierId && (
                            <TransmettreClientButton
                              id={scan.courrierId}
                              fileName={scan.fileName}
                              fileMime={scan.fileMime}
                              currentType={scan.courrierType ?? "document"}
                              detectedSociete={scan.societe}
                              transmission={scan.transmissionClient ?? null}
                              compact
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Document Viewer Modal */}
        {selectedScan && viewerOpen && (
          <DocumentViewerModal
            open={viewerOpen}
            onClose={() => {
              setViewerOpen(false);
              setSelectedScan(null);
            }}
            fileUrl={`/api/scan-email/${selectedScan.id}`}
            downloadUrl={`/api/scan-email/${selectedScan.id}?download=1`}
            fileName={selectedScan.fileName}
            fileMime={selectedScan.fileMime}
            expanded={false}
            onToggleExpand={() => {}}
          />
        )}

        {/* Classify Modal */}
        {selectedScan && classifyOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="font-semibold text-slate-900">Classer le document</h3>
                <button
                  onClick={() => {
                    setClassifyOpen(false);
                    setSelectedScan(null);
                  }}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Type de document
                  </label>
                  <select
                    value={classifyForm.finalType}
                    onChange={(e) =>
                      setClassifyForm({ ...classifyForm, finalType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="contravention">Contravention</option>
                    <option value="mise_en_demeure">Mise en demeure</option>
                    <option value="retard_paiement">Retard de paiement</option>
                    <option value="certificat_immatriculation">Certificat d'immatriculation</option>
                    <option value="urssaf">URSSAF</option>
                    <option value="sinistre">Sinistre</option>
                    <option value="facture">Facture</option>
                    <option value="impot">Impôt</option>
                    <option value="permis_conduire">Permis de conduire</option>
                    <option value="carte_identite">Carte d'identité</option>
                    <option value="pub">Publicité</option>
                    <option value="document">Autre</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={classifyForm.visibleClient}
                    onChange={(e) =>
                      setClassifyForm({ ...classifyForm, visibleClient: e.target.checked })
                    }
                    className="rounded border-slate-300"
                    id="visible-client"
                  />
                  <label htmlFor="visible-client" className="ml-2 text-sm font-medium text-slate-700">
                    Rendre visible dans le portail client
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Note (optionnelle)
                  </label>
                  <textarea
                    value={classifyForm.note}
                    onChange={(e) =>
                      setClassifyForm({ ...classifyForm, note: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    rows={3}
                    placeholder="Ex: Document analysé manuellement, vérification nécessaire..."
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => {
                      setClassifyOpen(false);
                      setSelectedScan(null);
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleClassify}
                    disabled={classifying}
                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {classifying && <Loader2 size={16} className="animate-spin" />}
                    Classer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
