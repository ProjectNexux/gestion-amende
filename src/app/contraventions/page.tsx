import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/utils";
import Link from "next/link";
import { Plus, ScanLine, ExternalLink, FileWarning } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { toggleVisibleClientAction } from "./actions";
import { Badge } from "@/components/ui/Badge";
import { HelpHint } from "@/components/ui/HelpHint";
import { getStatusHint } from "@/lib/help-content";

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
  
  const view = rawView === "a_denoncer" || rawView === "paiement_attente" || rawView === "en_retard" || rawView === "terminees"
    ? rawView
    : "toutes";

  // Filtre additionnel, composable avec `view` — utilisé par la carte "Dossiers prêts à envoyer"
  // du tableau de bord (dossiers complets, jamais encore transmis au client).
  const rawTransmis = Array.isArray(resolvedSearchParams.transmis) ? resolvedSearchParams.transmis[0] : resolvedSearchParams.transmis;
  const transmisFilter = rawTransmis === "non" ? "non" : null;

  const items = await prisma.contravention.findMany({
    where: isAdmin ? {} : { societe },
    include: { vehicule: true, conducteur: true },
    orderBy: { createdAt: "desc" },
  });

  const filteredItems = items.filter((item) => {
    if (transmisFilter === "non" && item.visibleClient) return false;
    if (view === "a_denoncer") {
      return item.statutDenonciation !== "Effectuée" && item.statutDenonciation !== "Non applicable";
    }
    if (view === "paiement_attente") {
      return item.statutPaiement === "En attente";
    }
    if (view === "en_retard") {
      return item.statutPaiement !== "Payé" && item.dateLimitePaiement && 
             new Date(item.dateLimitePaiement.split("/").reverse().join("-")) < new Date();
    }
    if (view === "terminees") {
      return item.statutPaiement === "Payé" && item.statutDenonciation === "Effectuée";
    }
    return true;
  });

  const counts = {
    toutes: items.length,
    a_denoncer: items.filter((item) => item.statutDenonciation !== "Effectuée" && item.statutDenonciation !== "Non applicable").length,
    paiement_attente: items.filter((item) => item.statutPaiement === "En attente").length,
    en_retard: items.filter((item) => item.statutPaiement !== "Payé" && item.dateLimitePaiement && 
             new Date(item.dateLimitePaiement.split("/").reverse().join("-")) < new Date()).length,
    terminees: items.filter((item) => item.statutPaiement === "Payé" && item.statutDenonciation === "Effectuée").length,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Suivi</p>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight text-slate-900">
            Contraventions
            <HelpHint
              text="Chaque dossier suit deux statuts indépendants : la Dénonciation (à l'ANTAI) et le Paiement. Utilisez le bouton Visible/Masquée pour décider si la société cliente voit ce dossier."
              guideHref="/aide/gerer-les-contraventions"
            />
          </h1>
          <p className="mt-1 text-sm text-slate-500">{filteredItems.length} dossier(s) affiché(s)</p>
          {transmisFilter === "non" && (
            <p className="mt-1.5 flex items-center gap-2 text-xs font-medium text-brand-700">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 ring-1 ring-inset ring-brand-500/15">Filtre actif : non transmis au client</span>
              <Link href={`/contraventions?view=${view}`} className="text-slate-400 hover:text-slate-600 hover:underline">Retirer ✕</Link>
            </p>
          )}
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
        <FilterLink href="/contraventions?view=toutes" label="Toutes" count={counts.toutes} active={view === "toutes"} />
        <FilterLink href="/contraventions?view=a_denoncer" label="À dénoncer" count={counts.a_denoncer} active={view === "a_denoncer"} />
        <FilterLink href="/contraventions?view=paiement_attente" label="Paiement en attente" count={counts.paiement_attente} active={view === "paiement_attente"} />
        <FilterLink href="/contraventions?view=en_retard" label="En retard" count={counts.en_retard} active={view === "en_retard"} />
        <FilterLink href="/contraventions?view=terminees" label="Terminées" count={counts.terminees} active={view === "terminees"} />
      </div>

      <div className="table-shell overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3 text-left">N° Dossier</th>
              <th className="p-3 text-left">Société</th>
              <th className="p-3 text-left">N° Avis</th>
              <th className="p-3 text-left">Date infraction</th>
              <th className="p-3 text-left">Nature</th>
              <th className="p-3 text-left">Véhicule</th>
              <th className="p-3 text-left">Conducteur</th>
              <th className="p-3 text-right">Montant</th>
              <th className="p-3 text-left">Échéance</th>
              <th className="p-3 text-left">Dénonciation</th>
              <th className="p-3 text-left">Paiement</th>
              {isAdmin && <th className="p-3 text-left">Client</th>}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((c) => (
              <tr key={c.id} className="table-row hover:bg-slate-50">
                <td className="p-3 font-mono text-xs">
                  <Link href={`/contraventions/${c.id}?from=${view}`} className="font-medium text-brand-700 hover:underline">{c.numDossier}</Link>
                </td>
                <td className="p-3 text-slate-700 text-xs">{c.societe}</td>
                <td className="p-3 font-mono text-xs text-slate-600">{c.numAvis ?? "—"}</td>
                <td className="p-3 text-slate-600 text-xs">{c.dateInfraction ?? "—"}</td>
                <td className="p-3 max-w-xs truncate text-slate-600 text-xs" title={c.natureInfraction ?? ""}>{c.natureInfraction ?? "—"}</td>
                <td className="p-3 text-slate-600 text-xs">{c.vehicule?.immatriculation ?? c.immatriculationOcr ?? "—"}</td>
                <td className="p-3 text-slate-600 text-xs">{c.conducteur ? `${c.conducteur.prenom} ${c.conducteur.nom}` : "—"}</td>
                <td className="p-3 text-right font-medium text-slate-900">{fmtMoney(c.montantAmende)}</td>
                <td className="p-3 text-slate-600 text-xs">{c.dateLimitePaiement ?? "—"}</td>
                <td className="p-3">
                  <Badge tone={statutTone(c.statutDenonciation, "denonciation")} title={getStatusHint(c.statutDenonciation ?? "")}>{c.statutDenonciation}</Badge>
                </td>
                <td className="p-3">
                  <Badge tone={statutTone(c.statutPaiement, "paiement")} title={getStatusHint(c.statutPaiement ?? "")}>{c.statutPaiement}</Badge>
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
                <td colSpan={isAdmin ? 12 : 11}>
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

function statutTone(s?: string | null, type?: string) {
  if (type === "denonciation") {
    if (s === "Effectuée") return "success";
    if (s === "Non applicable") return "neutral";
    if (s === "À effectuer") return "warning";
    return "info";
  }
  
  if (type === "paiement") {
    if (s === "Payé") return "success";
    if (s === "En retard") return "danger";
    if (s === "En attente") return "warning";
    return "neutral";
  }
  
  return "neutral";
}
