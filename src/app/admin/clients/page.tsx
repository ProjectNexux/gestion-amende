import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Search, Plus, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CLIENT_STATUS_LABELS, clientStatusTone, deriveClientStatus, formatSiretMasked, fullContactName } from "@/lib/clients";
import { fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ADMIN_SOCIETE = process.env.ADMIN_SOCIETE ?? "Mon espace";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!(await isAdminSession())) redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim().toLowerCase();

  // The special ADMIN_SOCIETE row (Mon espace) is never a "client" — it's the back-office account
  // itself. Excluded from this list on purpose so it can't be accidentally deactivated/edited here.
  const societes = await prisma.societe.findMany({
    where: { nom: { not: ADMIN_SOCIETE } },
    orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { users: true, courriers: true, vehicules: true, conducteurs: true, sinistres: true } },
      users: { select: { lastLoginAt: true }, orderBy: { lastLoginAt: "desc" }, take: 1 },
    },
  });

  const filtered = q
    ? societes.filter((s) => {
        const hay = [s.nom, s.tradeName, s.siret, s.city, s.email, s.contactFirstName, s.contactLastName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : societes;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">{filtered.length} société(s) cliente(s)</p>
        </div>
        <Link href="/admin/clients/new" className="btn-primary">
          <Plus size={16} /> Ajouter un client
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" method="get">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" name="q" defaultValue={q} placeholder="Nom, SIRET, ville, e-mail…" className="field pl-9" />
        </div>
        <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]">
          Rechercher
        </button>
        {q && <Link href="/admin/clients" className="text-sm text-slate-500 hover:underline">Réinitialiser</Link>}
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-indigo-50/50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Société</th>
              <th className="p-3 text-left">SIRET</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-left">Ville</th>
              <th className="p-3 text-left">Statut</th>
              <th className="p-3 text-left">Créé le</th>
              <th className="p-3 text-left">Dernière connexion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const status = deriveClientStatus(s);
              const contactName = fullContactName(s);
              const lastLogin = s.users[0]?.lastLoginAt ?? null;
              return (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <td className="p-3">
                    <Link href={`/admin/clients/${s.id}`} className="block">
                      <div className="font-medium text-slate-900">{s.nom}</div>
                      {s.tradeName && <div className="text-xs text-slate-500">{s.tradeName}</div>}
                    </Link>
                  </td>
                  <td className="p-3 font-mono text-xs text-slate-600">{formatSiretMasked(s.siret)}</td>
                  <td className="p-3">
                    <div className="text-slate-800">{contactName || "—"}</div>
                    {s.email && <div className="text-xs text-slate-500">{s.email}</div>}
                    {s.phone && <div className="text-xs text-slate-500">{s.phone}</div>}
                  </td>
                  <td className="p-3">{s.city ?? "—"}</td>
                  <td className="p-3"><Badge tone={clientStatusTone(status)}>{CLIENT_STATUS_LABELS[status]}</Badge></td>
                  <td className="p-3 text-slate-500">{fmtDateTime(s.createdAt)}</td>
                  <td className="p-3 text-slate-500">{lastLogin ? fmtDateTime(lastLogin) : "—"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={Building2}
                    title={q ? "Aucun client ne correspond à cette recherche" : "Aucun client pour le moment"}
                    description={q ? "Essayez de vider la recherche ou d'utiliser d'autres mots-clés." : "Cliquez sur « Ajouter un client » pour créer votre première fiche."}
                    action={q ? undefined : { label: "Ajouter un client", href: "/admin/clients/new" }}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
