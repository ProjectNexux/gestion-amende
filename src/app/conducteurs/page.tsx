import { prisma } from "@/lib/prisma";
import { createConducteur, deleteConducteur } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConducteursPage() {
  const items = await prisma.conducteur.findMany({ orderBy: [{ societe: "asc" }, { nom: "asc" }] });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Conducteurs</h1>

      <details className="bg-white border border-gray-200 rounded-lg p-5">
        <summary className="cursor-pointer text-sm font-medium">+ Ajouter un conducteur</summary>
        <form action={createConducteur} className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <input name="societe" placeholder="Société *" defaultValue="Societe principale" required className={inp} />
          <select name="civilite" className={inp}>
            <option value="">Civilité</option><option>M.</option><option>Mme</option>
          </select>
          <input name="nom" placeholder="Nom *" required className={inp} />
          <input name="prenom" placeholder="Prénom *" required className={inp} />
          <input name="telephone" placeholder="Téléphone" className={inp} />
          <input name="email" placeholder="Email" className={inp} />
          <input name="numPermis" placeholder="N° Permis" className={inp} />
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
              <th className="text-left p-3">Nom complet</th>
              <th className="text-left p-3">Téléphone</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">N° Permis</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="p-3">{c.societe}</td>
                <td className="p-3 font-mono text-xs">{c.code}</td>
                <td className="p-3 font-medium">{c.civilite} {c.prenom} {c.nom}</td>
                <td className="p-3">{c.telephone ?? "—"}</td>
                <td className="p-3">{c.email ?? "—"}</td>
                <td className="p-3">{c.numPermis ?? "—"}</td>
                <td className="p-3 text-right">
                  <form action={deleteConducteur.bind(null, c.id)}>
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
