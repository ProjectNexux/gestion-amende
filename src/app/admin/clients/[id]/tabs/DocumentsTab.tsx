"use client";

import { useState } from "react";
import { Search, Eye, Download } from "lucide-react";
import { Badge, documentTypeTone } from "@/components/ui/Badge";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ActionForm } from "@/components/ActionForm";
import { courrierTypeLabel } from "@/lib/courriers";
import { fmtDateTime } from "@/lib/utils";
import { toggleCourrierVisibleAction } from "../../actions";

export type CourrierRow = {
  id: string;
  type: string;
  fileName: string;
  fileMime: string;
  receivedAt: string; // ISO
  visibleClient: boolean;
};

export function DocumentsTab({ societeId, courriers }: { societeId: string; courriers: CourrierRow[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const types = Array.from(new Set(courriers.map((c) => c.type)));
  const filtered = courriers.filter((c) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (search && !c.fileName.toLowerCase().includes(search.toLowerCase()) && !courrierTypeLabel(c.type).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">{courriers.length} document(s) au total</h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un document…"
              className="field w-56 pl-8 text-xs"
            />
          </div>
          {types.length > 1 && (
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="field w-auto text-xs">
              <option value="all">Tous les types</option>
              {types.map((t) => (
                <option key={t} value={t}>{courrierTypeLabel(t)}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun document pour cette société.</p>
      ) : (
        <div className="table-shell overflow-hidden">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Fichier</th>
                <th className="p-3 text-left">Reçu le</th>
                <th className="p-3 text-left">Portail client</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="p-3"><Badge tone={documentTypeTone(courrierTypeLabel(c.type))}>{courrierTypeLabel(c.type)}</Badge></td>
                  <td className="p-3 text-slate-700">{c.fileName}</td>
                  <td className="p-3 text-slate-500">{fmtDateTime(new Date(c.receivedAt))}</td>
                  <td className="p-3">
                    <Badge tone={c.visibleClient ? "success" : "neutral"}>{c.visibleClient ? "Transmis" : "Non transmis"}</Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <DocumentViewerTrigger
                        fileUrl={`/api/courriers/${c.id}`}
                        downloadUrl={`/api/courriers/${c.id}?download=1`}
                        fileName={c.fileName}
                        fileMime={c.fileMime}
                        className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                        title="Visualiser"
                      >
                        <Eye size={15} />
                      </DocumentViewerTrigger>
                      <a
                        href={`/api/courriers/${c.id}?download=1`}
                        className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                        title="Télécharger"
                      >
                        <Download size={15} />
                      </a>
                      <ActionForm action={toggleCourrierVisibleAction.bind(null, c.id, !c.visibleClient, societeId)}>
                        <button type="submit" className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          {c.visibleClient ? "Retirer" : "Transmettre"}
                        </button>
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
