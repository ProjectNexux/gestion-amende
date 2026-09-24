"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Car,
  Users,
  FileWarning,
  LayoutGrid,
  Download,
  LogOut,
  BookOpenText,
  ShieldCheck,
  Mail,
  Inbox,
  Scale,
  ClockAlert,
  ReceiptEuro,
  Flame,
  Landmark,
  IdCard,
  Megaphone,
  Building2,
  MailOpen,
  LifeBuoy,
  Layers,
  Send,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";

/**
 * Admin navigation (refonte "Nouvelle interface documentaire", 2026-09-24).
 *
 * Flat, activity-grouped structure with non-clickable section headers. Every entry links to a
 * real, existing route — no placeholder destinations. `adminOnly` hides organisation/help entries
 * for plain member sessions, matching the previous access gating.
 */
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (pathname: string) => boolean;
  adminOnly?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const ICON = { size: 18, strokeWidth: 1.75 } as const;

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Traitement documentaire",
    items: [
      { href: "/", label: "Vue d'ensemble", icon: <LayoutGrid {...ICON} />, match: (p) => p === "/" },
      { href: "/admin/scans", label: "Documents reçus", icon: <Inbox {...ICON} />, match: (p) => p.startsWith("/admin/scans") },
      { href: "/courriers/a-transmettre", label: "Dossiers à transmettre", icon: <Send {...ICON} />, match: (p) => p.startsWith("/courriers/a-transmettre") },
      { href: "/courriers", label: "Tous les courriers", icon: <Mail {...ICON} />, match: (p) => p === "/courriers" },
    ],
  },
  {
    label: "Dossiers",
    items: [
      { href: "/contraventions", label: "Contraventions", icon: <FileWarning {...ICON} />, match: (p) => p.startsWith("/contraventions") && !p.startsWith("/contraventions/scan") },
      { href: "/courriers/mise-en-demeure", label: "Mises en demeure", icon: <Scale {...ICON} />, match: (p) => p.startsWith("/courriers/mise-en-demeure") },
      { href: "/courriers/urssaf", label: "URSSAF", icon: <Building2 {...ICON} />, match: (p) => p.startsWith("/courriers/urssaf") },
      { href: "/courriers/retards-paiement", label: "Retards de paiement", icon: <ClockAlert {...ICON} />, match: (p) => p.startsWith("/courriers/retards-paiement") },
      { href: "/courriers/certificats-immatriculation", label: "Certificats d'immatriculation", icon: <IdCard {...ICON} />, match: (p) => p.startsWith("/courriers/certificats-immatriculation") },
      { href: "/courriers/sinistres", label: "Sinistres", icon: <Flame {...ICON} />, match: (p) => p.startsWith("/courriers/sinistres") },
      { href: "/courriers/pub", label: "Publicités", icon: <Megaphone {...ICON} />, match: (p) => p.startsWith("/courriers/pub") },
      { href: "/courriers/clients", label: "Reçus des clients", icon: <MailOpen {...ICON} />, match: (p) => p.startsWith("/courriers/clients") },
      { href: "/guide-infractions", label: "Guide des infractions", icon: <BookOpenText {...ICON} />, match: (p) => p.startsWith("/guide-infractions") },
    ],
  },
  {
    label: "Organisation",
    items: [
      { href: "/admin/clients", label: "Clients", icon: <Building2 {...ICON} />, match: (p) => p.startsWith("/admin/clients"), adminOnly: true },
      { href: "/conducteurs", label: "Conducteurs", icon: <Users {...ICON} />, match: (p) => p.startsWith("/conducteurs") },
      { href: "/vehicules", label: "Véhicules", icon: <Car {...ICON} />, match: (p) => p.startsWith("/vehicules") },
      { href: "/organisation", label: "Mon organisation", icon: <Layers {...ICON} />, match: (p) => p.startsWith("/organisation"), adminOnly: true },
    ],
  },
  {
    label: "Comptabilité",
    items: [
      { href: "/comptabilite/factures", label: "Factures", icon: <ReceiptEuro {...ICON} />, match: (p) => p.startsWith("/comptabilite/factures") },
      { href: "/comptabilite/impots", label: "Impôts", icon: <Landmark {...ICON} />, match: (p) => p.startsWith("/comptabilite/impots") },
    ],
  },
  {
    label: "Outils",
    items: [
      { href: "/aide", label: "Aide et assistance", icon: <LifeBuoy {...ICON} />, match: (p) => p.startsWith("/aide"), adminOnly: true },
    ],
  },
];

