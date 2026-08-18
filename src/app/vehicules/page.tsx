import { prisma } from "@/lib/prisma";
import { createVehicule, deleteVehicule } from "./actions";
import { requireSociete, isAdminSession } from "@/lib/auth";
import AddVehiculePanel from "./AddVehiculePanel";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VehiculesPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const items = await prisma.vehicule.findMany({ where: isAdmin ? {} : { societe }, orderBy: { code: "asc" } });
  return (
    <div className="space-y-6">
      <AddVehiculePanel action={createVehicule} />

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
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
            {items.map((v) => (
              <tr key={v.id} className="border-t border-gray-100">
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
