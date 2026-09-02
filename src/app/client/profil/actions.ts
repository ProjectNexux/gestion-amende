"use server";

import { prisma } from "@/lib/prisma";
import { requireSociete } from "@/lib/auth";

export type ChangerCodeState = { ok: boolean; error?: string };

/**
 * Espace client — security note (2026-08-24): `Societe.codeAcces` is stored in PLAINTEXT (see
 * src/lib/auth.ts's direct `societe.codeAcces !== code` comparison) and is a SHARED secret across
 * every user of a société, not a personal password. Deliberately NOT building a "reveal my code"
 * feature here — displaying a shared plaintext secret on screen is a real exposure risk
 * (screenshots, shoulder-surfing, shared devices, browser history/cache) even to "its own" client.
 * Instead this offers a safe self-service rotation: the client must know the CURRENT code to set
 * a new one, exactly like a password-change flow, and it only ever touches the caller's own
 * société row (never accepts a société name from the client).
 */
export async function changerCodeAccesAction(_prev: ChangerCodeState, formData: FormData): Promise<ChangerCodeState> {
  const societeNom = await requireSociete();

  const codeActuel = (formData.get("codeActuel") as string | null)?.trim();
  const nouveauCode = (formData.get("nouveauCode") as string | null)?.trim();
  const confirmation = (formData.get("confirmation") as string | null)?.trim();

  if (!codeActuel || !nouveauCode || !confirmation) {
    return { ok: false, error: "Merci de remplir tous les champs." };
  }
  if (nouveauCode.length < 6) {
    return { ok: false, error: "Le nouveau code doit contenir au moins 6 caractères." };
  }
  if (nouveauCode !== confirmation) {
    return { ok: false, error: "La confirmation ne correspond pas au nouveau code." };
  }

  const societe = await prisma.societe.findUnique({ where: { nom: societeNom } });
  if (!societe || societe.codeAcces !== codeActuel) {
    return { ok: false, error: "Le code actuel est incorrect." };
  }
  if (nouveauCode === codeActuel) {
    return { ok: false, error: "Le nouveau code doit être différent de l'actuel." };
  }

  await prisma.societe.update({ where: { nom: societeNom }, data: { codeAcces: nouveauCode } });

  return { ok: true };
}
