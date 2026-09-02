"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { requireSociete, isAdminSession } from "@/lib/auth";

function s(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function nextCode(societe: string): Promise<string> {
  const last = await prisma.vehicule.findFirst({
    where: { societe },
    orderBy: { code: "desc" },
  });
  let n = 1;
  if (last) {
    const m = last.code.match(/(\d+)/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `VEH${String(n).padStart(3, "0")}`;
}

export async function createVehicule(fd: FormData) {
  const societe = await requireSociete();
  const code = s(fd, "code") ?? (await nextCode(societe));
  const immatriculation = s(fd, "immatriculation");
  if (!immatriculation) return;
  await prisma.vehicule.create({
    data: {
      societe,
      code,
      immatriculation,
      marque: s(fd, "marque"),
      modele: s(fd, "modele"),
      typeVehicule: s(fd, "typeVehicule"),
      service: s(fd, "service"),
      statut: s(fd, "statut") ?? "En service",
    },
  });
  revalidatePath("/vehicules");
  redirect("/vehicules");
}

export async function deleteVehicule(id: string) {
  const societe = await requireSociete();
  const isAdmin = await isAdminSession();
  const existing = await prisma.vehicule.findFirst({ where: isAdmin ? { id } : { id, societe } });
  if (!existing) notFound();
  await prisma.vehicule.delete({ where: { id } });
  revalidatePath("/vehicules");
}

export async function updateVehicule(id: string, fd: FormData) {
  const societe = await requireSociete();
  const existing = await prisma.vehicule.findFirst({ where: { id, societe } });
  if (!existing) notFound();

  const conducteurAttitre = s(fd, "conducteurAttitre");
  let conducteurAttitreSafe: string | null = null;
  if (conducteurAttitre) {
    const conducteur = await prisma.conducteur.findFirst({
      where: { id: conducteurAttitre, societe },
      select: { id: true },
    });
    if (!conducteur) {
      throw new Error("Conducteur attitré invalide pour cette société.");
    }
    conducteurAttitreSafe = conducteur.id;
  }

  await prisma.vehicule.update({
    where: { id },
    data: {
      code: s(fd, "code") ?? existing.code,
      immatriculation: s(fd, "immatriculation") ?? existing.immatriculation,
      marque: s(fd, "marque"),
      modele: s(fd, "modele"),
      typeVehicule: s(fd, "typeVehicule"),
      service: s(fd, "service"),
      statut: s(fd, "statut") ?? "En service",
      conducteurAttitre: conducteurAttitreSafe,
    },
  });

  revalidatePath("/vehicules");
  revalidatePath(`/vehicules/${id}`);
  redirect(`/vehicules/${id}`);
}
