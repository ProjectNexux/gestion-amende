"use client";

import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Car, Users, FileText, ScanLine, LayoutDashboard, Download, LogOut, BookOpenText } from "lucide-react";

export function Sidebar({ societe, admin = false }: { societe: string | null; admin?: boolean }) {
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCollapsed(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setCollapsed(true);
    }, 200);
  }, []);

  const isDashboard = pathname === "/";
  const isScanner = pathname.startsWith("/contraventions/scan");
  const isContraventions = pathname.startsWith("/contraventions") && !isScanner;
  const isGuide = pathname.startsWith("/guide-infractions");
  const isVehicules = pathname.startsWith("/vehicules");
  const isConducteurs = pathname.startsWith("/conducteurs");

  return (
    <>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/10 bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-slate-100 shadow-[0_25px_70px_-20px_rgba(15,23,42,0.8)] transition-[width] duration-[250ms] ease-in-out cursor-default ${collapsed ? "w-16" : "w-64"}`}
      >
        <div className="border-b border-white/10 px-3 py-4">
          <Link href="/" className="flex items-center gap-3 cursor-pointer">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 font-bold text-white shadow-lg shadow-indigo-500/30">A</div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{admin ? "Espace principal" : (societe ?? "Amendes")}</div>
                <div className="text-xs text-indigo-200/80">{admin ? "Vue globale" : "Gestion flotte"}</div>
              </div>
            )}
          </Link>
        </div>

        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-2 text-sm scrollbar-thin">
          <NavItem href="/" icon={<LayoutDashboard size={16} />} collapsed={collapsed} active={isDashboard}>Tableau de bord</NavItem>
          <NavItem href="/contraventions/scan" icon={<ScanLine size={16} />} collapsed={collapsed} active={isScanner}>Scanner une amende</NavItem>
          <NavItem href="/contraventions" icon={<FileText size={16} />} collapsed={collapsed} active={isContraventions}>Contraventions</NavItem>
          <NavItem href="/guide-infractions" icon={<BookOpenText size={16} />} collapsed={collapsed} active={isGuide}>Guide infractions</NavItem>
          <NavItem href="/vehicules" icon={<Car size={16} />} collapsed={collapsed} active={isVehicules}>Véhicules</NavItem>
          <NavItem href="/conducteurs" icon={<Users size={16} />} collapsed={collapsed} active={isConducteurs}>Conducteurs</NavItem>
        </nav>

        <div className="border-t border-white/10 px-2 py-3">
          <a href="/api/export" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white cursor-pointer" title="Export Excel">
            <Download size={16} className="shrink-0" />
            {!collapsed && <span>Export Excel</span>}
          </a>
        </div>

        {!collapsed && <div className="px-5 py-3 text-[11px] text-indigo-200/70">v0.1 · local SQLite</div>}

        {societe && (
          <div className="border-t border-white/10 px-2 py-3">
            <form action="/api/logout" method="POST">
              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white cursor-pointer" title="Déconnexion">
                <LogOut size={16} className="shrink-0" />
                {!collapsed && <span>Déconnexion</span>}
              </button>
            </form>
          </div>
        )}
      </aside>

      <div className={`shrink-0 transition-[width] duration-[250ms] ease-in-out ${collapsed ? "w-16" : "w-64"}`} />
    </>
  );
}

function NavItem({
  href, icon, children, active, collapsed,
}: { href: string; icon: React.ReactNode; children: React.ReactNode; active?: boolean; collapsed: boolean }) {
  return (
    <Link
      href={href}
      title={collapsed ? (children as string) : undefined}
      className={
        "flex items-center gap-2 rounded-xl px-3 py-2.5 transition cursor-pointer " +
        (active
          ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:brightness-110"
          : "text-slate-200 hover:bg-white/10 hover:text-white")
      }
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span>{children}</span>}
    </Link>
  );
}
