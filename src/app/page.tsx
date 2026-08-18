import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/utils";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, FileText, ShieldAlert, Wallet } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const all = await prisma.contravention.findMany({
    where: isAdmin ? {} : { societe },
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
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[32px] border border-indigo-200/60 bg-gradient-to-br from-indigo-700 via-violet-700 to-slate-900 p-6 text-white shadow-[0_25px_70px_-20px_rgba(79,70,229,0.55)] sm:p-8">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-28 w-28 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-100">
              Nouvelle version
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Tableau de bord</h1>
            <p className="mt-3 max-w-xl text-sm text-indigo-100/90 sm:text-base">
              Suivez vos dossiers, les dénonciations et les paiements avec une vue claire, rapide et actionnable.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm font-medium text-white/95 ring-1 ring-white/10">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
              Vue synthétique et rapide
            </div>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] sm:min-w-[260px]">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-100">À voir</div>
            <div className="mt-2 text-xl font-semibold">Résumé en un coup d’œil</div>
            <p className="mt-2 text-sm text-indigo-100/90">
              Contraventions, paiements et dénonciations directement accessibles.
            </p>
            <Link href="/contraventions" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:scale-[1.02] hover:bg-indigo-50">
              Voir toutes les contraventions
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi href="/contraventions?view=all" icon={<FileText size={18} />} label="Total contraventions" value={total} description="Tous les dossiers enregistrés" accent="indigo" />
        <Kpi href="/contraventions?view=all" icon={<ShieldAlert size={18} />} label="Sociétés actives" value={totalSocietes} description="Entreprises suivies" accent="slate" />
        <Kpi href="/contraventions?view=denonciations" icon={<Clock size={18} />} label="Dénonciations à faire" value={aDenoncer} description="À traiter rapidement" accent="amber" />
        <Kpi href="/contraventions?view=paiements" icon={<Wallet size={18} />} label="Paiements en attente" value={enAttente} description="À relancer" accent="blue" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_15px_45px_-25px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">Résumé rapide</p>
              <h2 className="text-lg font-semibold">Points de vigilance</h2>
            </div>
            <Link href="/contraventions?view=retards" className="text-sm font-medium text-[var(--color-brand)] hover:underline">
              Voir les retards
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Alert color="amber" title="Dénonciations urgentes (< 45 jours)" value={urgentes} description="Dossiers à suivre avec prudence" />
            <Alert color="red" title="Paiements en retard" value={retards} description="À régulariser sans attendre" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-[0_20px_50px_-25px_rgba(15,23,42,0.8)]">
          <p className="text-sm font-semibold text-slate-400">Montant total</p>
          <div className="mt-3 text-3xl font-semibold text-white">{fmtMoney(totalMontant)}</div>
          <p className="mt-2 text-sm text-slate-300">Valeur cumulée des contraventions actuellement suivies.</p>
          <Link href="/contraventions?view=all" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-indigo-300 hover:text-white">
            Explorer les dossiers <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-25px_rgba(15,23,42,0.3)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Dernières contraventions</h2>
            <p className="text-sm text-slate-500">Les dossiers les plus récents, prêts à être consultés.</p>
          </div>
          <Link href="/contraventions" className="text-sm font-medium text-[var(--color-brand)] hover:underline">Voir tout →</Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
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
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">{c.societe}</td>
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/contraventions/${c.id}`} className="text-[var(--color-brand)] hover:underline">{c.numDossier}</Link>
                  </td>
                  <td className="p-3">{c.dateInfraction ?? "—"}</td>
                  <td className="p-3">{c.natureInfraction ?? "—"}</td>
                  <td className="p-3">{c.vehicule?.immatriculation ?? c.immatriculationOcr ?? "—"}</td>
                  <td className="p-3 text-right">{fmtMoney(c.montantAmende)}</td>
                  <td className="p-3">
                    <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{c.statutPaiement}</span>
                  </td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Aucune contravention. <Link href="/contraventions/scan" className="text-[var(--color-brand)] underline">Scanner la première</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ href, icon, label, value, description, accent = "indigo" }: { href: string; icon: React.ReactNode; label: string; value: React.ReactNode; description: string; accent?: "indigo" | "slate" | "amber" | "blue" }) {
  const accentClasses = {
    indigo: "border-indigo-200 bg-indigo-50/70 text-indigo-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    amber: "border-amber-200 bg-amber-50/70 text-amber-700",
    blue: "border-sky-200 bg-sky-50/70 text-sky-700",
  };

  return (
    <Link href={href} className={`group rounded-3xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${accentClasses[accent]}`}>
      <div className="flex items-center gap-2 text-sm font-medium">{icon}{label}</div>
      <div className="mt-4 text-3xl font-semibold">{value}</div>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </Link>
  );
}

function Alert({ color, title, value, description }: { color: "amber" | "red"; title: string; value: number; description: string }) {
  const cls = color === "red"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} />
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{description}</p>
    </div>
  );
}
