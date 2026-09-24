"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileWarning, FolderOpen, Send, Star, UserCircle, LogOut, LifeBuoy, Building2, type LucideIcon } from "lucide-react";
import { useSidebarHover } from "@/lib/useSidebarHover";
import type { ClientNavSection } from "./nav-config";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileWarning,
  FolderOpen,
  Send,
  Star,
  UserCircle,
  LifeBuoy,
};

/**
 * Client portal sidebar — refonte 2026-09-23. Visuellement distincte de l'ancienne version (navy
 * uni + barre latérale fine) ET de la sidebar admin (anthracite) : dégradé slate→teal, items actifs
 * en "pill" pleine largeur (pas de barre d'accent latérale), logo distinct. Même comportement
 * hover expand/collapse (`useSidebarHover`) que le reste de l'app.
 */
export function ClientSidebar({ societe, sections }: { societe: string; sections: ClientNavSection[] }) {
  const { expanded, collapsed, handleMouseEnter, handleMouseLeave, handleClick } = useSidebarHover();
  const pathname = usePathname();

  return (
    <>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`fixed inset-y-0 left-0 z-[70] flex flex-col bg-gradient-to-b from-navy-950 via-navy-900 to-teal-950 text-slate-300 transition-[width] duration-[220ms] ease-in-out ${
          expanded ? "w-64 shadow-[8px_0_28px_-6px_rgba(0,0,0,0.35)]" : "w-[72px]"
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-500 text-slate-900 shadow-sm">
            <Building2 size={17} />
          </div>
          {!collapsed && (
            <div className="min-w-0 sidebar-label">
              <div className="truncate text-sm font-semibold text-white">Portail société</div>
              <div className="truncate text-xs text-teal-300/80">{societe}</div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
          {sections.map((section, idx) => (
            <div key={section.label ?? idx}>
              {!collapsed && section.label && (
                <p className="sidebar-label px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {section.label}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = item.href === "/client" ? pathname === "/client" : pathname.startsWith(item.href);
                  const linkClassName =
                    "flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition " +
                    (active ? "bg-teal-500 text-slate-900 shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white");
                  return (
                    <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} className={linkClassName}>
                      {Icon && <Icon size={17} className={"shrink-0 " + (active ? "text-slate-900" : "text-slate-400")} />}
                      {!collapsed && <span className="sidebar-label truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="sidebar-label border-t border-white/10 p-3">
            <div className="rounded-2xl bg-white/5 p-3.5 text-slate-300">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-white">
                <LifeBuoy size={16} className="text-teal-400" /> Besoin d&apos;aide ?
              </div>
              <p className="text-xs text-slate-400">Consultez le guide ou contactez notre équipe.</p>
              <Link
                href="/client/aide"
                className="mt-2.5 block rounded-full bg-teal-500 px-3 py-1.5 text-center text-xs font-semibold text-slate-900 transition hover:bg-teal-400"
              >
                Assistance et guide
              </Link>
            </div>
          </div>
        )}

        <div className="border-t border-white/10 px-2.5 py-2.5">
          {!collapsed && (
            <div className="sidebar-label mb-1.5 flex items-center gap-2.5 rounded-full px-1 py-1.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-500/20 text-[13px] font-semibold text-teal-300">
                {societe.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[12.5px] font-medium text-white">{societe}</div>
                <div className="truncate text-[11px] text-slate-500">Compte société</div>
              </div>
            </div>
          )}
          <form action="/api/logout" method="POST">
            <button
              type="submit"
              title={collapsed ? "Déconnexion" : undefined}
              className="flex w-full items-center gap-3 rounded-full px-3 py-2 text-[13px] font-medium text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut size={17} className="shrink-0" />
              {!collapsed && <span className="sidebar-label">Déconnexion</span>}
            </button>
          </form>
        </div>
      </aside>

      {/* Reserves the compact width permanently — the sidebar overlays the content when it
          expands on hover, so the client dashboard never shifts horizontally. */}
      <div className="w-[72px] shrink-0" />
    </>
  );
}
