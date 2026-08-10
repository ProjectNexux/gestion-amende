import { prisma } from "@/lib/prisma";
import { createVehicule, deleteVehicule } from "./actions";

export const dynamic = "force-dynamic";

export default async function VehiculesPage() {
  const items = await prisma.vehicule.findMany({ orderBy: [{ societe: "asc" }, { code: "asc" }] });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Véhicules</h1>

      <details className="bg-white border border-gray-200 rounded-lg p-5">
        <summary className="cursor-pointer text-sm font-medium">+ Ajouter un véhicule</summary>
        <form action={createVehicule} className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <input name="societe" placeholder="Société *" defaultValue="Societe principale" required className={inp} />
          <input name="code" placeholder="Code (auto)" className={inp} />
          <input name="immatriculation" placeholder="Immatriculation *" required className={inp} />
          <input name="marque" placeholder="Marque" className={inp} />
          <input name="modele" placeholder="Modèle" className={inp} />
          <input name="typeVehicule" placeholder="Type (fourgon, camion…)" className={inp} />
          <input name="service" placeholder="Service" className={inp} />
          <div className="md:col-span-3 flex justify-end">
            <button className="bg-[var(--color-brand)] text-white px-4 py-2 rounded-md text-sm">Créer</button>
          </div>
        </form>
      </details>

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
              <th></th>
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
                  <form action={deleteVehicule.bind(null, v.id)}>
                    <button className="text-xs text-red-600 hover:underline">Suppr.</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inp = "px-3 py-2 border border-gray-300 rounded-md text-sm";
