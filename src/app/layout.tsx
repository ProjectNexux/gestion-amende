import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { OnboardingTour } from "@/components/OnboardingTour";
import { getSociete, isAdminSession, isClientSession, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "ScanAppAmendes",
  description: "Scannez et gérez les avis de contravention de votre flotte",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const societe = await getSociete();
  const isAdmin = await isAdminSession();
  // Espace client (2026-08-24): the CLIENT role never sees the admin Sidebar/Topbar — its own
  // /client/layout.tsx renders a completely separate, minimal chrome instead.
  const isClient = await isClientSession();

  // Assistance intégrée (2026-09-24): visite guidée facultative, uniquement pour un compte admin
  // qui ne l'a ni terminée ni passée — jamais proposée à un compte client ou société standard.
  let onboarding: { status: string; step: number } | null = null;
  let organizationName: string | null = null;
  if (isAdmin) {
    const userId = await getUserId();
    const user = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { onboardingStatus: true, onboardingStep: true, organizationMember: { select: { organization: { select: { name: true } } } } },
        })
      : null;
    if (user) onboarding = { status: user.onboardingStatus, step: user.onboardingStep };
    organizationName = user?.organizationMember?.organization?.name ?? null;
  }

  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <div className="min-h-screen bg-surface-base">
          {onboarding?.status === "pending" && <OnboardingTour initialStep={onboarding.step} />}
          {societe && !isClient ? (
            <AppShell societe={societe} admin={isAdmin} organizationName={organizationName}>
              {children}
            </AppShell>
          ) : (
            children
          )}
        </div>
      </body>
    </html>
  );
}
