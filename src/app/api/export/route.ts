import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

export async function GET() {
  const [contraventions, vehicules, conducteurs] = await Promise.all([
    prisma.contravention.findMany({ include: { vehicule: true, conducteur: true }, orderBy: [{ societe: "asc" }, { numDossier: "asc" }] }),
    prisma.vehicule.findMany({ orderBy: [{ societe: "asc" }, { code: "asc" }] }),
    prisma.conducteur.findMany({ orderBy: [{ societe: "asc" }, { code: "asc" }] }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestion Amendes SaaS";
  wb.created = new Date();

  // -------------------- Tableau de bord --------------------
  const dash = wb.addWorksheet("Tableau de bord");
  dash.columns = [{ width: 38 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  dash.getCell("A1").value = "TABLEAU DE BORD - GESTION DES CONTRAVENTIONS";
  dash.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  dash.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  dash.mergeCells("A1:E1");

  dash.getCell("A3").value = "INDICATEURS CLÉS";
  dash.getCell("A3").font = { bold: true };

  const totalMontant = contraventions.reduce((a, c) => a + (c.montantAmende ?? 0), 0);
  const rows: [string, string | number][] = [
    ["Nombre total de contraventions", contraventions.length],
    ["Nombre de sociétés", new Set(contraventions.map((c) => c.societe)).size],
    ["Dénonciations à effectuer", contraventions.filter((c) => c.statutDenonciation !== "Effectuée").length],
    ["Paiements en attente", contraventions.filter((c) => c.statutPaiement === "En attente").length],
    ["Montant total amendes (€)", totalMontant],
  ];
  rows.forEach((r, i) => {
    dash.getCell(`A${4 + i}`).value = r[0];
    dash.getCell(`B${4 + i}`).value = r[1];
  });

  // -------------------- Véhicules --------------------
  const ws1 = wb.addWorksheet("Véhicules");
  ws1.columns = [
    { header: "Société", key: "societe", width: 22 },
    { header: "ID Véhicule", key: "code", width: 12 },
    { header: "Immatriculation", key: "immatriculation", width: 16 },
    { header: "Marque", key: "marque", width: 14 },
    { header: "Modèle", key: "modele", width: 14 },
    { header: "Type véhicule", key: "typeVehicule", width: 14 },
    { header: "Date 1ère immatriculation", key: "datePremiereImmat", width: 18 },
    { header: "Date acquisition", key: "dateAcquisition", width: 16 },
    { header: "N° Carte grise", key: "numCarteGrise", width: 16 },
    { header: "PTAC (kg)", key: "ptac", width: 10 },
    { header: "Service/Département", key: "service", width: 18 },
    { header: "Conducteur attitré", key: "conducteurAttitre", width: 18 },
    { header: "Statut", key: "statut", width: 12 },
    { header: "Date contrôle technique", key: "dateControleTech", width: 18 },
    { header: "Assurance N°", key: "assuranceNum", width: 16 },
    { header: "Observations", key: "observations", width: 24 },
  ];
  vehicules.forEach((v) => ws1.addRow(v));
  styleHeader(ws1);

  // -------------------- Conducteurs --------------------
  const ws2 = wb.addWorksheet("Conducteurs");
  ws2.columns = [
    { header: "Société", key: "societe", width: 22 },
    { header: "ID Conducteur", key: "code", width: 12 },
    { header: "Civilité", key: "civilite", width: 10 },
    { header: "Nom", key: "nom", width: 16 },
    { header: "Prénom", key: "prenom", width: 16 },
    { header: "Date de naissance", key: "dateNaissance", width: 14 },
    { header: "Lieu de naissance", key: "lieuNaissance", width: 14 },
    { header: "Adresse", key: "adresse", width: 24 },
    { header: "Code postal", key: "codePostal", width: 10 },
    { header: "Ville", key: "ville", width: 14 },
    { header: "Pays", key: "pays", width: 10 },
    { header: "Téléphone", key: "telephone", width: 16 },
    { header: "Email", key: "email", width: 22 },
    { header: "N° Permis", key: "numPermis", width: 14 },
    { header: "Date obtention permis", key: "dateObtention", width: 16 },
    { header: "Catégories permis", key: "categoriesPermis", width: 16 },
    { header: "Date d'embauche", key: "dateEmbauche", width: 14 },
    { header: "Statut", key: "statut", width: 10 },
  ];
  conducteurs.forEach((c) => ws2.addRow(c));
  styleHeader(ws2);

  // -------------------- Contraventions --------------------
  const ws3 = wb.addWorksheet("Contraventions");
  ws3.columns = [
    { header: "Société", key: "societe", width: 22 },
    { header: "N° Dossier", key: "numDossier", width: 14 },
    { header: "Date réception avis", key: "dateReceptionAvis", width: 16 },
    { header: "N° Avis contravention", key: "numAvis", width: 22 },
    { header: "Date infraction", key: "dateInfraction", width: 14 },
    { header: "Heure infraction", key: "heureInfraction", width: 12 },
    { header: "Immatriculation", key: "immat", width: 14 },
    { header: "Nom conducteur", key: "nomCond", width: 14 },
    { header: "Prénom conducteur", key: "prenomCond", width: 14 },
    { header: "Nature infraction", key: "natureInfraction", width: 30 },
    { header: "Lieu infraction", key: "lieuInfraction", width: 30 },
    { header: "Vitesse constatée", key: "vitesseConstatee", width: 12 },
    { header: "Vitesse autorisée", key: "vitesseAutorisee", width: 12 },
    { header: "Montant amende (€)", key: "montantAmende", width: 14 },
    { header: "Date limite paiement", key: "dateLimitePaiement", width: 16 },
    { header: "Statut dénonciation", key: "statutDenonciation", width: 14 },
    { header: "Date dénonciation", key: "dateDenonciation", width: 14 },
    { header: "Mode dénonciation", key: "modeDenonciation", width: 16 },
    { header: "N° Dénonciation ANTAI", key: "numDenonciationAntai", width: 20 },
    { header: "Statut paiement", key: "statutPaiement", width: 12 },
    { header: "Date paiement", key: "datePaiement", width: 14 },
    { header: "Payé par", key: "payePar", width: 12 },
    { header: "Observations", key: "observations", width: 24 },
  ];
  contraventions.forEach((c) => {
    ws3.addRow({
      ...c,
      immat: c.vehicule?.immatriculation ?? c.immatriculationOcr ?? "",
      nomCond: c.conducteur?.nom ?? "",
      prenomCond: c.conducteur?.prenom ?? "",
    });
  });
  styleHeader(ws3);

  const buf = await wb.xlsx.writeBuffer();
  const filename = `gestion-amendes-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}
