"use server";

import { prisma } from "@/lib/prisma";
import { requireSociete } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type FavoriItemType = "courrier" | "contravention";

/** Toggle a favori for the currently authenticated société — never trusts a société passed from
 * the browser, always taken from the session. */
export async function toggleFavoriAction(itemType: FavoriItemType, itemId: string, next: boolean) {
  const societe = await requireSociete();

  if (next) {
    await prisma.favori.upsert({
      where: { societe_itemType_itemId: { societe, itemType, itemId } },
      update: {},
      create: { societe, itemType, itemId },
    });
  } else {
    await prisma.favori.deleteMany({ where: { societe, itemType, itemId } });
  }

  revalidatePath("/client");
  revalidatePath("/client/courriers");
  revalidatePath("/client/contraventions");
  revalidatePath("/client/favoris");
}
