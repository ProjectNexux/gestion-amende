import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { getSociete, isAdminSession } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "ScanAppAmendes",
  description: "Scannez et gérez les avis de contravention de votre flotte",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const societe = await getSociete();
  const isAdmin = await isAdminSession();

  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <div className="min-h-screen bg-slate-50">
          <div className="flex min-h-screen">
            {societe && <Sidebar societe={societe} admin={isAdmin} />}
            <main className={`flex-1 overflow-auto ${societe ? "" : ""}`}>
              <div className="mx-auto max-w-7xl p-6 lg:p-8">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
