import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ContraventionForm from "@/components/ContraventionForm";
import { updateContraventionAction, deleteContraventionAction } from "../actions";
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
          <p className="text-sm text-gray-500">Modifier le dossier</p>
        </div>
        <form action={deleteWith}>
          <button className="text-sm text-red-600 hover:underline">Supprimer</button>
        </form>
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
