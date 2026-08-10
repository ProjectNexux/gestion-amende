"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function getStr(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function getNum(fd: FormData, k: string) {
  const v = getStr(fd, k);
  if (v == null) return null;
  const n = Number(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

async function nextDossierBySociete(societe: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PV-${year}-`;
  const last = await prisma.contravention.findFirst({
    where: { societe, numDossier: { startsWith: prefix } },
    orderBy: { numDossier: "desc" },
  });
  let n = 1;
  if (last) {
    const m = last.numDossier.match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(3, "0")}`;
}

export async function createContraventionAction(fd: FormData) {
  const societe = getStr(fd, "societe") ?? "Societe principale";
  let numDossier = getStr(fd, "numDossier");
  if (!numDossier) numDossier = await nextDossierBySociete(societe);

  const immat = getStr(fd, "immatriculationOcr");
  const selectedVehiculeId = getStr(fd, "vehiculeId");
  const selectedConducteurId = getStr(fd, "conducteurId");
  let vehiculeId: string | null = null;
  if (selectedVehiculeId) {
    const selectedVehicule = await prisma.vehicule.findUnique({ where: { id: selectedVehiculeId } });
    if (selectedVehicule?.societe === societe) vehiculeId = selectedVehicule.id;
  } else if (immat) {
    const v = await prisma.vehicule.findFirst({ where: { societe, immatriculation: immat } });
    if (v) vehiculeId = v.id;
  }

  let conducteurId: string | null = null;
  if (selectedConducteurId) {
    const selectedConducteur = await prisma.conducteur.findUnique({ where: { id: selectedConducteurId } });
    if (selectedConducteur?.societe === societe) conducteurId = selectedConducteur.id;
  }

  const created = await prisma.contravention.create({
    data: {
      societe,
      numDossier,
      dateReceptionAvis: getStr(fd, "dateReceptionAvis"),
      numAvis: getStr(fd, "numAvis"),
      dateInfraction: getStr(fd, "dateInfraction"),
      heureInfraction: getStr(fd, "heureInfraction"),
      natureInfraction: getStr(fd, "natureInfraction"),
      lieuInfraction: getStr(fd, "lieuInfraction"),
      vitesseConstatee: getNum(fd, "vitesseConstatee"),
      vitesseAutorisee: getNum(fd, "vitesseAutorisee"),
      montantAmende: getNum(fd, "montantAmende"),
      pointsRetires: getNum(fd, "pointsRetires"),
      dateLimitePaiement: getStr(fd, "dateLimitePaiement"),
      immatriculationOcr: immat,
      vehiculeId,
      conducteurId,
      statutDenonciation: getStr(fd, "statutDenonciation") ?? "À effectuer",
      statutPaiement: getStr(fd, "statutPaiement") ?? "En attente",
      rawOcrText: getStr(fd, "rawOcrText"),
    },
  });

  revalidatePath("/contraventions");
  revalidatePath("/");
  redirect(`/contraventions/${created.id}`);
}

export async function updateContraventionAction(id: string, fd: FormData) {
  const societe = getStr(fd, "societe") ?? "Societe principale";
  const immat = getStr(fd, "immatriculationOcr");
  const selectedVehiculeId = getStr(fd, "vehiculeId");
  const selectedConducteurId = getStr(fd, "conducteurId");

  let vehiculeId: string | null = null;
  if (selectedVehiculeId) {
    const selectedVehicule = await prisma.vehicule.findUnique({ where: { id: selectedVehiculeId } });
    if (selectedVehicule?.societe === societe) vehiculeId = selectedVehicule.id;
  } else if (immat) {
    const v = await prisma.vehicule.findFirst({ where: { societe, immatriculation: immat } });
    if (v) vehiculeId = v.id;
  }

  let conducteurId: string | null = null;
  if (selectedConducteurId) {
    const selectedConducteur = await prisma.conducteur.findUnique({ where: { id: selectedConducteurId } });
    if (selectedConducteur?.societe === societe) conducteurId = selectedConducteur.id;
  }

  await prisma.contravention.update({
    where: { id },
    data: {
      societe,
      dateReceptionAvis: getStr(fd, "dateReceptionAvis"),
      numAvis: getStr(fd, "numAvis"),
      dateInfraction: getStr(fd, "dateInfraction"),
      heureInfraction: getStr(fd, "heureInfraction"),
      natureInfraction: getStr(fd, "natureInfraction"),
      lieuInfraction: getStr(fd, "lieuInfraction"),
      vitesseConstatee: getNum(fd, "vitesseConstatee"),
      vitesseAutorisee: getNum(fd, "vitesseAutorisee"),
      montantAmende: getNum(fd, "montantAmende"),
      pointsRetires: getNum(fd, "pointsRetires"),
      dateLimitePaiement: getStr(fd, "dateLimitePaiement"),
      immatriculationOcr: immat,
      vehiculeId,
      conducteurId,
      statutDenonciation: getStr(fd, "statutDenonciation"),
      dateDenonciation: getStr(fd, "dateDenonciation"),
      modeDenonciation: getStr(fd, "modeDenonciation"),
      numDenonciationAntai: getStr(fd, "numDenonciationAntai"),
      statutPaiement: getStr(fd, "statutPaiement"),
      datePaiement: getStr(fd, "datePaiement"),
      payePar: getStr(fd, "payePar"),
      observations: getStr(fd, "observations"),
    },
  });

  revalidatePath("/contraventions");
  revalidatePath(`/contraventions/${id}`);
  revalidatePath("/");
}

export async function deleteContraventionAction(id: string) {
  await prisma.contravention.delete({ where: { id } });
  revalidatePath("/contraventions");
  revalidatePath("/");
  redirect("/contraventions");
}
