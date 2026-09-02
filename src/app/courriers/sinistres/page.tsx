import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Search, Flame } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { createSinistre } from "./actions";
import AddSinistrePanel from "./AddSinistrePanel";
import { OpenAddSinistreButton } from "./OpenAddSinistreButton";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SINISTRE_STATUTS, SINISTRE_TYPES, sinistreStatutTone } from "@/lib/sinistres";
import { fmtMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SinistresPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const sp = searchParams ? await searchParams : {};
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim();
  const filterSociete = one(sp.societe);
  const filterStatut = one(sp.statut);
  const filterType = one(sp.type);

  const [items, allSocietes] = await Promise.all([
    prisma.sinistre.findMany({
      where: isAdmin ? {} : { societe },
      include: { vehicule: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.societe.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
  ]);

  const societeOptions = isAdmin ? allSocietes.map((s) => s.nom) : [societe];

  const filtered = items.filter((item) => {
    if (filterSociete && item.societe !== filterSociete) return false;
    if (filterStatut && item.statut !== filterStatut) return false;
    if (filterType && item.typeSinistre !== filterType) return false;
    if (q) {
      const haystack = [item.reference, item.societe, item.typeSinistre, item.assureur, item.referenceAssureur, item.vehicule?.immatriculation]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const stats = {
    total: items.length,
    nouveaux: items.filter((i) => i.statut === "Nouveau").length,
    aTraiter: items.filter((i) => i.statut === "À traiter" || i.statut === "À vérifier").length,
    enCours: items.filter((i) => i.statut === "En cours" || i.statut === "Expertise").length,
    enAttenteAssurance: items.filter((i) => i.statut === "En attente assurance" || i.statut === "Indemnisation en attente").length,
    clos: items.filter((i) => i.statut === "Clos").length,
  };

  const [vehicules, conducteurs] = await Promise.all([
    prisma.vehicule.findMany({ where: isAdmin ? {} : { societe }, orderBy: { immatriculation: "asc" } }),
    prisma.conducteur.findMany({ where: isAdmin ? {} : { societe }, orderBy: { nom: "asc" } }),
  ]);
  const vehiculeOptions = vehicules.map((v) => ({ id: v.id, label: `${v.immatriculation}${v.marque ? " — " + v.marque : ""}${v.modele ? " " + v.modele : ""}` }));
  const conducteurOptions = conducteurs.map((c) => ({ id: c.id, label: `${c.nom} ${c.prenom}` }));

  const hasFilters = !!(q || filterSociete || filterStatut || filterType);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sinistres</h1>
        <p className="text-sm text-slate-500">Suivez et gérez les dossiers de sinistres reçus par l&apos;entreprise.</p>
      </div>

      <AddSinistrePanel action={createSinistre} societeOptions={societeOptions} defaultSociete={societe} vehicules={vehiculeOptions} conducteurs={conducteurOptions} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total sinistres" value={stats.total} />
        <StatCard label="Nouveaux" value={stats.nouveaux} tone="text-blue-600" />
        <StatCard label="À traiter" value={stats.aTraiter} tone="text-amber-600" />
        <StatCard label="En cours" value={stats.enCours} tone="text-blue-600" />
        <StatCard label="En attente assurance" value={stats.enAttenteAssurance} tone="text-amber-600" />
        <StatCard label="Clos" value={stats.clos} tone="text-emerald-600" />
      </div>

      <form className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" method="get">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Rechercher (référence, assureur, immatriculation...)"
            className="field pl-9"
          />
        </div>
        {isAdmin && (
          <select name="societe" defaultValue={filterSociete} className="field w-auto">
            <option value="">Toutes les sociétés</option>
            {allSocietes.map((s) => (
              <option key={s.nom} value={s.nom}>{s.nom}</option>
            ))}
          </select>
        )}
        <select name="statut" defaultValue={filterStatut} className="field w-auto">
          <option value="">Tous les statuts</option>
          {SINISTRE_STATUTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="type" defaultValue={filterType} className="field w-auto">
          <option value="">Tous les types</option>
          {SINISTRE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]">Filtrer</button>
        {hasFilters && (
          <Link href="/courriers/sinistres" className="text-sm text-slate-500 hover:underline">Réinitialiser</Link>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-indigo-50/50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Référence</th>
              <th className="p-3 text-left">Société</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Date du sinistre</th>
              <th className="p-3 text-left">Véhicule</th>
              <th className="p-3 text-left">Assureur</th>
              <th className="p-3 text-left">Échéance</th>
              <th className="p-3 text-left">Statut</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3">
                  <Link href={`/courriers/sinistres/${s.id}`} className="font-mono text-xs font-medium text-slate-800 hover:underline">{s.reference}</Link>
                </td>
                <td className="p-3">{s.societe}</td>
                <td className="p-3">{s.typeSinistre ?? "—"}</td>
                <td className="p-3">{s.dateSinistre ?? "—"}</td>
                <td className="p-3 font-mono text-xs">{s.vehicule?.immatriculation ?? "—"}</td>
                <td className="p-3">{s.assureur ?? "—"}</td>
                <td className="p-3">{s.dateLimiteReponse ?? "—"}</td>
                <td className="p-3"><Badge tone={sinistreStatutTone(s.statut)}>{s.statut}</Badge></td>
                <td className="p-3 text-right">
                  <Link href={`/courriers/sinistres/${s.id}`} className="text-xs font-medium text-blue-600 hover:underline">Ouvrir</Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && items.length > 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState icon={Flame} title="Aucun sinistre ne correspond à ces filtres" description="Ajustez les filtres ci-dessus ou déclarez un nouveau sinistre." />
                </td>
              </tr>
            )}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="p-10 text-center">
                  <p className="text-slate-500">Aucun sinistre enregistré</p>
                  <div className="mt-3 flex justify-center">
                    <OpenAddSinistreButton>+ Ajouter le premier sinistre</OpenAddSinistreButton>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`text-2xl font-bold ${tone ?? "text-slate-900"}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}
