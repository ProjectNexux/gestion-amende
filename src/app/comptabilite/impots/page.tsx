import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Eye, Plus, Landmark } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getImpotData, forwardStatutTone, origineLabel } from "@/lib/comptabilite";
import { fmtMoney, fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ImpotsPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const items = await prisma.courrier.findMany({
    where: isAdmin ? { type: "impot" } : { societe, type: "impot" },
    orderBy: { receivedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Impôts</h1>
          <p className="text-sm text-slate-500">{items.length} document(s) fiscal(aux) — reçus automatiquement ou ajoutés manuellement.</p>
        </div>
        <Link
          href="/comptabilite/impots/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-brand-dark)]"
        >
          <Plus size={15} /> Ajouter un document fiscal
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-indigo-50/50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Société</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Organisme</th>
              <th className="p-3 text-right">Montant</th>
              <th className="p-3 text-left">Échéance</th>
              <th className="p-3 text-left">Origine</th>
              <th className="p-3 text-left">Transmission</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const d = getImpotData(item.data);
              return (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">{d.dateDocument ?? fmtDateTime(item.receivedAt)}</td>
                  <td className="p-3">{item.societe}</td>
                  <td className="p-3">
                    <Link href={`/comptabilite/impots/${item.id}`} className="font-medium text-slate-800 hover:underline">
                      {d.typeDocument ?? "Non détecté"}
                    </Link>
                  </td>
                  <td className="p-3">{d.organisme ?? "—"}</td>
                  <td className="p-3 text-right">{d.montant != null ? fmtMoney(d.montant) : "—"}</td>
                  <td className="p-3">{d.echeance ?? "—"}</td>
                  <td className="p-3"><Badge tone={d.origine === "manuel" ? "info" : "neutral"}>{origineLabel(d.origine)}</Badge></td>
                  <td className="p-3"><Badge tone={forwardStatutTone(d.forward?.statut)}>{d.forward?.statut ?? "Non transmis"}</Badge></td>
                  <td className="p-3 text-right">
                    <DocumentViewerTrigger
                      fileUrl={`/api/courriers/${item.id}`}
                      downloadUrl={`/api/courriers/${item.id}?download=1`}
                      fileName={item.fileName}
                      fileMime={item.fileMime}
                      title="Visualiser"
                      className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                      <Eye size={15} />
                    </DocumentViewerTrigger>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    icon={Landmark}
                    title="Aucun document fiscal pour le moment"
                    description="Les avis d'imposition et autres documents fiscaux détectés ou ajoutés manuellement apparaîtront ici."
                    action={{ label: "Ajouter un document fiscal", href: "/comptabilite/impots/new" }}
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
