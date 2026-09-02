import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ContraventionForm from "@/components/ContraventionForm";
import { updateContraventionAction, deleteContraventionAction, toggleVisibleClientAction } from "../actions";
import { requireSociete, isAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditContraventionPage({ params }: { params: Promise<{ id: string }> }) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const { id } = await params;
  const [item, vehicules, conducteurs] = await Promise.all([
    prisma.contravention.findUnique({ where: { id } }),
    prisma.vehicule.findMany({ where: isAdmin ? {} : { societe }, orderBy: { immatriculation: "asc" } }),
    prisma.conducteur.findMany({ where: isAdmin ? {} : { societe }, orderBy: { nom: "asc" } }),
  ]);
  if (!item || (!isAdmin && item.societe !== societe)) notFound();

  const updateWith = updateContraventionAction.bind(null, id);
  const deleteWith = deleteContraventionAction.bind(null, id);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{item.numDossier}</h1>
          <p className="text-sm text-slate-500">Modifier le dossier — {item.societe}</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <form action={toggleVisibleClientAction.bind(null, id, !item.visibleClient)}>
              <button
                type="submit"
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition " +
                  (item.visibleClient
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100")
                }
                title="Basculer la visibilité dans l'espace client"
              >
                <span className={"h-1.5 w-1.5 rounded-full " + (item.visibleClient ? "bg-emerald-500" : "bg-slate-400")} />
                Visible par le client : {item.visibleClient ? "ON" : "OFF"}
              </button>
            </form>
          )}
          <form action={deleteWith}>
            <button className="text-sm text-red-600 hover:underline">Supprimer</button>
          </form>
        </div>
      </header>
      <ContraventionForm
        action={updateWith}
        initial={item}
        vehicules={vehicules.map((v) => ({ id: v.id, label: `${v.immatriculation} — ${v.marque ?? ""} ${v.modele ?? ""}` }))}
        conducteurs={conducteurs.map((c) => ({ id: c.id, label: `${c.prenom} ${c.nom}` }))}
        showStatutBlocks
        submitLabel="Mettre à jour"
      />
    </div>
  );
}
