"use client";

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, documentTypeTone } from "@/components/ui/Badge";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { courrierTypeLabel } from "@/lib/courriers";
import { toggleFavoriAction } from "../actions";
import { EnvoyerDocumentButton } from "../documents-envoyes/EnvoyerDocumentModal";
import { Download, Eye, Search, CheckCircle2, Circle, Loader2, Star, Paperclip, History, ChevronDown, FolderOpen } from "lucide-react";
import { fmtDateTime } from "@/lib/utils";

type Courrier = {
  id: string;
  type: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  receivedAt: string;
  data?: Record<string, unknown>;
  isFavori: boolean;
  pieceJointesAjoutees: { date: string }[];
};

const DATE_RANGES = [
  { key: "all", label: "Toutes les dates" },
  { key: "7", label: "7 derniers jours" },
  { key: "30", label: "30 derniers jours" },
  { key: "older", label: "Plus de 30 jours" },
] as const;

export default function ClientDocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // URL is the source of truth for filters (survives reload/back-navigation) — initial state reads
  // straight from the current query string instead of always resetting to defaults.
  const updateParam = (key: string, value: string | null, defaultValue: string | null = null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === defaultValue) params.delete(key);
    else params.set(key, value);
    router.replace(`/client/courriers${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  };

  const [items, setItems] = useState<Courrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filterRead, setFilterReadState] = useState<"all" | "unread" | "read">((searchParams.get("read") as "unread" | "read" | null) ?? "all");
  const [filterType, setFilterTypeState] = useState(searchParams.get("type") ?? "all");
  const [filterDate, setFilterDateState] = useState<(typeof DATE_RANGES)[number]["key"]>((searchParams.get("date") as (typeof DATE_RANGES)[number]["key"] | null) ?? "all");
  const [onlyFavoris, setOnlyFavorisState] = useState(searchParams.get("favoris") === "1");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const setFilterRead = (v: "all" | "unread" | "read") => { setFilterReadState(v); updateParam("read", v, "all"); };
  const setFilterType = (v: string) => { setFilterTypeState(v); updateParam("type", v, "all"); };
  const setFilterDate = (v: (typeof DATE_RANGES)[number]["key"]) => { setFilterDateState(v); updateParam("date", v, "all"); };
  const setOnlyFavoris = (v: boolean) => { setOnlyFavorisState(v); updateParam("favoris", v ? "1" : null); };

  // Search is debounced before touching the URL so typing stays responsive.
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => updateParam("q", search || null), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/client/courriers");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch error:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusy((p) => ({ ...p, [id]: true }));
    try {
      await fn();
    } finally {
      setBusy((p) => ({ ...p, [id]: false }));
    }
  };

  const handleMarkRead = (id: string, isRead: boolean) =>
    withBusy(id, async () => {
      const res = await fetch(`/api/client/courriers/${id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead }),
      });
      if (!res.ok) return;
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, data: { ...(item.data || {}), isRead, lastReadAt: new Date().toISOString() } } : item)));
    });

  const handleToggleFavori = (id: string, next: boolean) =>
    withBusy(id, async () => {
      await toggleFavoriAction("courrier", id, next);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isFavori: next } : item)));
    });

  const uniqueTypes = useMemo(() => Array.from(new Set(items.map((i) => i.type))), [items]);

  const filteredItems = items.filter((item) => {
    const isRead = (item.data as { isRead?: boolean } | undefined)?.isRead === true;
    if (filterRead === "unread" && isRead) return false;
    if (filterRead === "read" && !isRead) return false;
    if (filterType !== "all" && item.type !== filterType) return false;
    if (onlyFavoris && !item.isFavori) return false;
    if (search && !item.fileName.toLowerCase().includes(search.toLowerCase()) && !courrierTypeLabel(item.type).toLowerCase().includes(search.toLowerCase())) return false;
    if (filterDate !== "all") {
      const ageDays = (Date.now() - new Date(item.receivedAt).getTime()) / 86400000;
      if (filterDate === "7" && ageDays > 7) return false;
      if (filterDate === "30" && ageDays > 30) return false;
      if (filterDate === "older" && ageDays <= 30) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes documents"
        description={`${items.length} document(s) partagé(s) par notre équipe — contraventions, mises en demeure, URSSAF, retards de paiement, sinistres, certificats, factures, impôts et autres courriers.`}
      />

      {!loading && items.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un document…"
                className="field w-full pl-8 text-sm"
              />
            </div>
            {uniqueTypes.length > 1 && (
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="field w-auto text-sm">
                <option value="all">Toutes les catégories</option>
                {uniqueTypes.map((type) => (
                  <option key={type} value={type}>{courrierTypeLabel(type)}</option>
                ))}
              </select>
            )}
            <select value={filterDate} onChange={(e) => setFilterDate(e.target.value as typeof filterDate)} className="field w-auto text-sm">
              {DATE_RANGES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOnlyFavoris(!onlyFavoris)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                onlyFavoris ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Star size={13} className={onlyFavoris ? "fill-amber-400 text-amber-500" : ""} /> Favoris
            </button>
          </div>
          <div className="flex gap-2">
            {(
              [
                { key: "all", label: `Tous (${items.length})` },
                { key: "unread", label: `Non lus (${items.filter((i) => !(i.data as { isRead?: boolean } | undefined)?.isRead).length})` },
                { key: "read", label: `Lus (${items.filter((i) => (i.data as { isRead?: boolean } | undefined)?.isRead).length})` },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterRead(f.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filterRead === f.key ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Aucun document à afficher"
          description={items.length > 0 ? "Aucun document ne correspond à vos critères de filtre." : "Les documents que notre équipe partage avec vous apparaîtront ici."}
        />
      ) : (
        <div className="table-shell">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="w-8 p-3 text-left"></th>
                <th className="w-8 p-3 text-left"></th>
                <th className="p-3 text-left">Catégorie</th>
                <th className="p-3 text-left">Nom du fichier</th>
                <th className="p-3 text-left">Reçu le</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isRead = (item.data as { isRead?: boolean; lastReadAt?: string } | undefined)?.isRead === true;
                const lastReadAt = (item.data as { lastReadAt?: string } | undefined)?.lastReadAt;
                const expanded = expandedId === item.id;
                return (
                  <Fragment key={item.id}>
                    <tr className={`border-t border-slate-100 transition ${isRead ? "hover:bg-slate-50" : "bg-teal-50/50 hover:bg-teal-50"}`}>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleMarkRead(item.id, !isRead)}
                          disabled={busy[item.id]}
                          className="p-1 transition hover:opacity-70 disabled:opacity-50"
                          title={isRead ? "Marquer comme non lu" : "Marquer comme lu"}
                        >
                          {busy[item.id] ? <Loader2 size={16} className="animate-spin text-teal-600" /> : isRead ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Circle size={16} className="text-slate-400" />}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleFavori(item.id, !item.isFavori)}
                          className="p-1 transition hover:opacity-70"
                          title={item.isFavori ? "Retirer des favoris" : "Ajouter aux favoris"}
                        >
                          <Star size={16} className={item.isFavori ? "fill-amber-400 text-amber-500" : "text-slate-300"} />
                        </button>
                      </td>
                      <td className="p-3"><Badge tone={documentTypeTone(courrierTypeLabel(item.type))}>{courrierTypeLabel(item.type)}</Badge></td>
                      <td className="max-w-xs truncate p-3 font-medium" title={item.fileName}>{item.fileName}</td>
                      <td className="p-3 text-slate-600">{fmtDateTime(new Date(item.receivedAt))}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <DocumentViewerTrigger
                            fileUrl={`/api/client/courriers/${item.id}/document`}
                            downloadUrl={`/api/client/courriers/${item.id}/document?download=1`}
                            fileName={item.fileName}
                            fileMime={item.fileMime}
                            title="Visualiser"
                            className="inline-flex items-center gap-1.5 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Eye size={15} />
                          </DocumentViewerTrigger>
                          <a
                            href={`/api/client/courriers/${item.id}/document?download=1`}
                            download={item.fileName}
                            title="Télécharger"
                            className="inline-flex items-center gap-1.5 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Download size={15} />
                          </a>
                          <EnvoyerDocumentButton
                            context={{ courrierId: item.id, dossierLabel: item.fileName }}
                            label=""
                            className="inline-flex items-center gap-1.5 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                          />
                          <button
                            onClick={() => setExpandedId(expanded ? null : item.id)}
                            title="Historique du dossier"
                            className="inline-flex items-center gap-1.5 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                          >
                            <History size={15} />
                            <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-t border-slate-100 bg-slate-50/70">
                        <td colSpan={6} className="p-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Historique du dossier</p>
                          <ul className="space-y-1.5 text-sm text-slate-600">
                            <li>Reçu le {fmtDateTime(new Date(item.receivedAt))}</li>
                            {lastReadAt && <li>Marqué comme lu le {fmtDateTime(new Date(lastReadAt))}</li>}
                            {item.pieceJointesAjoutees.map((p, i) => (
                              <li key={i} className="flex items-center gap-1.5"><Paperclip size={12} className="text-slate-400" /> Pièce jointe ajoutée le {fmtDateTime(new Date(p.date))}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
