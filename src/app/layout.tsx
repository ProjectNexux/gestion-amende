import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getSociete, isAdminSession, isClientSession } from "@/lib/auth";

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

  return (
    <html lang="fr" className={manrope.variable}>
      <body>
        <div
          className="min-h-screen bg-surface-base"
          style={{ backgroundImage: "radial-gradient(1200px 480px at 15% -10%, rgba(99,102,241,0.07), transparent 60%)" }}
        >
          <div className="flex min-h-screen">
            {societe && !isClient && <Sidebar societe={societe} admin={isAdmin} />}
            <div className="flex min-w-0 flex-1 flex-col">
              {societe && !isClient && <Topbar societe={societe} admin={isAdmin} />}
              <main className="flex-1 overflow-auto">
                {isClient ? children : <div className="mx-auto max-w-7xl p-6 lg:p-8">{children}</div>}
              </main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
