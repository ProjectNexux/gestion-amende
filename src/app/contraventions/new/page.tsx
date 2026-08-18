import { prisma } from "@/lib/prisma";
import ContraventionForm from "@/components/ContraventionForm";
import { createContraventionAction } from "../actions";
import { requireSociete } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewContraventionPage() {
  const societe = await requireSociete();
  const [vehicules, conducteurs] = await Promise.all([
    prisma.vehicule.findMany({ where: { societe }, orderBy: { immatriculation: "asc" } }),
    prisma.conducteur.findMany({ where: { societe }, orderBy: { nom: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nouvelle contravention</h1>
      <ContraventionForm
        action={createContraventionAction}
        vehicules={vehicules.map((v) => ({ id: v.id, label: `${v.immatriculation} — ${v.marque ?? ""} ${v.modele ?? ""}` }))}
        conducteurs={conducteurs.map((c) => ({ id: c.id, label: `${c.prenom} ${c.nom}` }))}
        submitLabel="Créer le dossier"
      />
    </div>
  );
}
