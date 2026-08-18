import { prisma } from "@/lib/prisma";
import ScanClient from "./ScanClient";
import { requireSociete } from "@/lib/auth";
import { ScanEmailInfo, EmailScanList } from "@/components/EmailScanSection";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const societe = await requireSociete();
  const [vehicules, conducteurs] = await Promise.all([
    prisma.vehicule.findMany({ where: { societe }, orderBy: { immatriculation: "asc" } }),
    prisma.conducteur.findMany({ where: { societe }, orderBy: { nom: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Scanner une amende</h1>
        <p className="text-sm text-gray-500">Importez un avis de contravention pour extraire automatiquement les informations.</p>
      </header>
      <ScanClient
        vehicules={vehicules.map((v) => ({ id: v.id, label: `${v.immatriculation} — ${v.marque ?? ""} ${v.modele ?? ""}` }))}
        conducteurs={conducteurs.map((c) => ({ id: c.id, label: `${c.prenom} ${c.nom}` }))}
        knownPlates={vehicules.map((v) => v.immatriculation)}
      />
      <ScanEmailInfo />
      <EmailScanList />
    </div>
  );
}
