import { prisma } from "@/lib/prisma";
import { createSocieteAction, deleteSocieteAction } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminSocietesPage() {
  const societes = await prisma.societe.findMany({ orderBy: { nom: "asc" } });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">&larr; Retour</Link>
        <h1 className="mt-2 text-2xl font-semibold">Administration des sociétés</h1>
        <p className="text-sm text-slate-500">Créez et gérez les comptes société</p>
      </div>

      <form action={createSocieteAction} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Nouvelle société</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="nom" required placeholder="Nom de la société" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="codeAcces" required placeholder="Code d'accès" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Créer</button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Société</th>
              <th className="p-3 text-left">Code d&apos;accès</th>
              <th className="p-3 text-left">Date de création</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {societes.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="p-3 font-medium">{s.nom}</td>
                <td className="p-3 font-mono text-xs">{s.codeAcces}</td>
                <td className="p-3 text-slate-500">{s.createdAt.toLocaleDateString("fr-FR")}</td>
                <td className="p-3 text-right">
                  <form action={deleteSocieteAction.bind(null, s.id)}>
                    <button className="text-xs text-red-600 hover:underline">Suppr.</button>
                  </form>
                </td>
              </tr>
            ))}
            {societes.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-slate-400">Aucune société créée</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
