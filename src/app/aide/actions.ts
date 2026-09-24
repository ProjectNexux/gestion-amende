"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdminSession } from "@/lib/auth";

/** Persists how far the current user got in the guided tour, so reopening the app later resumes
 * exactly where they left off instead of restarting from slide 1. */
export async function advanceOnboardingStepAction(step: number) {
  const userId = await getUserId();
  if (!userId) return;
  await prisma.user.update({ where: { id: userId }, data: { onboardingStep: step } });
}

/** Called when the user finishes all slides ("Terminer") or explicitly skips ("Passer"). */
export async function finishOnboardingAction(status: "completed" | "skipped") {
  const userId = await getUserId();
  if (!userId) return;
  await prisma.user.update({ where: { id: userId }, data: { onboardingStatus: status, onboardingStep: 0 } });
}

/** "Relancer la visite guidée" button in the help center — resets progress so the tour reappears
 * immediately on the next page render. */
export async function restartOnboardingAction() {
  if (!(await isAdminSession())) redirect("/login");
  const userId = await getUserId();
  if (!userId) return;
  await prisma.user.update({ where: { id: userId }, data: { onboardingStatus: "pending", onboardingStep: 0 } });
  revalidatePath("/", "layout");
}
