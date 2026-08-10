import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const societeA = "Transports Atlas";
  const societeB = "Logistique Horizon";

  await prisma.vehicule.createMany({
    data: [
      { societe: societeA, code: "VEH001", immatriculation: "AB-123-CD", marque: "Renault", modele: "Master", typeVehicule: "Fourgon", service: "Livraison" },
      { societe: societeA, code: "VEH002", immatriculation: "EF-456-GH", marque: "Mercedes", modele: "Sprinter", typeVehicule: "Fourgon", service: "Livraison" },
      { societe: societeB, code: "VEH001", immatriculation: "IJ-789-KL", marque: "Iveco", modele: "Daily", typeVehicule: "Camion", service: "Poids lourds" },
      { societe: societeB, code: "VEH002", immatriculation: "MN-012-OP", marque: "Peugeot", modele: "Expert", typeVehicule: "Utilitaire", service: "Transport voyageurs" },
    ],
  });

  await prisma.conducteur.createMany({
    data: [
      { societe: societeA, code: "COND001", civilite: "M.", nom: "DUPONT", prenom: "Jean", telephone: "06 12 34 56 78", email: "j.dupont@transport.fr", numPermis: "12AB34567" },
      { societe: societeA, code: "COND002", civilite: "Mme", nom: "MARTIN", prenom: "Sophie", telephone: "06 98 76 54 32", email: "s.martin@transport.fr", numPermis: "98XY76543" },
      { societe: societeB, code: "COND001", civilite: "M.", nom: "BERNARD", prenom: "Pierre", telephone: "06 55 44 33 22", email: "p.bernard@transport.fr", numPermis: "56CD78901" },
    ],
  });

  console.log("✅ Seed terminé");
}

main().finally(() => prisma.$disconnect());
