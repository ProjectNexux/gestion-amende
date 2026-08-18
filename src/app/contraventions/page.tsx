import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/utils";
import Link from "next/link";
import { Plus, ScanLine, ExternalLink } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";

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
          <h1 className="text-2xl font-semibold">Contraventions</h1>
          <p className="text-sm text-slate-500">{filteredItems.length} dossier(s) affiché(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/contraventions/scan" className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-brand-dark)]">
            <ScanLine size={16} /> Scanner
          </Link>
          <Link href="/contraventions/new" className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <Plus size={16} /> Saisir
          </Link>
          <a href="https://www.antai.gouv.fr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3">Société</th>
              <th className="text-left p-3">N° Dossier</th>
              <th className="text-left p-3">Date infraction</th>
              <th className="text-left p-3">Nature</th>
              <th className="text-left p-3">Lieu</th>
              <th className="text-left p-3">Véhicule</th>
              <th className="text-left p-3">Conducteur</th>
              <th className="text-right p-3">Montant</th>
              <th className="text-left p-3">Dénonciation</th>
              <th className="text-left p-3">Paiement</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3">{c.societe}</td>
                <td className="p-3 font-mono text-xs">
                  <Link href={`/contraventions/${c.id}`} className="text-[var(--color-brand)] hover:underline">{c.numDossier}</Link>
                </td>
                <td className="p-3">{c.dateInfraction ?? "—"} {c.heureInfraction ?? ""}</td>
                <td className="p-3 max-w-xs truncate" title={c.natureInfraction ?? ""}>{c.natureInfraction ?? "—"}</td>
                <td className="p-3 max-w-xs truncate" title={c.lieuInfraction ?? ""}>{c.lieuInfraction ?? "—"}</td>
                <td className="p-3">{c.vehicule?.immatriculation ?? c.immatriculationOcr ?? "—"}</td>
                <td className="p-3">{c.conducteur ? `${c.conducteur.prenom} ${c.conducteur.nom}` : "—"}</td>
                <td className="p-3 text-right">{fmtMoney(c.montantAmende)}</td>
                <td className="p-3">
                  <span className={badge(c.statutDenonciation)}>{c.statutDenonciation}</span>
                </td>
                <td className="p-3">
                  <span className={badge(c.statutPaiement)}>{c.statutPaiement}</span>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-500">Aucune contravention pour cette vue.</td>
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
    <Link href={href} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${active ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
      {label} <span className={active ? "text-white/80" : "text-slate-500"}>({count})</span>
    </Link>
  );
}

function badge(s?: string | null) {
  const base = "inline-block rounded-full px-2.5 py-1 text-xs font-medium ";
  if (s === "Effectuée" || s === "Payé") return base + "bg-emerald-100 text-emerald-800";
  if (s === "En retard") return base + "bg-rose-100 text-rose-800";
  if (s === "À effectuer" || s === "En attente") return base + "bg-amber-100 text-amber-800";
  return base + "bg-slate-100 text-slate-700";
}
