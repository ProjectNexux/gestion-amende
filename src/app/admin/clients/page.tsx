import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Search, Plus, Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { clientStatusTone, deriveClientStatus, fullContactName } from "@/lib/clients";
import { ClientsTable, type ClientListRow } from "./ClientsTable";

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

  const societes = await prisma.societe.findMany({
    where: { nom: { not: ADMIN_SOCIETE } },
    orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { users: true, courriers: true, vehicules: true, conducteurs: true, sinistres: true } },
      users: { select: { lastLoginAt: true }, orderBy: { lastLoginAt: "desc" }, take: 1 },
    },
  });

  const rows: ClientListRow[] = societes.map((s) => {
    const status = deriveClientStatus(s);
    return {
      id: s.id,
      nom: s.nom,
      tradeName: s.tradeName,
      siret: s.siret,
      city: s.city,
      email: s.email,
      phone: s.phone,
      contactName: fullContactName(s),
      status,
      statusTone: clientStatusTone(status),
      createdAt: s.createdAt.toISOString(),
      lastLoginAt: s.users[0]?.lastLoginAt?.toISOString() ?? null,
      counts: { vehicules: s._count.vehicules, conducteurs: s._count.conducteurs, courriers: s._count.courriers },
    };
  });

  const filtered = q
    ? rows.filter((r) => {
        const hay = [r.nom, r.tradeName, r.siret, r.city, r.email, r.contactName, r.phone].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      })
    : rows;

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
          <input type="text" name="q" defaultValue={q} placeholder="Nom, SIRET, ville, e-mail, contact…" className="field pl-9" />
        </div>
        <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]">
          Rechercher
        </button>
        {q && <Link href="/admin/clients" className="text-sm text-slate-500 hover:underline">Réinitialiser</Link>}
      </form>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <EmptyState
            icon={Building2}
            title={q ? "Aucun client ne correspond à cette recherche" : "Aucun client pour le moment"}
            description={q ? "Essayez de vider la recherche ou d'utiliser d'autres mots-clés." : "Cliquez sur « Ajouter un client » pour créer votre première fiche."}
            action={q ? undefined : { label: "Ajouter un client", href: "/admin/clients/new" }}
          />
        </div>
      ) : (
        <ClientsTable rows={filtered} />
      )}
    </div>
  );
}
