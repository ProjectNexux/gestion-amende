import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Car, Users, FileText, ScanLine, LayoutDashboard, Download } from "lucide-react";

export const metadata: Metadata = {
  title: "Gestion Amendes — SaaS",
  description: "Scannez et gérez les avis de contravention de votre flotte",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="flex min-h-screen">
          <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="px-6 py-5 border-b border-gray-200">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-brand)] text-white grid place-items-center font-bold">A</div>
                <div>
                  <div className="font-semibold text-sm">Amendes</div>
                  <div className="text-xs text-gray-500">Gestion flotte</div>
                </div>
              </Link>
            </div>
            <nav className="flex-1 p-3 space-y-1 text-sm">
              <NavItem href="/" icon={<LayoutDashboard size={16} />}>Tableau de bord</NavItem>
              <NavItem href="/contraventions/scan" icon={<ScanLine size={16} />} highlight>Scanner une amende</NavItem>
              <NavItem href="/contraventions" icon={<FileText size={16} />}>Contraventions</NavItem>
              <NavItem href="/vehicules" icon={<Car size={16} />}>Véhicules</NavItem>
              <NavItem href="/conducteurs" icon={<Users size={16} />}>Conducteurs</NavItem>
              <div className="pt-3 mt-3 border-t border-gray-200">
                <a
                  href="/api/export"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  <Download size={16} /> Export Excel
                </a>
              </div>
            </nav>
            <div className="p-4 text-[11px] text-gray-400 border-t">v0.1 · local SQLite</div>
          </aside>
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}

function NavItem({
  href, icon, children, highlight,
}: { href: string; icon: React.ReactNode; children: React.ReactNode; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={
        "flex items-center gap-2 px-3 py-2 rounded-md transition " +
        (highlight
          ? "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)]"
          : "text-gray-700 hover:bg-gray-100")
      }
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
