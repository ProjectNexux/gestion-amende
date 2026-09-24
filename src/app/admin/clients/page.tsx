import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/auth";
import { getVisibleSocieteNames } from "@/lib/org-scope";
import { redirect } from "next/navigation";
import { Plus, Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CLIENT_STATUS_LABELS, clientStatusTone, deriveClientStatus, fullContactName, type ClientStatus } from "@/lib/clients";
import { ClientsList, type ClientListRow } from "./ClientsList";
import { HelpHint } from "@/components/ui/HelpHint";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { key: "all" | ClientStatus; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "actif", label: "Actifs" },
  { key: "invitation_attente", label: "Invitations en attente" },
  { key: "desactive", label: "Désactivés" },
  { key: "archive", label: "Archivés" },
];

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!(await isAdminSession())) redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim().toLowerCase();
  const statusParam = (Array.isArray(sp.status) ? sp.status[0] : sp.status) ?? "all";
  const activeStatus = STATUS_FILTERS.some((f) => f.key === statusParam) ? (statusParam as "all" | ClientStatus) : "all";

  const names = await getVisibleSocieteNames();
  const societes = await prisma.societe.findMany({
    where: { isOrganizationHome: false, ...(names === "all-own-societe" ? {} : { nom: { in: names } }) },
    orderBy: [{ createdAt: "desc" }],
    include: {
      users: { select: { lastLoginAt: true }, orderBy: { lastLoginAt: "desc" }, take: 1 },
    },
  });

  // Documents/contraventions live on separate models keyed by société *nom* (not id) — one
  // grouped count query each instead of N+1 per row.
  const [courrierCounts, contraventionCounts] = await Promise.all([
    prisma.courrier.groupBy({ by: ["societe"], _count: { _all: true } }),
    prisma.contravention.groupBy({ by: ["societe"], _count: { _all: true } }),
  ]);
  const courrierCountByNom = new Map(courrierCounts.map((c) => [c.societe, c._count._all]));
  const contraventionCountByNom = new Map(contraventionCounts.map((c) => [c.societe, c._count._all]));

  const allRows: ClientListRow[] = societes.map((s) => {
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
      counts: {
        documents: courrierCountByNom.get(s.nom) ?? 0,
        contraventions: contraventionCountByNom.get(s.nom) ?? 0,
      },
    };
  });

  const statusCounts: Record<"all" | ClientStatus, number> = {
    all: allRows.length,
    actif: 0,
    invitation_attente: 0,
    desactive: 0,
    archive: 0,
  };
  for (const r of allRows) statusCounts[r.status]++;

  const statusFiltered = activeStatus === "all" ? allRows : allRows.filter((r) => r.status === activeStatus);
  const filtered = q
    ? statusFiltered.filter((r) => {
        const hay = [r.nom, r.tradeName, r.siret, r.city, r.email, r.contactName, r.phone].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      })
    : statusFiltered;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
            Clients
            <HelpHint
              text="Créez une société avec « Créer un client », puis ouvrez sa fiche et l'onglet Utilisateurs pour ajouter des comptes individuels (e-mail + mot de passe) avec « Ajouter un utilisateur »."
              guideHref="/aide/creer-un-client"
            />
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Gérez les sociétés clientes et leurs accès au portail : création de comptes, invitations, activation,
            désactivation et suivi de leurs documents et contraventions.
          </p>
        </div>
        <Link href="/admin/clients/new" className="btn-primary shrink-0">
          <Plus size={16} /> Créer un client
        </Link>
      </div>

      <ClientsList
        rows={filtered}
        query={q}
        activeStatus={activeStatus}
        statusFilters={STATUS_FILTERS.map((f) => ({ ...f, count: statusCounts[f.key] }))}
        statusLabels={CLIENT_STATUS_LABELS}
        emptyState={
          <EmptyState
            icon={Building2}
            title={q ? "Aucun client ne correspond à cette recherche" : "Aucun client pour le moment"}
            description={
              q
                ? "Essayez de vider la recherche ou d'utiliser d'autres mots-clés."
                : "Cliquez sur « Créer un client » pour ajouter votre première société."
            }
            action={q ? undefined : { label: "Créer un client", href: "/admin/clients/new" }}
          />
        }
      />
    </div>
  );
}
