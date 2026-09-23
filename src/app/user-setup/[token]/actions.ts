"use server";

import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { isSetupTokenExpired } from "@/lib/societe-setup";
import { hashPassword } from "@/lib/password";

export async function setOwnPasswordAction(token: string, fd: FormData) {
  const password = (fd.get("password") as string) ?? "";
  const confirmation = (fd.get("confirmation") as string) ?? "";

  const user = await prisma.user.findUnique({ where: { invitationToken: token } });
  if (!user || isSetupTokenExpired(user.invitationExpiresAt)) notFound();

  if (password.length < 8) {
    redirect(`/user-setup/${token}?error=length`);
  }
  if (password !== confirmation) {
    redirect(`/user-setup/${token}?error=mismatch`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(password),
      invitationToken: null,
      invitationExpiresAt: null,
      isActive: true,
    },
  });

  redirect("/login?setup=1");
}
