import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/utils";
import Link from "next/link";
import { Plus, ScanLine, ExternalLink, FileWarning } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { toggleVisibleClientAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ContraventionsListPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawView = Array.isArray(resolvedSearchParams.view)
    ? resolvedSearchParams.view[0]
    : resolvedSearchParams.view;
  const view = rawView === "denonciations" || rawView === "paiements" || rawView === "retards"
    ? rawView
    : "all";

  const items = await prisma.contravention.findMany({
    where: isAdmin ? {} : { societe },
    include: { vehicule: true, conducteur: true },
    orderBy: { createdAt: "desc" },
  });

  const filteredItems = items.filter((item) => {
    if (view === "denonciations") {
      return item.statutDenonciation !== "Effectuée";
    }
    if (view === "paiements") {
      return item.statutPaiement === "En attente";
    }
    if (view === "retards") {
      return item.statutPaiement !== "Payé" && item.dateLimitePaiement && item.dateLimitePaiement !== "";
    }
    return true;
  });

  const counts = {
    all: items.length,
    denonciations: items.filter((item) => item.statutDenonciation !== "Effectuée").length,
    paiements: items.filter((item) => item.statutPaiement === "En attente").length,
    retards: items.filter((item) => item.statutPaiement !== "Payé" && item.dateLimitePaiement && item.dateLimitePaiement !== "").length,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Suivi</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Contraventions</h1>
          <p className="mt-1 text-sm text-slate-500">{filteredItems.length} dossier(s) affiché(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/contraventions/scan" className="btn-primary">
            <ScanLine size={16} /> Scanner
          </Link>
          <Link href="/contraventions/new" className="btn-secondary">
            <Plus size={16} /> Saisir
          </Link>
          <a href="https://www.antai.gouv.fr" target="_blank" rel="noopener noreferrer" className="btn-secondary">
            <ExternalLink size={16} /> ANTAI
          </a>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterLink href="/contraventions?view=all" label="Tous" count={counts.all} active={view === "all"} />
        <FilterLink href="/contraventions?view=denonciations" label="À dénoncer" count={counts.denonciations} active={view === "denonciations"} />
        <FilterLink href="/contraventions?view=paiements" label="Paiements en attente" count={counts.paiements} active={view === "paiements"} />
        <FilterLink href="/contraventions?view=retards" label="Retards" count={counts.retards} active={view === "retards"} />
      </div>

      <div className="table-shell overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3 text-left">Société</th>
              <th className="p-3 text-left">N° Dossier</th>
              <th className="p-3 text-left">Date infraction</th>
              <th className="p-3 text-left">Nature</th>
              <th className="p-3 text-left">Lieu</th>
              <th className="p-3 text-left">Véhicule</th>
              <th className="p-3 text-left">Conducteur</th>
              <th className="p-3 text-right">Montant</th>
              <th className="p-3 text-left">Dénonciation</th>
              <th className="p-3 text-left">Paiement</th>
              {isAdmin && <th className="p-3 text-left">Client</th>}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((c) => (
              <tr key={c.id} className="table-row">
                <td className="p-3 text-slate-700">{c.societe}</td>
                <td className="p-3 font-mono text-xs">
                  <Link href={`/contraventions/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.numDossier}</Link>
                </td>
                <td className="p-3 text-slate-600">{c.dateInfraction ?? "—"} {c.heureInfraction ?? ""}</td>
                <td className="p-3 max-w-xs truncate text-slate-600" title={c.natureInfraction ?? ""}>{c.natureInfraction ?? "—"}</td>
                <td className="p-3 max-w-xs truncate text-slate-600" title={c.lieuInfraction ?? ""}>{c.lieuInfraction ?? "—"}</td>
                <td className="p-3 text-slate-600">{c.vehicule?.immatriculation ?? c.immatriculationOcr ?? "—"}</td>
                <td className="p-3 text-slate-600">{c.conducteur ? `${c.conducteur.prenom} ${c.conducteur.nom}` : "—"}</td>
                <td className="p-3 text-right font-medium text-slate-900">{fmtMoney(c.montantAmende)}</td>
                <td className="p-3">
                  <span className={badge(c.statutDenonciation)}>{c.statutDenonciation}</span>
                </td>
                <td className="p-3">
                  <span className={badge(c.statutPaiement)}>{c.statutPaiement}</span>
                </td>
                {isAdmin && (
                  <td className="p-3">
                    <form action={toggleVisibleClientAction.bind(null, c.id, !c.visibleClient)}>
                      <button
                        type="submit"
                        className={
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition " +
                          (c.visibleClient
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100")
                        }
                        title="Visible par le client"
                      >
                        <span className={"h-1.5 w-1.5 rounded-full " + (c.visibleClient ? "bg-emerald-500" : "bg-slate-400")} />
                        {c.visibleClient ? "Visible" : "Masquée"}
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 11 : 10}>
                  <EmptyState
                    icon={FileWarning}
                    title="Aucune contravention pour cette vue"
                    description="Scannez un avis de contravention ou ajustez les filtres ci-dessus."
                    action={{ label: "Scanner un document", href: "/contraventions/scan" }}
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

function FilterLink({ href, label, count, active }: { href: string; label: string; count: number; active: boolean }) {
  return (
    <Link href={href} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${active ? "border-brand-600 bg-brand-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}>
      {label} <span className={active ? "text-white/80" : "text-slate-500"}>({count})</span>
    </Link>
  );
}

function badge(s?: string | null) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ";
  if (s === "Effectuée" || s === "Payé") return base + "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "En retard") return base + "border-rose-200 bg-rose-50 text-rose-700";
  if (s === "À effectuer" || s === "En attente") return base + "border-amber-200 bg-amber-50 text-amber-700";
  return base + "border-slate-200 bg-slate-50 text-slate-600";
}
