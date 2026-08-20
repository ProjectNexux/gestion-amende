import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Eye, MoreHorizontal, Search } from "lucide-react";
import { requireSociete, isAdminSession } from "@/lib/auth";
import { createMiseEnDemeureManuelle, deleteMiseEnDemeure } from "./actions";
import AddMiseEnDemeurePanel from "./AddMiseEnDemeurePanel";
import { DocumentViewerTrigger } from "@/components/DocumentViewerTrigger";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { getMiseEnDemeureData, origineLabel } from "@/lib/courriers";
import { fmtMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseFrDate(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

function sensLabel(sens: string | undefined): string {
  if (sens === "recue") return "Reçue";
  if (sens === "envoyee") return "Envoyée";
  return "À vérifier";
}
function sensTone(sens: string | undefined): BadgeTone {
  if (sens === "recue") return "info";
  if (sens === "envoyee") return "neutral";
  return "warning";
}
function statutTone(statut: string | undefined): BadgeTone {
  if (statut === "Traité") return "success";
  if (statut === "À vérifier" || statut === "À traiter") return "warning";
  if (statut === "Archivé") return "neutral";
  return "info"; // Nouveau, En cours
}

export default async function MiseEnDemeurePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const sp = searchParams ? await searchParams : {};
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const q = one(sp.q).trim().toLowerCase();
  const filterSens = one(sp.sens);
  const filterStatut = one(sp.statut);
  const filterSociete = one(sp.societe);

  const [allItems, allSocietes] = await Promise.all([
    prisma.courrier.findMany({
      where: isAdmin ? { type: "mise_en_demeure" } : { societe, type: "mise_en_demeure" },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.societe.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
  ]);

  const items = allItems
    .map((item) => ({ item, d: getMiseEnDemeureData(item.data) }))
    .filter(({ d, item }) => {
      if (filterSens && d.sens !== filterSens) return false;
      if (filterStatut && d.statut !== filterStatut) return false;
      if (filterSociete && item.societe !== filterSociete) return false;
      if (q) {
        const haystack = [
          item.societe,
          d.expediteur,
          d.destinataire,
          d.motif,
          d.reference,
          d.montant != null ? String(d.montant) : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const da = parseFrDate(a.d.dateDocument)?.getTime() ?? a.item.receivedAt.getTime();
      const db = parseFrDate(b.d.dateDocument)?.getTime() ?? b.item.receivedAt.getTime();
      return db - da;
    });

  const societeOptions = isAdmin ? allSocietes.map((s) => s.nom) : [societe];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mise en demeure</h1>
          <p className="text-sm text-slate-500">{items.length} document(s)</p>
        </div>
        <Link href="/courriers/a-transmettre" className="text-sm font-medium text-brand-600 hover:underline">
          Voir la liste « À transmettre » →
        </Link>
      </div>

      <AddMiseEnDemeurePanel action={createMiseEnDemeureManuelle} societeOptions={societeOptions} defaultSociete={societe} />

      <form className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3" method="get">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={one(sp.q)}
            placeholder="Société, expéditeur, destinataire, référence, motif…"
            className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm"
          />
        </div>
        <select name="sens" defaultValue={filterSens} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
          <option value="">Tous les sens</option>
          <option value="recue">Reçue</option>
          <option value="envoyee">Envoyée</option>
          <option value="a_verifier">À vérifier</option>
        </select>
        <select name="statut" defaultValue={filterStatut} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
          <option value="">Tous les statuts</option>
          <option value="Nouveau">Nouveau</option>
          <option value="À vérifier">À vérifier</option>
          <option value="À traiter">À traiter</option>
          <option value="En cours">En cours</option>
          <option value="Traité">Traité</option>
          <option value="Archivé">Archivé</option>
        </select>
        {isAdmin && (
          <select name="societe" defaultValue={filterSociete} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
            <option value="">Toutes les sociétés</option>
            {societeOptions.map((nom) => (
              <option key={nom} value={nom}>{nom}</option>
            ))}
          </select>
        )}
        <button className="rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm text-white hover:bg-[var(--color-brand-dark)]">
          Filtrer
        </button>
        {(q || filterSens || filterStatut || filterSociete) && (
          <Link href="/courriers/mise-en-demeure" className="text-sm text-slate-500 hover:underline">Réinitialiser</Link>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Sens</th>
              <th className="p-3 text-left">Expéditeur</th>
              <th className="p-3 text-left">Destinataire</th>
              <th className="p-3 text-left">Société concernée</th>
              <th className="p-3 text-left">Motif</th>
              <th className="p-3 text-right">Montant</th>
              <th className="p-3 text-left">Échéance</th>
              <th className="p-3 text-left">Statut</th>
              <th className="p-3 text-left">Origine</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ item, d }) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3">{d.dateDocument ?? "—"}</td>
                <td className="p-3"><Badge tone={sensTone(d.sens)}>{sensLabel(d.sens)}</Badge></td>
                <td className="p-3 max-w-[160px] truncate" title={d.expediteur ?? ""}>{d.expediteur ?? "—"}</td>
                <td className="p-3 max-w-[160px] truncate" title={d.destinataire ?? ""}>{d.destinataire ?? "—"}</td>
                <td className="p-3">{d.societeConcernee ?? item.societe}</td>
                <td className="p-3 max-w-[200px] truncate" title={d.motif ?? ""}>{d.motif ?? "—"}</td>
                <td className="p-3 text-right">{d.montant != null ? fmtMoney(d.montant) : d.montantIncertain ? "À vérifier" : "—"}</td>
                <td className="p-3">{d.echeance ?? "—"}</td>
                <td className="p-3"><Badge tone={statutTone(d.statut)}>{d.statut ?? "Nouveau"}</Badge></td>
                <td className="p-3"><Badge tone={d.origine === "manuel" ? "neutral" : "info"}>{origineLabel(d.origine)}</Badge></td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <DocumentViewerTrigger
                      fileUrl={`/api/courriers/${item.id}`}
                      downloadUrl={`/api/courriers/${item.id}?download=1`}
                      fileName={item.fileName}
                      fileMime={item.fileMime}
                      title="Visualiser"
                      className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                      <Eye size={15} />
                    </DocumentViewerTrigger>
                    <details className="group relative inline-block text-left">
                      <summary className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
                        <MoreHorizontal size={15} />
                      </summary>
                      <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        <Link href={`/courriers/mise-en-demeure/${item.id}`} className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Ouvrir</Link>
                        <form action={deleteMiseEnDemeure.bind(null, item.id)}>
                          <ConfirmSubmitButton
                            confirmMessage="Supprimer définitivement cette mise en demeure ?"
                            className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                          >
                            Supprimer
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </details>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500">Aucune mise en demeure pour le moment.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
