import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminSession, requireSociete } from "@/lib/auth";
import { updateConducteur } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

const inp = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm";

export default async function ConducteurDetailPage({ params }: PageProps) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const conducteur = await prisma.conducteur.findFirst({
    where: isAdmin ? { id } : { id, societe },
  });

  if (!conducteur) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Fiche conducteur</h1>
          <p className="text-sm text-gray-500">{conducteur.civilite ?? ""} {conducteur.prenom} {conducteur.nom}</p>
        </div>
        <Link href="/conducteurs" className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          Retour à la liste
        </Link>
      </div>

      <form action={updateConducteur.bind(null, conducteur.id)} className="space-y-6 rounded-lg border border-gray-200 bg-white p-5">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Informations principales</h2>
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

        <section className="space-y-3 border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold text-gray-700">Carte d'identité</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input name="numCarteIdentite" defaultValue={conducteur.numCarteIdentite ?? ""} placeholder="N° de carte d'identité" className={inp} />
            <input name="dateDelivranceCni" defaultValue={conducteur.dateDelivranceCni ?? ""} placeholder="Date de délivrance (jj/mm/aaaa)" className={inp} />
            <input name="dateExpirationCni" defaultValue={conducteur.dateExpirationCni ?? ""} placeholder="Date d'expiration (jj/mm/aaaa)" className={inp} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border border-gray-200 p-3">
              <div className="text-sm font-medium text-gray-700">Recto</div>
              {conducteur.cniRectoNom ? (
                <div className="mt-2 text-xs text-gray-600">
                  <div className="truncate">Fichier actuel: {conducteur.cniRectoNom}</div>
                  <div className="mt-2 flex gap-3">
                    <Link href={`/api/conducteurs/${conducteur.id}/identite/recto`} className="text-[var(--color-brand)] underline">Consulter</Link>
                    <Link href={`/api/conducteurs/${conducteur.id}/identite/recto?download=1`} className="text-[var(--color-brand)] underline">Télécharger</Link>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-gray-500">Aucun recto enregistré</div>
              )}
              <label className="mt-3 block text-xs text-gray-600">Remplacer le recto</label>
              <input type="file" name="cniRecto" accept="application/pdf,image/jpeg,image/jpg,image/png" className={`${inp} mt-1`} />
            </div>

            <div className="rounded-md border border-gray-200 p-3">
              <div className="text-sm font-medium text-gray-700">Verso</div>
              {conducteur.cniVersoNom ? (
                <div className="mt-2 text-xs text-gray-600">
                  <div className="truncate">Fichier actuel: {conducteur.cniVersoNom}</div>
                  <div className="mt-2 flex gap-3">
                    <Link href={`/api/conducteurs/${conducteur.id}/identite/verso`} className="text-[var(--color-brand)] underline">Consulter</Link>
                    <Link href={`/api/conducteurs/${conducteur.id}/identite/verso?download=1`} className="text-[var(--color-brand)] underline">Télécharger</Link>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-gray-500">Aucun verso enregistré</div>
              )}
              <label className="mt-3 block text-xs text-gray-600">Remplacer le verso</label>
              <input type="file" name="cniVerso" accept="application/pdf,image/jpeg,image/jpg,image/png" className={`${inp} mt-1`} />
            </div>
          </div>
          <p className="text-xs text-gray-500">Formats acceptés: PDF, JPG/JPEG, PNG. Taille max: 8 Mo par document.</p>
        </section>

        <div className="flex justify-end">
          <button className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm text-white hover:bg-[var(--color-brand-dark)]">
            Enregistrer les modifications
          </button>
        </div>
      </form>
    </div>
  );
}
