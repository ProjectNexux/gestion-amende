import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { createRetardPaiementManuelle } from "./actions";
import AddRetardPaiementPanel from "./AddRetardPaiementPanel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClockAlert } from "lucide-react";
import { getRetardPaiementData, resteAPayer } from "@/lib/courriers";
import { fmtMoneyCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

function statutTone(statut: string | undefined): BadgeTone {
  if (statut === "Payé") return "success";
  if (statut === "Échec de paiement") return "danger";
  if (statut === "Remboursé") return "neutral";
  if (statut === "Partiellement payé" || statut === "Paiement en attente") return "warning";
  return "neutral"; // Non payé
}

export default async function RetardsPaiementPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const items = await prisma.courrier.findMany({
    where: isAdmin ? { type: "retard_paiement" } : { societe, type: "retard_paiement" },
    orderBy: { receivedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Retards de paiement</h1>
        <p className="text-sm text-slate-500">{items.length} dossier(s)</p>
      </div>

      <AddRetardPaiementPanel action={createRetardPaiementManuelle} />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-indigo-50/50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Bénéficiaire</th>
              <th className="p-3 text-left">Débiteur</th>
              <th className="p-3 text-left">Référence</th>
              <th className="p-3 text-left">Échéance</th>
              <th className="p-3 text-right">Montant dû</th>
              <th className="p-3 text-right">Reste à payer</th>
              <th className="p-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const d = getRetardPaiementData(item.data);
              return (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <Link href={`/courriers/retards-paiement/${item.id}`} className="font-medium text-slate-800 hover:underline">
                      {d.beneficiaire ?? "—"}
                    </Link>
                  </td>
                  <td className="p-3">{d.debiteur ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{d.reference ?? "—"}</td>
                  <td className="p-3">{d.dateEcheance ?? "—"}</td>
                  <td className="p-3 text-right">{fmtMoneyCents(d.montantDu)}</td>
                  <td className="p-3 text-right font-medium">{fmtMoneyCents(resteAPayer(d))}</td>
                  <td className="p-3"><Badge tone={statutTone(d.statutPaiement)}>{d.statutPaiement ?? "Non payé"}</Badge></td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState icon={ClockAlert} title="Aucun retard de paiement" description="Les relances et retards de paiement détectés ou ajoutés manuellement apparaîtront ici." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
