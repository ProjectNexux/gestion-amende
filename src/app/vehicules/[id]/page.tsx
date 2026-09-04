import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminSession, requireSociete } from "@/lib/auth";
import { updateVehicule } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

const inp = "field";

export default async function VehiculeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const vehicule = await prisma.vehicule.findFirst({
    where: isAdmin ? { id } : { id, societe },
  });
  if (!vehicule) notFound();

  const conducteurs = await prisma.conducteur.findMany({
    where: isAdmin ? {} : { societe },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    select: {
      id: true,
      societe: true,
      civilite: true,
      nom: true,
      prenom: true,
      numPermis: true,
      numCarteIdentite: true,
      dateExpirationCni: true,
      cniRectoNom: true,
      cniVersoNom: true,
    },
  });

  const selectedConducteur = vehicule.conducteurAttitre
    ? conducteurs.find((c) => c.id === vehicule.conducteurAttitre)
    : null;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Flotte</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Fiche véhicule</h1>
          <p className="mt-1 text-sm text-slate-500">{vehicule.immatriculation} · {vehicule.code}</p>
        </div>
        <Link href="/vehicules" className="btn-secondary">
          Retour à la liste
        </Link>
      </div>

      <form action={updateVehicule.bind(null, vehicule.id)} className="space-y-6 rounded-[18px] border border-slate-200 bg-white p-5 shadow-card">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">Informations véhicule</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input name="code" defaultValue={vehicule.code} placeholder="Code" className={inp} />
            <input name="immatriculation" defaultValue={vehicule.immatriculation} placeholder="Immatriculation *" required className={inp} />
            <input name="marque" defaultValue={vehicule.marque ?? ""} placeholder="Marque" className={inp} />
            <input name="modele" defaultValue={vehicule.modele ?? ""} placeholder="Modèle" className={inp} />
            <input name="typeVehicule" defaultValue={vehicule.typeVehicule ?? ""} placeholder="Type (fourgon, camion…)" className={inp} />
            <input name="service" defaultValue={vehicule.service ?? ""} placeholder="Service" className={inp} />
            <select name="statut" defaultValue={vehicule.statut ?? "En service"} className={inp}>
              <option>En service</option>
              <option>Hors service</option>
              <option>Maintenance</option>
            </select>
          </div>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-4">
          <h2 className="text-sm font-semibold text-slate-800">Conducteur attitré</h2>
          <select name="conducteurAttitre" defaultValue={vehicule.conducteurAttitre ?? ""} className={`${inp} max-w-xl`}>
            <option value="">— Aucun conducteur attitré —</option>
            {conducteurs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.civilite ? `${c.civilite} ` : ""}{c.prenom} {c.nom} · {c.societe}
              </option>
            ))}
          </select>

          {selectedConducteur ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="font-medium text-slate-900">{selectedConducteur.civilite ? `${selectedConducteur.civilite} ` : ""}{selectedConducteur.prenom} {selectedConducteur.nom}</div>
              <div className="mt-1 text-slate-600">N° permis: {selectedConducteur.numPermis ?? "—"}</div>
              <div className="text-slate-600">N° carte d'identité: {selectedConducteur.numCarteIdentite ?? "—"}</div>
              <div className="text-slate-600">Date d'expiration CNI: {selectedConducteur.dateExpirationCni ?? "—"}</div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <Link href={`/conducteurs/${selectedConducteur.id}`} className="font-medium text-brand-700 underline">Voir la fiche conducteur</Link>
                {selectedConducteur.cniRectoNom && (
                  <Link href={`/api/conducteurs/${selectedConducteur.id}/identite/recto`} className="font-medium text-brand-700 underline">Consulter recto CNI</Link>
                )}
                {selectedConducteur.cniRectoNom && (
                  <Link href={`/api/conducteurs/${selectedConducteur.id}/identite/recto?download=1`} className="font-medium text-brand-700 underline">Télécharger recto CNI</Link>
                )}
                {selectedConducteur.cniVersoNom && (
                  <Link href={`/api/conducteurs/${selectedConducteur.id}/identite/verso`} className="font-medium text-brand-700 underline">Consulter verso CNI</Link>
                )}
                {selectedConducteur.cniVersoNom && (
                  <Link href={`/api/conducteurs/${selectedConducteur.id}/identite/verso?download=1`} className="font-medium text-brand-700 underline">Télécharger verso CNI</Link>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Aucun conducteur attitré sélectionné.</p>
          )}
          <p className="text-xs text-slate-500">Les documents d'identité restent protégés côté serveur et ne sont accessibles qu'aux utilisateurs autorisés.</p>
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
