import { prisma } from "@/lib/prisma";
import ContraventionForm from "@/components/ContraventionForm";
import { createContraventionAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewContraventionPage() {
  const [vehicules, conducteurs] = await Promise.all([
    prisma.vehicule.findMany({ orderBy: [{ societe: "asc" }, { immatriculation: "asc" }] }),
    prisma.conducteur.findMany({ orderBy: [{ societe: "asc" }, { nom: "asc" }] }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nouvelle contravention</h1>
      <ContraventionForm
        action={createContraventionAction}
        vehicules={vehicules.map((v) => ({ id: v.id, label: `[${v.societe}] ${v.immatriculation} — ${v.marque ?? ""} ${v.modele ?? ""}` }))}
        conducteurs={conducteurs.map((c) => ({ id: c.id, label: `[${c.societe}] ${c.prenom} ${c.nom}` }))}
        submitLabel="Créer le dossier"
      />
    </div>
  );
}
