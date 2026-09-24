import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { OnboardingTour } from "@/components/OnboardingTour";
import { getSociete, isAdminSession, isClientSession, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

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
    <html lang="fr" className={manrope.variable}>
      <body>
        <div className="min-h-screen bg-surface-base">
          {onboarding?.status === "pending" && <OnboardingTour initialStep={onboarding.step} />}
          <div className="flex min-h-screen">
            {societe && !isClient && <Sidebar societe={societe} admin={isAdmin} />}
            <div className="flex min-w-0 flex-1 flex-col">
              {societe && !isClient && <Topbar societe={societe} admin={isAdmin} organizationName={organizationName} />}
              <main className="flex-1 overflow-auto">
                {isClient ? children : <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>}
              </main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
