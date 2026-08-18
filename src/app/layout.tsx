import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { getSociete, isAdminSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Gestion Amendes — SaaS",
  description: "Scannez et gérez les avis de contravention de votre flotte",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const societe = await getSociete();
  const isAdmin = await isAdminSession();

  return (
    <html lang="fr">
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
