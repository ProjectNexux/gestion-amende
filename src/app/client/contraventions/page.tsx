import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/utils";
import { requireSociete } from "@/lib/auth";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileWarning } from "lucide-react";

export const dynamic = "force-dynamic";

function statutTone(statut: string | null | undefined): BadgeTone {
  if (statut === "Payé") return "success";
  if (statut === "En retard") return "danger";
  if (statut === "En attente") return "warning";
  return "neutral";
}

export default async function ClientContraventionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const societe = await requireSociete();
  const resolved = searchParams ? await searchParams : {};
  const rawFiltre = Array.isArray(resolved.filtre) ? resolved.filtre[0] : resolved.filtre;
  const filtre = rawFiltre === "a_traiter" ? "a_traiter" : "tous";

  // Same strict double filter as the dashboard: société AND visibleClient, in the query itself.
  const allItems = await prisma.contravention.findMany({
    where: { societe, visibleClient: true },
    include: { vehicule: true },
    orderBy: { createdAt: "desc" },
  });
  const items = filtre === "a_traiter" ? allItems.filter((c) => c.statutPaiement !== "Payé") : allItems;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mes contraventions"
        description={
          filtre === "a_traiter"
            ? `${items.length} dossier(s) non réglé(s)`
            : `${items.length} dossier(s) partagé(s) par notre équipe`
        }
        actions={
          filtre === "a_traiter" ? (
            <Link href="/client/contraventions" className="text-xs font-medium text-brand-600 hover:underline">
              Voir tous les dossiers
            </Link>
          ) : undefined
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Référence</th>
              <th className="p-3 text-left">N° Avis</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Infraction</th>
              <th className="p-3 text-left">Véhicule</th>
              <th className="p-3 text-right">Montant</th>
              <th className="p-3 text-left">Échéance</th>
              <th className="p-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3">
                  <Link href={`/client/contraventions/${c.id}`} className="font-mono text-xs font-medium text-brand-600 hover:underline">
                    {c.numDossier}
                  </Link>
                </td>
                <td className="p-3 font-mono text-xs">{c.numAvis ?? "—"}</td>
                <td className="p-3">{c.dateInfraction ?? "—"}</td>
                <td className="p-3 max-w-xs truncate" title={c.natureInfraction ?? ""}>{c.natureInfraction ?? "—"}</td>
                <td className="p-3">{c.vehicule?.immatriculation ?? c.immatriculationOcr ?? "—"}</td>
                <td className="p-3 text-right">{fmtMoney(c.montantAmende)}</td>
                <td className="p-3">{c.dateLimitePaiement ?? "—"}</td>
                <td className="p-3"><Badge tone={statutTone(c.statutPaiement)}>{c.statutPaiement ?? "—"}</Badge></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState icon={FileWarning} title="Aucune contravention partagée pour le moment" description="Les dossiers que notre équipe partage avec vous apparaîtront ici." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
