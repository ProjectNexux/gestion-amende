"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  const societe = s(fd, "societe") ?? "Societe principale";
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
  await prisma.vehicule.delete({ where: { id } });
  revalidatePath("/vehicules");
}
