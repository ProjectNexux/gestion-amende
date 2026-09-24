"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { MoreHorizontal, Search, FileText, FileWarning } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { formatSiretMasked, type ClientStatus } from "@/lib/clients";
import { fmtDateTime } from "@/lib/utils";
import {
  activateClientAction,
  deactivateClientAction,
  reactivateClientAction,
  unarchiveClientAction,
  sendInvitationAction,
  regenerateSetupLinkAction,
} from "./actions";

export type ClientListRow = {
  id: string;
  nom: string;
  tradeName: string | null;
  siret: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  contactName: string;
  status: ClientStatus;
  statusTone: BadgeTone;
  createdAt: string; // ISO
  lastLoginAt: string | null; // ISO
  counts: { documents: number; contraventions: number };
};

export function ClientsList({
  rows,
  query,
  activeStatus,
  statusFilters,
  statusLabels,
  emptyState,
}: {
  rows: ClientListRow[];
  query: string;
  activeStatus: "all" | ClientStatus;
  statusFilters: { key: "all" | ClientStatus; label: string; count: number }[];
  statusLabels: Record<ClientStatus, string>;
  emptyState: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);

  function pushParams(next: { q?: string; status?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q !== undefined) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    if (next.status !== undefined) {
      if (next.status && next.status !== "all") params.set("status", next.status);
      else params.delete("status");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <form
          className="relative flex-1 min-w-[240px] max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            pushParams({ q: search });
          }}
        >
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, SIRET, ville, e-mail, contact…"
            className="field pl-9"
          />
        </form>

        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((f) => {
            const active = activeStatus === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => pushParams({ status: f.key })}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-medium transition " +
                  (active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                }
              >
                {f.label} ({f.count})
              </button>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{emptyState}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="p-3 text-left">Raison sociale</th>
                  <th className="p-3 text-left">SIRET</th>
                  <th className="p-3 text-left">Contact principal</th>
                  <th className="p-3 text-left">E-mail</th>
                  <th className="p-3 text-right">Documents</th>
                  <th className="p-3 text-right">Contraventions</th>
                  <th className="p-3 text-left">État du compte</th>
                  <th className="p-3 text-left">Dernière activité</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/admin/clients/${r.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/admin/clients/${r.id}`);
                      }
                    }}
                    role="link"
                    tabIndex={0}
                    aria-label={`Ouvrir la fiche de ${r.nom}`}
                    className="cursor-pointer border-t border-slate-100 transition hover:bg-brand-50/40 focus-visible:bg-brand-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
                  >
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{r.nom}</div>
                      {r.tradeName && <div className="text-xs text-slate-500">{r.tradeName}</div>}
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-600">{formatSiretMasked(r.siret)}</td>
                    <td className="p-3 text-slate-700">{r.contactName || "—"}</td>
                    <td className="p-3 text-slate-600">{r.email ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums text-slate-700">
                      <span className="inline-flex items-center gap-1"><FileText size={12} className="text-slate-400" /> {r.counts.documents}</span>
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-700">
                      <span className="inline-flex items-center gap-1"><FileWarning size={12} className="text-slate-400" /> {r.counts.contraventions}</span>
                    </td>
                    <td className="p-3"><Badge tone={r.statusTone}>{statusLabels[r.status]}</Badge></td>
                    <td className="p-3 text-slate-500">{r.lastLoginAt ? fmtDateTime(new Date(r.lastLoginAt)) : "Jamais connecté"}</td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Native <details>-based dropdown. Non-redirecting actions go through `ActionForm` (direct call +
 * `router.refresh()`) so the row updates immediately without a manual page reload.
 */
function RowActionsMenu({ row }: { row: ClientListRow }) {
  return (
    <details className="group relative inline-block text-left">
      <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <MoreHorizontal size={16} />
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
        <a href={`/admin/clients/${row.id}`} className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Ouvrir la fiche</a>
        <a href={`/admin/clients/${row.id}?tab=parametres`} className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Modifier les informations</a>
        <div className="my-1 border-t border-slate-100" />
        {row.status !== "actif" && (
          <ActionForm action={activateClientAction.bind(null, row.id)}>
            <button className="block w-full px-3 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50">Activer le compte</button>
          </ActionForm>
        )}
        {row.status === "actif" && (
          <ActionForm action={deactivateClientAction.bind(null, row.id)}>
            <ConfirmSubmitButton confirmMessage={`Désactiver le compte de ${row.nom} ?`} className="block w-full px-3 py-1.5 text-left text-xs text-amber-700 hover:bg-amber-50">
              Désactiver le compte
            </ConfirmSubmitButton>
          </ActionForm>
        )}
        {row.status === "desactive" && (
          <ActionForm action={reactivateClientAction.bind(null, row.id)}>
            <button className="block w-full px-3 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50">Réactiver le compte</button>
          </ActionForm>
        )}
        {row.status === "archive" && (
          <ActionForm action={unarchiveClientAction.bind(null, row.id)}>
            <button className="block w-full px-3 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50">Désarchiver</button>
          </ActionForm>
        )}
        {row.email && (
          <ActionForm action={sendInvitationAction.bind(null, row.id)}>
            <button className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50">Envoyer l&apos;invitation</button>
          </ActionForm>
        )}
        <ActionForm action={regenerateSetupLinkAction.bind(null, row.id)}>
          <button className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50">Régénérer le lien d&apos;accès</button>
        </ActionForm>
      </div>
    </details>
  );
}
