import { prisma } from "@/lib/prisma";
import { createVehicule, deleteVehicule } from "./actions";
import { requireSociete, isAdminSession } from "@/lib/auth";
import AddVehiculePanel from "./AddVehiculePanel";
import ImportVehiculesPanel from "./ImportVehiculesPanel";
import SocieteFilterForm from "./SocieteFilterForm";
import Link from "next/link";
import { Download } from "lucide-react";
import { Car } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ societe?: string }>;
};

export default async function VehiculesPage({ searchParams }: PageProps) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const { societe: societeFilter } = await searchParams;
  const effectiveFilter = isAdmin ? societeFilter?.trim() || null : null;

  const items = await prisma.vehicule.findMany({
    where: isAdmin ? (effectiveFilter ? { societe: effectiveFilter } : {}) : { societe },
    orderBy: { code: "asc" },
  });
  const allSocietes = isAdmin ? await prisma.societe.findMany({ select: { nom: true }, orderBy: { nom: "asc" } }) : [];

  const exportHref = effectiveFilter ? `/api/vehicules/export?societe=${encodeURIComponent(effectiveFilter)}` : "/api/vehicules/export";

  return (
    <div className="space-y-6">
      <AddVehiculePanel
        action={createVehicule}
        extraActions={
          <>
            <ImportVehiculesPanel />
            <a href={exportHref} className="btn-secondary inline-flex items-center gap-2">
              <Download size={16} /> Exporter Excel
            </a>
          </>
        }
      />

      {isAdmin && allSocietes.length > 0 && (
        <SocieteFilterForm societes={allSocietes.map((s) => s.nom)} current={effectiveFilter} />
      )}

      <div className="table-shell">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="text-left p-3">Société</th>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Immat.</th>
              <th className="text-left p-3">Marque / Modèle</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Service</th>
              <th className="text-left p-3">Statut</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon={Car}
                    title="Aucun véhicule enregistré"
                    description="Ajoutez votre premier véhicule pour commencer à suivre ses contraventions."
                  />
                </td>
              </tr>
            )}
            {items.map((v) => (
              <tr key={v.id} className="table-row">
                <td className="p-3">{v.societe}</td>
                <td className="p-3 font-mono text-xs">{v.code}</td>
                <td className="p-3 font-medium">{v.immatriculation}</td>
                <td className="p-3">{v.marque} {v.modele}</td>
                <td className="p-3">{v.typeVehicule ?? "—"}</td>
                <td className="p-3">{v.service ?? "—"}</td>
                <td className="p-3">{v.statut}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/vehicules/${v.id}`} className="text-xs text-[var(--color-brand)] hover:underline">Voir / Modifier</Link>
                    <form action={deleteVehicule.bind(null, v.id)}>
                      <button className="text-xs text-red-600 hover:underline">Suppr.</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
