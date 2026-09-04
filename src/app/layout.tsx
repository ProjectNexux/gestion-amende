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
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(45,91,222,0.08),_transparent_35%),_#f3f1ed]" >
          <div className="flex min-h-screen">
            {societe && !isClient && <Sidebar societe={societe} admin={isAdmin} />}
            <div className="flex min-w-0 flex-1 flex-col">
              {societe && !isClient && <Topbar societe={societe} admin={isAdmin} />}
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
