import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminSession, requireSociete } from "@/lib/auth";
import { updateConducteur } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

const inp = "field";

export default async function ConducteurDetailPage({ params }: PageProps) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const conducteur = await prisma.conducteur.findFirst({
    where: isAdmin ? { id } : { id, societe },
  });

  if (!conducteur) notFound();

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Personnel</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Fiche conducteur</h1>
          <p className="mt-1 text-sm text-slate-500">{conducteur.civilite ?? ""} {conducteur.prenom} {conducteur.nom}</p>
        </div>
        <Link href="/conducteurs" className="btn-secondary">
          Retour à la liste
        </Link>
      </div>

      <form action={updateConducteur.bind(null, conducteur.id)} className="space-y-6 rounded-[18px] border border-slate-200 bg-white p-5 shadow-card">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">Informations principales</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select name="civilite" defaultValue={conducteur.civilite ?? ""} className={inp}>
              <option value="">Civilité</option>
              <option>M.</option>
              <option>Mme</option>
            </select>
            <input name="nom" defaultValue={conducteur.nom} placeholder="Nom *" required className={inp} />
            <input name="prenom" defaultValue={conducteur.prenom} placeholder="Prénom *" required className={inp} />
            <input name="telephone" defaultValue={conducteur.telephone ?? ""} placeholder="Téléphone" className={inp} />
            <input name="email" defaultValue={conducteur.email ?? ""} placeholder="Email" className={inp} />
            <input name="numPermis" defaultValue={conducteur.numPermis ?? ""} placeholder="N° Permis" className={inp} />
          </div>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-4">
          <h2 className="text-sm font-semibold text-slate-800">Carte d'identité</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input name="numCarteIdentite" defaultValue={conducteur.numCarteIdentite ?? ""} placeholder="N° de carte d'identité" className={inp} />
            <input name="dateDelivranceCni" defaultValue={conducteur.dateDelivranceCni ?? ""} placeholder="Date de délivrance (jj/mm/aaaa)" className={inp} />
            <input name="dateExpirationCni" defaultValue={conducteur.dateExpirationCni ?? ""} placeholder="Date d'expiration (jj/mm/aaaa)" className={inp} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-medium text-slate-800">Recto</div>
              {conducteur.cniRectoNom ? (
                <div className="mt-2 text-xs text-slate-600">
                  <div className="truncate">Fichier actuel: {conducteur.cniRectoNom}</div>
                  <div className="mt-2 flex gap-3">
                    <Link href={`/api/conducteurs/${conducteur.id}/identite/recto`} className="font-medium text-brand-700 underline">Consulter</Link>
                    <Link href={`/api/conducteurs/${conducteur.id}/identite/recto?download=1`} className="font-medium text-brand-700 underline">Télécharger</Link>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-500">Aucun recto enregistré</div>
              )}
              <label className="mt-3 block text-xs text-slate-600">Remplacer le recto</label>
              <input type="file" name="cniRecto" accept="application/pdf,image/jpeg,image/jpg,image/png" className={`${inp} mt-1`} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-medium text-slate-800">Verso</div>
              {conducteur.cniVersoNom ? (
                <div className="mt-2 text-xs text-slate-600">
                  <div className="truncate">Fichier actuel: {conducteur.cniVersoNom}</div>
                  <div className="mt-2 flex gap-3">
                    <Link href={`/api/conducteurs/${conducteur.id}/identite/verso`} className="font-medium text-brand-700 underline">Consulter</Link>
                    <Link href={`/api/conducteurs/${conducteur.id}/identite/verso?download=1`} className="font-medium text-brand-700 underline">Télécharger</Link>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-500">Aucun verso enregistré</div>
              )}
              <label className="mt-3 block text-xs text-slate-600">Remplacer le verso</label>
              <input type="file" name="cniVerso" accept="application/pdf,image/jpeg,image/jpg,image/png" className={`${inp} mt-1`} />
            </div>
          </div>
          <p className="text-xs text-slate-500">Formats acceptés: PDF, JPG/JPEG, PNG. Taille max: 8 Mo par document.</p>
        </section>

        <div className="flex justify-end">
          <button className="btn-primary">
            Enregistrer les modifications
          </button>
        </div>
      </form>
    </div>
  );
}
