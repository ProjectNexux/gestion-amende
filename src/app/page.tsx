import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/utils";
import Link from "next/link";
import { AlertTriangle, Clock, FileText, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const all = await prisma.contravention.findMany({
    include: { vehicule: true, conducteur: true },
    orderBy: { createdAt: "desc" },
  });
  const total = all.length;
  const totalSocietes = new Set(all.map((c) => c.societe)).size;
  const aDenoncer = all.filter((c) => c.statutDenonciation !== "Effectuée").length;
  const enAttente = all.filter((c) => c.statutPaiement === "En attente").length;
  const totalMontant = all.reduce((acc, c) => acc + (c.montantAmende ?? 0), 0);

  const urgentes = all.filter((c) => {
    if (c.statutDenonciation === "Effectuée") return false;
    if (!c.dateInfraction) return false;
    const [d, m, y] = c.dateInfraction.split("/");
    if (!d || !m || !y) return false;
    const date = new Date(+y, +m - 1, +d);
    const diff = (Date.now() - date.getTime()) / 86400000;
    return diff >= 30 && diff < 45;
  }).length;

  const retards = all.filter((c) => {
    if (c.statutPaiement === "Payé") return false;
    if (!c.dateLimitePaiement) return false;
    const [d, m, y] = c.dateLimitePaiement.split("/");
    if (!d || !m || !y) return false;
    return new Date(+y, +m - 1, +d).getTime() < Date.now();
  }).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-gray-500">Vue d'ensemble de la gestion des contraventions</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Kpi icon={<FileText size={18} />} label="Total contraventions" value={total} />
        <Kpi icon={<FileText size={18} />} label="Sociétés actives" value={totalSocietes} />
        <Kpi icon={<Clock size={18} />} label="Dénonciations à faire" value={aDenoncer} color="amber" />
        <Kpi icon={<Wallet size={18} />} label="Paiements en attente" value={enAttente} color="blue" />
        <Kpi icon={<Wallet size={18} />} label="Montant total" value={fmtMoney(totalMontant)} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Alert color="amber" title="Dénonciations urgentes (< 45 jours)" value={urgentes} />
        <Alert color="red" title="Paiements en retard" value={retards} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Dernières contraventions</h2>
          <Link href="/contraventions" className="text-sm text-[var(--color-brand)] hover:underline">Voir tout →</Link>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3">Société</th>
                <th className="text-left p-3">N° Dossier</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Nature</th>
                <th className="text-left p-3">Véhicule</th>
                <th className="text-right p-3">Montant</th>
                <th className="text-left p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {all.slice(0, 8).map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-3">{c.societe}</td>
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/contraventions/${c.id}`} className="text-[var(--color-brand)] hover:underline">{c.numDossier}</Link>
                  </td>
                  <td className="p-3">{c.dateInfraction ?? "—"}</td>
                  <td className="p-3">{c.natureInfraction ?? "—"}</td>
                  <td className="p-3">{c.vehicule?.immatriculation ?? c.immatriculationOcr ?? "—"}</td>
                  <td className="p-3 text-right">{fmtMoney(c.montantAmende)}</td>
                  <td className="p-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100">{c.statutPaiement}</span>
                  </td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">
                  Aucune contravention. <Link href="/contraventions/scan" className="text-[var(--color-brand)] underline">Scanner la première</Link>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon, label, value, color = "gray" }: { icon: React.ReactNode; label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-xs text-gray-500">{icon}{label}</div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  );
}

function Alert({ color, title, value }: { color: "amber" | "red"; title: string; value: number }) {
  const cls = color === "red"
    ? "bg-red-50 border-red-200 text-red-900"
    : "bg-amber-50 border-amber-200 text-amber-900";
  return (
    <div className={`rounded-lg border p-4 flex items-center gap-3 ${cls}`}>
      <AlertTriangle size={20} />
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
    </div>
  );
}
