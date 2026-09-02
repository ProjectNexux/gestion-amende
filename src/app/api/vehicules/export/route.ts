import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireSociete, isAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();

  const requestedSociete = req.nextUrl.searchParams.get("societe")?.trim() || null;
  // Non-admins can only ever export their own société, no matter what's requested.
  const where = isAdmin ? (requestedSociete ? { societe: requestedSociete } : {}) : { societe };

  const vehicules = await prisma.vehicule.findMany({
    where,
    orderBy: [{ societe: "asc" }, { code: "asc" }],
  });

  const conducteurIds = Array.from(new Set(vehicules.map((v) => v.conducteurAttitre).filter(Boolean))) as string[];
  const conducteurs = conducteurIds.length
    ? await prisma.conducteur.findMany({ where: { id: { in: conducteurIds } }, select: { id: true, nom: true, prenom: true } })
    : [];
  const conducteurNameById = new Map(conducteurs.map((c) => [c.id, `${c.prenom} ${c.nom}`]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestion Amendes SaaS";
  wb.created = new Date();
  const ws = wb.addWorksheet("Véhicules");
  ws.columns = [
    { header: "Société", key: "societe", width: 22 },
    { header: "Code", key: "code", width: 12 },
    { header: "Immatriculation", key: "immatriculation", width: 16 },
    { header: "Marque", key: "marque", width: 14 },
    { header: "Modèle", key: "modele", width: 14 },
    { header: "Type", key: "typeVehicule", width: 14 },
    { header: "Conducteur", key: "conducteur", width: 20 },
    { header: "Date 1ère immatriculation", key: "datePremiereImmat", width: 18 },
    { header: "Date acquisition", key: "dateAcquisition", width: 16 },
    { header: "N° Carte grise", key: "numCarteGrise", width: 16 },
    { header: "PTAC (kg)", key: "ptac", width: 10 },
    { header: "Service", key: "service", width: 16 },
    { header: "Statut", key: "statut", width: 12 },
    { header: "Date contrôle technique", key: "dateControleTech", width: 18 },
    { header: "N° Assurance", key: "assuranceNum", width: 16 },
    { header: "Observations", key: "observations", width: 24 },
  ];
  vehicules.forEach((v) => {
    ws.addRow({ ...v, conducteur: v.conducteurAttitre ? conducteurNameById.get(v.conducteurAttitre) ?? "" : "" });
  });
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  const datePart = new Date().toISOString().slice(0, 10);
  const filename = requestedSociete
    ? `vehicules_${requestedSociete.replace(/[^a-zA-Z0-9-_]+/g, "-")}_${datePart}.xlsx`
    : `vehicules_${datePart}.xlsx`;

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
