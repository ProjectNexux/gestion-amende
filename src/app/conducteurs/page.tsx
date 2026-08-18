import { prisma } from "@/lib/prisma";
import { createConducteur, deleteConducteur } from "./actions";
import { requireSociete, isAdminSession } from "@/lib/auth";
import AddConducteurPanel from "./AddConducteurPanel";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ConducteursPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const items = await prisma.conducteur.findMany({ where: isAdmin ? {} : { societe }, orderBy: { nom: "asc" } });
  return (
    <div className="space-y-6">
      <AddConducteurPanel action={createConducteur} />

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
              <th className="text-left p-3">Actions</th>
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
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/conducteurs/${c.id}`} className="text-xs text-[var(--color-brand)] hover:underline">Voir / Modifier</Link>
                    <form action={deleteConducteur.bind(null, c.id)}>
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
