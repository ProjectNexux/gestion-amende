import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Eye, Search, Building2 } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMiseEnDemeureData, MISE_EN_DEMEURE_STATUTS } from "@/lib/courriers";
import { deriveTransmissionStatut, type TransmissionStatut } from "@/lib/transmission";
import { fmtMoney, fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function statutTone(statut: string | undefined): BadgeTone {
  if (statut === "Traité") return "success";
  if (statut === "À vérifier" || statut === "À traiter") return "warning";
  if (statut === "Archivé") return "neutral";
  return "info"; // Nouveau, En cours
}

function transmissionTone(statut: TransmissionStatut): BadgeTone {
  if (statut === "Prêt à envoyer" || statut === "Envoyé") return "success";
  if (statut === "Erreur d'envoi") return "danger";
  return "warning"; // À vérifier, À transmettre
}

export default async function UrssafPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const sp = searchParams ? await searchParams : {};
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim().toLowerCase();
  const filterStatut = one(sp.statut);
  const filterTransmission = one(sp.transmission);
  const filterSociete = one(sp.societe);

  const [allItems, allSocietes] = await Promise.all([
    prisma.courrier.findMany({
      where: isAdmin ? { type: "mise_en_demeure" } : { societe, type: "mise_en_demeure" },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.societe.findMany({ orderBy: { nom: "asc" }, select: { nom: true, emailTransmission: true } }),
  ]);

  const emailBySociete = new Map(allSocietes.map((s) => [s.nom, s.emailTransmission]));

  // Dedicated URSSAF space: only documents whose sender was detected/confirmed as "URSSAF" —
  // reuses the exact same detection already computed for every mise en demeure (transmission.organisme).
  const rows = allItems
    .map((item) => ({ item, d: getMiseEnDemeureData(item.data) }))
    .filter(({ d }) => d.transmission?.organisme === "URSSAF")
    .map(({ item, d }) => {
      const clientNom = d.transmission?.clientDetecte ?? d.societeConcernee ?? item.societe;
      const email = clientNom ? emailBySociete.get(clientNom) ?? null : null;
      const transmissionStatut = deriveTransmissionStatut(d.transmission, email);
      return { item, d, transmissionStatut };
    })
    .filter(({ d, item, transmissionStatut }) => {
      if (filterStatut && d.statut !== filterStatut) return false;
      if (filterTransmission && transmissionStatut !== filterTransmission) return false;
      if (filterSociete && item.societe !== filterSociete) return false;
      if (q) {
        const haystack = [item.societe, d.expediteur, d.destinataire, d.motif, d.reference, d.societeConcernee]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

  const societeOptions = isAdmin ? allSocietes.map((s) => s.nom) : [societe];

  const stats = {
    total: rows.length,
    aVerifier: rows.filter(({ d }) => d.statut === "À vérifier").length,
    aTransmettre: rows.filter(({ transmissionStatut }) => transmissionStatut === "À transmettre").length,
    pretEnvoye: rows.filter(({ transmissionStatut }) => transmissionStatut === "Prêt à envoyer" || transmissionStatut === "Envoyé").length,
    traite: rows.filter(({ d }) => (d.statut as string) === "Traité" || (d.statut as string) === "Archivé").length,
  };

  const hasFilters = !!(q || filterStatut || filterTransmission || filterSociete);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">URSSAF</h1>
        <p className="text-sm text-slate-500">Espace dédié aux courriers détectés comme provenant de l&apos;URSSAF (mises en demeure, relances, cotisations…).</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total URSSAF" value={stats.total} />
        <StatCard label="À vérifier" value={stats.aVerifier} tone="text-amber-600" />
        <StatCard label="À transmettre" value={stats.aTransmettre} tone="text-amber-600" />
        <StatCard label="Prêt / envoyé" value={stats.pretEnvoye} tone="text-emerald-600" />
        <StatCard label="Traité / archivé" value={stats.traite} tone="text-slate-500" />
      </div>

      <form className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" method="get">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={one(sp.q)}
            placeholder="Société, expéditeur, destinataire, référence, motif…"
            className="field pl-9"
          />
        </div>
        {isAdmin && (
          <select name="societe" defaultValue={filterSociete} className="field w-auto">
            <option value="">Toutes les sociétés</option>
            {societeOptions.map((nom) => (
              <option key={nom} value={nom}>{nom}</option>
            ))}
          </select>
        )}
        <select name="statut" defaultValue={filterStatut} className="field w-auto">
          <option value="">Tous les statuts</option>
          {MISE_EN_DEMEURE_STATUTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="transmission" defaultValue={filterTransmission} className="field w-auto">
          <option value="">Toute transmission</option>
          <option value="À vérifier">À vérifier</option>
          <option value="À transmettre">À transmettre</option>
          <option value="Prêt à envoyer">Prêt à envoyer</option>
          <option value="Envoyé">Envoyé</option>
          <option value="Erreur d'envoi">Erreur d&apos;envoi</option>
        </select>
        <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]">Filtrer</button>
        {hasFilters && (
          <Link href="/courriers/urssaf" className="text-sm text-slate-500 hover:underline">Réinitialiser</Link>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-indigo-50/50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Société concernée</th>
              <th className="p-3 text-left">Motif</th>
              <th className="p-3 text-right">Montant</th>
              <th className="p-3 text-left">Échéance</th>
              <th className="p-3 text-left">Statut</th>
              <th className="p-3 text-left">Transmission</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, d, transmissionStatut }) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3">{d.dateDocument ?? fmtDateTime(item.receivedAt)}</td>
                <td className="p-3">{d.societeConcernee ?? item.societe}</td>
                <td className="p-3 max-w-[220px] truncate" title={d.motif ?? ""}>{d.motif ?? "—"}</td>
                <td className="p-3 text-right">{d.montant != null ? fmtMoney(d.montant) : d.montantIncertain ? "À vérifier" : "—"}</td>
                <td className="p-3">{d.echeance ?? "—"}</td>
                <td className="p-3"><Badge tone={statutTone(d.statut)}>{d.statut ?? "Nouveau"}</Badge></td>
                <td className="p-3"><Badge tone={transmissionTone(transmissionStatut)}>{transmissionStatut}</Badge></td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <DocumentViewerTrigger
                      fileUrl={`/api/courriers/${item.id}`}
                      downloadUrl={`/api/courriers/${item.id}?download=1`}
                      fileName={item.fileName}
                      fileMime={item.fileMime}
                      title="Visualiser"
                      className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                      <Eye size={15} />
                    </DocumentViewerTrigger>
                    <Link href={`/courriers/mise-en-demeure/${item.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                      Ouvrir
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon={Building2}
                    title={allItems.length === 0 ? "Aucun courrier URSSAF détecté" : "Aucun courrier ne correspond à ces filtres"}
                    description={allItems.length === 0 ? "Les courriers de/vers l'URSSAF détectés automatiquement apparaîtront ici." : "Essayez d'ajuster ou de réinitialiser les filtres ci-dessus."}
                  />
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
