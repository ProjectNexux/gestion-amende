"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { courrierTypeLabel } from "@/lib/courriers";
import { Download, Eye, Mail, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { fmtDateTime } from "@/lib/utils";

type Courrier = {
  id: string;
  type: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  receivedAt: string;
  data?: Record<string, unknown>;
};

export default function ClientCourriersPage() {
  const [items, setItems] = useState<Courrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRead, setFilterRead] = useState<"all" | "unread" | "read">("all");
  const [filterType, setFilterType] = useState("all");
  const [markingRead, setMarkingRead] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchCourriers();
  }, []);

  const fetchCourriers = async () => {
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

  const handleMarkRead = async (id: string, isRead: boolean) => {
    setMarkingRead((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/client/courriers/${id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                data: { ...(item.data || {}), isRead, lastReadAt: new Date().toISOString() },
              }
            : item
        )
      );
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setMarkingRead((p) => ({ ...p, [id]: false }));
    }
  };

  const uniqueTypes = Array.from(new Set(items.map((i) => i.type)));
  const filteredItems = items.filter((item) => {
    const isRead = (item.data as any)?.isRead === true;
    if (filterRead === "unread" && isRead) return false;
    if (filterRead === "read" && !isRead) return false;
    if (filterType !== "all" && item.type !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Mes courriers" 
        description={`${filteredItems.length} document(s) partagé(s) par notre équipe`} 
      />

      {/* Filters */}
      {!loading && items.length > 0 && (
        <div className="flex flex-wrap gap-3 bg-white rounded-lg p-4 shadow-sm">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterRead("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filterRead === "all"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Tous ({items.length})
            </button>
            <button
              onClick={() => setFilterRead("unread")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filterRead === "unread"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Non lus ({items.filter((i) => !(i.data as any)?.isRead).length})
            </button>
            <button
              onClick={() => setFilterRead("read")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filterRead === "read"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Lus ({items.filter((i) => (i.data as any)?.isRead).length})
            </button>
          </div>

          {uniqueTypes.length > 1 && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            >
              <option value="all">Tous les types</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {courrierTypeLabel(type)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Aucun courrier à afficher"
          description={
            items.length > 0
              ? "Aucun document ne correspond à vos critères de filtre."
              : "Les documents que notre équipe partage avec vous apparaîtront ici."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3 text-left w-8"></th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Nom du fichier</th>
                <th className="p-3 text-left">Reçu le</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isRead = (item.data as any)?.isRead === true;
                return (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 transition ${
                      isRead ? "hover:bg-slate-50" : "bg-blue-50 hover:bg-blue-100"
                    }`}
                  >
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleMarkRead(item.id, !isRead)}
                        disabled={markingRead[item.id]}
                        className="p-1 hover:opacity-70 transition disabled:opacity-50"
                        title={isRead ? "Marquer comme non lu" : "Marquer comme lu"}
                      >
                        {markingRead[item.id] ? (
                          <Loader2 size={16} className="animate-spin text-brand-600" />
                        ) : isRead ? (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        ) : (
                          <Circle size={16} className="text-slate-400" />
                        )}
                      </button>
                    </td>
                    <td className="p-3">
                      <Badge tone="neutral">{courrierTypeLabel(item.type)}</Badge>
                    </td>
                    <td className="p-3 max-w-xs truncate font-medium" title={item.fileName}>
                      {item.fileName}
                    </td>
                    <td className="p-3 text-slate-600">{fmtDateTime(item.receivedAt)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
