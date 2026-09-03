"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CLIENT_STATUS_LABELS, type ClientStatus, formatSiretMasked } from "@/lib/clients";
import { fmtDateTime } from "@/lib/utils";
import { activateClientAction, deactivateClientAction, reactivateClientAction, sendInvitationAction, regenerateSetupLinkAction, deleteClientAction } from "./actions";

// Fields that are cheap to serialize from server to client (all primitives).
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
  counts: { vehicules: number; conducteurs: number; courriers: number };
};

export function ClientsTable({ rows }: { rows: ClientListRow[] }) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-indigo-50/50 text-slate-600">
          <tr>
            <th className="p-3 text-left">Société</th>
            <th className="p-3 text-left">SIRET</th>
            <th className="p-3 text-left">Contact</th>
            <th className="p-3 text-left">Ville</th>
            <th className="p-3 text-right">Véh.</th>
            <th className="p-3 text-right">Cond.</th>
            <th className="p-3 text-right">Docs</th>
            <th className="p-3 text-left">Statut</th>
            <th className="p-3 text-left">Dernière connexion</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => router.push(`/admin/clients/${r.id}`)}
              className="cursor-pointer border-t border-slate-100 transition hover:bg-brand-50/40"
            >
              <td className="p-3">
                <div className="font-medium text-slate-900">{r.nom}</div>
                {r.tradeName && <div className="text-xs text-slate-500">{r.tradeName}</div>}
              </td>
              <td className="p-3 font-mono text-xs text-slate-600">{formatSiretMasked(r.siret)}</td>
              <td className="p-3">
                <div className="text-slate-800">{r.contactName || "—"}</div>
                {r.email && <div className="text-xs text-slate-500">{r.email}</div>}
                {r.phone && <div className="text-xs text-slate-500">{r.phone}</div>}
              </td>
              <td className="p-3">{r.city ?? "—"}</td>
              <td className="p-3 text-right tabular-nums text-slate-700">{r.counts.vehicules}</td>
              <td className="p-3 text-right tabular-nums text-slate-700">{r.counts.conducteurs}</td>
              <td className="p-3 text-right tabular-nums text-slate-700">{r.counts.courriers}</td>
              <td className="p-3"><Badge tone={r.statusTone}>{CLIENT_STATUS_LABELS[r.status]}</Badge></td>
              <td className="p-3 text-slate-500">{r.lastLoginAt ? fmtDateTime(new Date(r.lastLoginAt)) : "—"}</td>
              <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                <RowActionsMenu row={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Native <details>-based dropdown — server actions inside the menu POST normally, no client
 * JavaScript beyond the <details> disclosure and stopPropagation on the cell (so clicking the
 * menu doesn't also trigger the row navigation).
 */
function RowActionsMenu({ row }: { row: ClientListRow }) {
  const canActivate = row.status !== "actif";
  const canDeactivate = row.status !== "desactive";

  return (
    <details className="group relative inline-block text-left">
      <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <MoreHorizontal size={16} />
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
        <a href={`/admin/clients/${row.id}`} className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Ouvrir la fiche</a>
        <a href={`/admin/clients/${row.id}?tab=infos`} className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Modifier les informations</a>
        <div className="my-1 border-t border-slate-100" />
        {canActivate && (
          <form action={activateClientAction.bind(null, row.id)}>
            <button className="block w-full px-3 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50">Activer le compte</button>
          </form>
        )}
        {canDeactivate && row.status !== "desactive" && (
          <form action={deactivateClientAction.bind(null, row.id)}>
            <ConfirmSubmitButton confirmMessage={`Désactiver le compte de ${row.nom} ?`} className="block w-full px-3 py-1.5 text-left text-xs text-amber-700 hover:bg-amber-50">
              Désactiver le compte
            </ConfirmSubmitButton>
          </form>
        )}
        {row.status === "desactive" && (
          <form action={reactivateClientAction.bind(null, row.id)}>
            <button className="block w-full px-3 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50">Réactiver le compte</button>
          </form>
        )}
        {row.email && (
          <form action={sendInvitationAction.bind(null, row.id)}>
            <button className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50">Envoyer l&apos;invitation</button>
          </form>
        )}
        <form action={regenerateSetupLinkAction.bind(null, row.id)}>
          <button className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50">Régénérer le lien d&apos;accès</button>
        </form>
        <div className="my-1 border-t border-slate-100" />
        <form action={deleteClientAction.bind(null, row.id)}>
          <ConfirmSubmitButton confirmMessage={`Supprimer / archiver le client ${row.nom} ? Si des documents existent, il sera simplement archivé.`} className="block w-full px-3 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50">
            Supprimer / archiver
          </ConfirmSubmitButton>
        </form>
      </div>
    </details>
  );
}
