"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function s(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function nextCode(societe: string): Promise<string> {
  const last = await prisma.conducteur.findFirst({
    where: { societe },
    orderBy: { code: "desc" },
  });
  let n = 1;
  if (last) {
    const m = last.code.match(/(\d+)/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `COND${String(n).padStart(3, "0")}`;
}

export async function createConducteur(fd: FormData) {
  const societe = s(fd, "societe") ?? "Societe principale";
  const code = s(fd, "code") ?? (await nextCode(societe));
  const nom = s(fd, "nom");
  const prenom = s(fd, "prenom");
  if (!nom || !prenom) return;
  await prisma.conducteur.create({
    data: {
      societe,
      code, nom, prenom,
      civilite: s(fd, "civilite"),
      telephone: s(fd, "telephone"),
      email: s(fd, "email"),
      numPermis: s(fd, "numPermis"),
    },
  });
  revalidatePath("/conducteurs");
  redirect("/conducteurs");
}

export async function deleteConducteur(id: string) {
  await prisma.conducteur.delete({ where: { id } });
  revalidatePath("/conducteurs");
}
