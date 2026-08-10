import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/utils";
import Link from "next/link";
import { Plus, ScanLine } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContraventionsListPage() {
  const items = await prisma.contravention.findMany({
    include: { vehicule: true, conducteur: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contraventions</h1>
          <p className="text-sm text-gray-500">{items.length} dossier(s)</p>
        </div>
        <div className="flex gap-2">
          <Link href="/contraventions/scan" className="inline-flex items-center gap-2 bg-[var(--color-brand)] text-white px-3 py-2 rounded-md text-sm hover:bg-[var(--color-brand-dark)]">
            <ScanLine size={16} /> Scanner
          </Link>
          <Link href="/contraventions/new" className="inline-flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-md text-sm hover:bg-gray-50">
            <Plus size={16} /> Saisir
          </Link>
        </div>
      </header>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3">Société</th>
              <th className="text-left p-3">N° Dossier</th>
              <th className="text-left p-3">Date infraction</th>
              <th className="text-left p-3">Nature</th>
              <th className="text-left p-3">Lieu</th>
              <th className="text-left p-3">Véhicule</th>
              <th className="text-left p-3">Conducteur</th>
              <th className="text-right p-3">Montant</th>
              <th className="text-left p-3">Dénonciation</th>
              <th className="text-left p-3">Paiement</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-3">{c.societe}</td>
                <td className="p-3 font-mono text-xs">
                  <Link href={`/contraventions/${c.id}`} className="text-[var(--color-brand)] hover:underline">{c.numDossier}</Link>
                </td>
                <td className="p-3">{c.dateInfraction ?? "—"} {c.heureInfraction ?? ""}</td>
                <td className="p-3 max-w-xs truncate" title={c.natureInfraction ?? ""}>{c.natureInfraction ?? "—"}</td>
                <td className="p-3 max-w-xs truncate" title={c.lieuInfraction ?? ""}>{c.lieuInfraction ?? "—"}</td>
                <td className="p-3">{c.vehicule?.immatriculation ?? c.immatriculationOcr ?? "—"}</td>
                <td className="p-3">{c.conducteur ? `${c.conducteur.prenom} ${c.conducteur.nom}` : "—"}</td>
                <td className="p-3 text-right">{fmtMoney(c.montantAmende)}</td>
                <td className="p-3">
                  <span className={badge(c.statutDenonciation)}>{c.statutDenonciation}</span>
                </td>
                <td className="p-3">
                  <span className={badge(c.statutPaiement)}>{c.statutPaiement}</span>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={10} className="p-8 text-center text-gray-500">Aucune contravention</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function badge(s?: string | null) {
  const base = "inline-block px-2 py-0.5 rounded text-xs ";
  if (s === "Effectuée" || s === "Payé") return base + "bg-green-100 text-green-800";
  if (s === "En retard") return base + "bg-red-100 text-red-800";
  if (s === "À effectuer" || s === "En attente") return base + "bg-amber-100 text-amber-800";
  return base + "bg-gray-100 text-gray-700";
}
