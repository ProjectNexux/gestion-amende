"use server";

import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { isSetupTokenExpired } from "@/lib/societe-setup";

const MIN_CODE_LENGTH = 6;

export async function setOwnAccessCodeAction(token: string, fd: FormData) {
  const societe = await prisma.societe.findUnique({ where: { codeAccesSetupToken: token } });
  if (!societe || isSetupTokenExpired(societe.codeAccesSetupExpiresAt)) notFound();

  const code = (fd.get("code") as string)?.trim();
  const confirmation = (fd.get("confirmation") as string)?.trim();
  if (!code || code.length < MIN_CODE_LENGTH) {
    redirect(`/client-setup/${token}?error=length`);
  }
  if (code !== confirmation) {
    redirect(`/client-setup/${token}?error=mismatch`);
  }

  // Single-use: clears the token so this link can never be replayed once the code is set.
  await prisma.societe.update({
    where: { id: societe.id },
    data: { codeAcces: code, codeAccesSetupToken: null, codeAccesSetupExpiresAt: null },
  });

  redirect("/login?setup=1");
}

