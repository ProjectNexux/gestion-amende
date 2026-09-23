import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/utils";
import { requireSociete } from "@/lib/auth";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExternalLink, FileWarning } from "lucide-react";

export const dynamic = "force-dynamic";

function denoncTone(statut: string | null | undefined): BadgeTone {
  if (statut === "Effectuée") return "success";
  if (statut === "Non applicable") return "neutral";
  if (statut === "À effectuer") return "warning";
  return "info";
}
function paiementTone(statut: string | null | undefined): BadgeTone {
  if (statut === "Payé") return "success";
  if (statut === "En retard") return "danger";
  if (statut === "En attente") return "warning";
  return "neutral";
}

const VIEWS = ["toutes", "a_denoncer", "paiement_attente", "en_retard", "terminees"] as const;
type View = (typeof VIEWS)[number];

export default async function ClientContraventionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const societe = await requireSociete();
  const resolved = searchParams ? await searchParams : {};
  // Compat: l'ancien lien `?filtre=a_traiter` (encore utilisé par le tableau de bord) équivaut à
  // "paiement_attente" dans la nouvelle nomenclature à 5 filtres.
  const rawFiltreLegacy = Array.isArray(resolved.filtre) ? resolved.filtre[0] : resolved.filtre;
  const rawView = Array.isArray(resolved.view) ? resolved.view[0] : resolved.view;
  const view: View = (VIEWS as readonly string[]).includes(rawView ?? "")
    ? (rawView as View)
    : rawFiltreLegacy === "a_traiter"
      ? "paiement_attente"
      : "toutes";

  // Strict double filter: société AND visibleClient — jamais un dossier non transmis explicitement.
  const items = await prisma.contravention.findMany({
    where: { societe, visibleClient: true },
    include: { vehicule: true, conducteur: true },
    orderBy: { createdAt: "desc" },
  });

  const isEnRetard = (item: (typeof items)[number]) =>
    item.statutPaiement !== "Payé" &&
    !!item.dateLimitePaiement &&
    new Date(item.dateLimitePaiement.split("/").reverse().join("-")) < new Date();

  const filtered = items.filter((item) => {
    if (view === "a_denoncer") return item.statutDenonciation !== "Effectuée" && item.statutDenonciation !== "Non applicable";
    if (view === "paiement_attente") return item.statutPaiement === "En attente";
    if (view === "en_retard") return isEnRetard(item);
    if (view === "terminees") return item.statutPaiement === "Payé" && item.statutDenonciation === "Effectuée";
    return true;
  });

  const counts: Record<View, number> = {
    toutes: items.length,
    a_denoncer: items.filter((i) => i.statutDenonciation !== "Effectuée" && i.statutDenonciation !== "Non applicable").length,
    paiement_attente: items.filter((i) => i.statutPaiement === "En attente").length,
    en_retard: items.filter(isEnRetard).length,
    terminees: items.filter((i) => i.statutPaiement === "Payé" && i.statutDenonciation === "Effectuée").length,
  };

  const labels: Record<View, string> = {
    toutes: "Toutes",
    a_denoncer: "À dénoncer",
    paiement_attente: "Paiement en attente",
    en_retard: "En retard",
    terminees: "Terminées",
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mes contraventions"
        description={`${filtered.length} dossier(s) affiché(s)`}
        actions={
          <a href="https://www.antai.gouv.fr" target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
            <ExternalLink size={15} /> Site officiel ANTAI
          </a>
        }
      />

      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={`/client/contraventions?view=${v}`}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              view === v
                ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {labels[v]} <span className={view === v ? "text-white/80" : "text-slate-500"}>({counts[v]})</span>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileWarning} title="Aucun dossier dans cette vue" description="Les dossiers transmis par notre équipe apparaîtront ici." />
      ) : (
        <div className="table-shell overflow-hidden">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="p-3 text-left">N° dossier</th>
                <th className="p-3 text-left">N° avis</th>
                <th className="p-3 text-left">Date / nature</th>
                <th className="p-3 text-left">Véhicule</th>
                <th className="p-3 text-left">Conducteur</th>
                <th className="p-3 text-right">Montant</th>
                <th className="p-3 text-left">Date limite</th>
                <th className="p-3 text-left">Dénonciation</th>
                <th className="p-3 text-left">Paiement</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="table-row">
                  <td className="p-3">
                    <Link href={`/client/contraventions/${item.id}`} className="font-medium text-teal-700 hover:underline">
                      {item.numDossier}
                    </Link>
                  </td>
                  <td className="p-3 text-slate-600">{item.numAvis ?? "—"}</td>
                  <td className="p-3 text-slate-600">
                    <div>{item.dateInfraction ?? "—"}</div>
                    <div className="text-xs text-slate-400">{item.natureInfraction ?? "—"}</div>
                  </td>
                  <td className="p-3 text-slate-600">{item.vehicule?.immatriculation ?? item.immatriculationOcr ?? "—"}</td>
                  <td className="p-3 text-slate-600">{item.conducteur ? `${item.conducteur.prenom} ${item.conducteur.nom}` : "—"}</td>
                  <td className="p-3 text-right font-medium text-slate-900">{item.montantAmende != null ? fmtMoney(item.montantAmende) : "—"}</td>
                  <td className="p-3 text-slate-600">{item.dateLimitePaiement ?? "—"}</td>
                  <td className="p-3"><Badge tone={denoncTone(item.statutDenonciation)}>{item.statutDenonciation ?? "—"}</Badge></td>
                  <td className="p-3"><Badge tone={paiementTone(item.statutPaiement)}>{item.statutPaiement ?? "—"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
