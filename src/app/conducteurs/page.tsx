import { prisma } from "@/lib/prisma";
import { createConducteur, deleteConducteur } from "./actions";
import { requireSociete, isAdminSession } from "@/lib/auth";
import AddConducteurPanel from "./AddConducteurPanel";
import Link from "next/link";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function ConducteursPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const items = await prisma.conducteur.findMany({ where: isAdmin ? {} : { societe }, orderBy: { nom: "asc" } });
  return (
    <div className="space-y-6">
      <AddConducteurPanel action={createConducteur} />

      <div className="table-shell">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3 text-left">Société</th>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Nom complet</th>
              <th className="p-3 text-left">Téléphone</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">N° Permis</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={Users}
                    title="Aucun conducteur enregistré"
                    description="Ajoutez votre premier conducteur pour l'associer à des véhicules et des contraventions."
                  />
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="table-row">
                <td className="p-3 text-slate-700">{c.societe}</td>
                <td className="p-3 font-mono text-xs text-slate-600">{c.code}</td>
                <td className="p-3 font-medium text-slate-900">{c.civilite} {c.prenom} {c.nom}</td>
                <td className="p-3 text-slate-600">{c.telephone ?? "—"}</td>
                <td className="p-3 text-slate-600">{c.email ?? "—"}</td>
                <td className="p-3 text-slate-600">{c.numPermis ?? "—"}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/conducteurs/${c.id}`} className="text-xs font-medium text-brand-700 hover:underline">Voir / Modifier</Link>
                    <form action={deleteConducteur.bind(null, c.id)}>
                      <button className="text-xs font-medium text-rose-700 hover:underline">Suppr.</button>
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
