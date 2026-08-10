import { prisma } from "@/lib/prisma";
import ScanClient from "./ScanClient";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const [vehicules, conducteurs] = await Promise.all([
    prisma.vehicule.findMany({ orderBy: [{ societe: "asc" }, { immatriculation: "asc" }] }),
    prisma.conducteur.findMany({ orderBy: [{ societe: "asc" }, { nom: "asc" }] }),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Scanner une amende</h1>
        <p className="text-sm text-gray-500">Importez la photo ou le scan de l'avis. Les champs seront pré-remplis automatiquement.</p>
      </header>
      <ScanClient
        vehicules={vehicules.map((v) => ({ id: v.id, label: `[${v.societe}] ${v.immatriculation} — ${v.marque ?? ""} ${v.modele ?? ""}` }))}
        conducteurs={conducteurs.map((c) => ({ id: c.id, label: `[${c.societe}] ${c.prenom} ${c.nom}` }))}
        knownPlates={vehicules.map((v) => v.immatriculation)}
      />
    </div>
  );
}