export function Sidebar({
  societe,
  admin = false,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  societe: string | null;
  admin?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => admin || !item.adminOnly),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={onCloseMobile}
          className="fixed inset-0 z-[75] bg-navy-950/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={[
          "z-[80] flex flex-col bg-navy-950 text-slate-200",
          "fixed inset-y-0 left-0 transition-[width,transform] duration-200 ease-in-out",
          collapsed ? "lg:w-[76px]" : "lg:w-[264px]",
          "w-[264px]",
          mobileOpen ? "translate-x-0" : "translate-x-0 max-lg:-translate-x-full",
        ].join(" ")}
      >
        {/* Brand + collapse control */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
              <ShieldCheck size={18} strokeWidth={2} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-semibold leading-tight text-white">ScanApp</div>
                <div className="truncate text-[11px] leading-tight text-slate-400">Gestion documentaire</div>
              </div>
            )}
          </Link>
          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Déployer le menu" : "Réduire le menu"}
            title={collapsed ? "Déployer le menu" : "Réduire le menu"}
            className="hidden shrink-0 place-items-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:grid"
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.75} /> : <PanelLeftClose size={18} strokeWidth={1.75} />}
          </button>
          {/* Mobile close */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fermer le menu"
            className="grid shrink-0 place-items-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3 text-sm scrollbar-thin">
          {sections.map((section) => (
            <div key={section.label}>
              {!collapsed ? (
                <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
                  {section.label}
                </div>
              ) : (
                <div className="mx-2.5 mb-1.5 border-t border-white/[0.06]" />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = item.match(pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={[
                        "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150",
                        collapsed ? "justify-center" : "",
                        active ? "bg-white/[0.1] font-medium text-white" : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                      ].join(" ")}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-400" />}
                      <span className={"shrink-0 " + (active ? "text-brand-300" : "text-slate-400 group-hover:text-slate-200")}>{item.icon}</span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Export action */}
        <div className="border-t border-white/10 px-2.5 py-2">
          <a
            href="/api/export"
            title="Export Excel"
            className={"flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white " + (collapsed ? "justify-center" : "")}
          >
            <Download size={18} strokeWidth={1.75} className="shrink-0" />
            {!collapsed && <span>Export Excel</span>}
          </a>
        </div>

        {societe && (
          <div className="border-t border-white/10 px-2.5 py-2.5">
            <div className={"mb-1.5 flex items-center gap-2.5 rounded-lg px-1 py-1 " + (collapsed ? "justify-center" : "")}>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.1] text-[13px] font-semibold text-white">
                {societe.charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[12.5px] font-medium text-white">{societe}</div>
                  <div className="truncate text-[11px] text-slate-400">{admin ? "Administrateur" : "Membre"}</div>
                </div>
              )}
            </div>
            <form action="/api/logout" method="POST">
              <button
                title="Déconnexion"
                className={"flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white " + (collapsed ? "justify-center" : "")}
              >
                <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
                {!collapsed && <span>Déconnexion</span>}
              </button>
            </form>
            {!collapsed && (
              <div className="mt-2 rounded-lg border border-brand-500/30 bg-brand-500/10 px-2.5 py-1.5 text-center text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-200">
                Nouvelle interface documentaire
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
