"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSidebarHover } from "@/lib/useSidebarHover";
import {
  Car,
  Users,
  FileText,
  FileWarning,
  LayoutGrid,
  Download,
  LogOut,
  BookOpenText,
  ShieldCheck,
  ChevronDown,
  Mail,
  Inbox,
  Scale,
  ClockAlert,
  ReceiptEuro,
  Flame,
  Calculator,
  Landmark,
  IdCard,
  Megaphone,
  Building2,
  MailOpen,
} from "lucide-react";

/**
 * Navigation configuration for the sidebar.
 *
 * The sidebar is organised as a flat list of top-level entries. Each entry is
 * either a standalone link (e.g. "Tableau de bord") or a collapsible group
 * that regroups several related pages under one category (e.g.
 * "Contraventions"). To add a new category in the future, append a new
 * `group` entry here — no changes to the rendering logic below are needed.
 */
type NavLinkConfig = {
  type: "link";
  id: string;
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (pathname: string) => boolean;
};

// A plain leaf link inside a group (or nested subgroup) — no id needed, the href is unique enough.
type NavChildLink = {
  type: "link";
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (pathname: string) => boolean;
};

// One level of nested collapsible group inside a top-level group (e.g. "Comptabilité" inside "Courriers").
type NavSubGroupConfig = {
  type: "subgroup";
  id: string;
  label: string;
  icon: React.ReactNode;
  children: NavChildLink[];
};

type NavGroupChild = NavChildLink | NavSubGroupConfig;

type NavGroupConfig = {
  type: "group";
  id: string;
  label: string;
  icon: React.ReactNode;
  children: NavGroupChild[];
};

type NavEntry = NavLinkConfig | NavGroupConfig;

const NAV_CONFIG: NavEntry[] = [
  {
    type: "link",
    id: "dashboard",
    href: "/",
    label: "Vue d'ensemble",
    icon: <LayoutGrid size={17} strokeWidth={1.75} />,
    match: (pathname) => pathname === "/",
  },
  {
    type: "group",
    id: "contraventions",
    label: "Contraventions",
    icon: <FileWarning size={17} strokeWidth={1.75} />,
    children: [
      {
        type: "link",
        href: "/contraventions",
        label: "Contraventions",
        icon: <FileText size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/contraventions") && !pathname.startsWith("/contraventions/scan"),
      },
      {
        type: "link",
        href: "/guide-infractions",
        label: "Guide des infractions",
        icon: <BookOpenText size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/guide-infractions"),
      },
      {
        type: "link",
        href: "/vehicules",
        label: "Véhicules",
        icon: <Car size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/vehicules"),
      },
      {
        type: "link",
        href: "/conducteurs",
        label: "Conducteurs",
        icon: <Users size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/conducteurs"),
      },
    ],
  },
  {
    type: "group",
    id: "courriers",
    label: "Courriers",
    icon: <Mail size={17} strokeWidth={1.75} />,
    children: [
      {
        type: "link",
        href: "/courriers",
        label: "Tous les courriers",
        icon: <Inbox size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname === "/courriers",
      },
      {
        type: "link",
        href: "/courriers/mise-en-demeure",
        label: "Mise en demeure",
        icon: <Scale size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/courriers/mise-en-demeure"),
      },
      {
        type: "link",
        href: "/courriers/urssaf",
        label: "URSSAF",
        icon: <Building2 size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/courriers/urssaf"),
      },
      {
        type: "link",
        href: "/courriers/retards-paiement",
        label: "Retards de paiement",
        icon: <ClockAlert size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/courriers/retards-paiement"),
      },
      {
        type: "link",
        href: "/courriers/sinistres",
        label: "Sinistres",
        icon: <Flame size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/courriers/sinistres"),
      },
      {
        type: "link",
        href: "/courriers/certificats-immatriculation",
        label: "Certificats d’immatriculation",
        icon: <IdCard size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/courriers/certificats-immatriculation"),
      },
      {
        type: "link",
        href: "/courriers/pub",
        label: "Pub",
        icon: <Megaphone size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/courriers/pub"),
      },
      {
        type: "link",
        href: "/courriers/clients",
        label: "Reçus des clients",
        icon: <MailOpen size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/courriers/clients"),
      },
    ],
  },
  {
    type: "group",
    id: "comptabilite",
    label: "Comptabilité",
    icon: <Calculator size={17} strokeWidth={1.75} />,
    children: [
      {
        type: "link",
        href: "/comptabilite/factures",
        label: "Factures",
        icon: <ReceiptEuro size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/comptabilite/factures"),
      },
      {
        type: "link",
        href: "/comptabilite/impots",
        label: "Impôts",
        icon: <Landmark size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/comptabilite/impots"),
      },
    ],
  },
];

// Purely visual grouping — non-clickable uppercase section labels above chunks of NAV_CONFIG,
// giving the sidebar real product identity instead of a flat icon list.
const SECTIONS: { label: string; ids: string[] }[] = [
  { label: "Tableau de bord", ids: ["dashboard"] },
  { label: "Gestion", ids: ["contraventions", "courriers", "comptabilite"] },
];

export function Sidebar({ societe, admin = false }: { societe: string | null; admin?: boolean }) {
  const { expanded, collapsed, handleMouseEnter, handleMouseLeave, handleClick } = useSidebarHover();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // A group is active if the current path matches one of its children (a nested subgroup counts
  // as active if any of *its* own children match).
  const groupActiveMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const entry of NAV_CONFIG) {
      if (entry.type === "group") {
        map[entry.id] = entry.children.some((child) => isChildActive(child, pathname));
      }
    }
    return map;
  }, [pathname]);

  return (
    <>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`fixed inset-y-0 left-0 z-[70] flex flex-col border-r border-navy-800/70 bg-gradient-to-b from-navy-900 via-navy-900 to-navy-950 text-slate-100 transition-[width] duration-[220ms] ease-in-out ${
          expanded ? "w-64 shadow-[8px_0_28px_-6px_rgba(0,0,0,0.35)]" : "w-[72px]"
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-navy-800/70 px-4 py-4">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5 cursor-pointer">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
              <ShieldCheck size={17} strokeWidth={2} />
            </div>
            {!collapsed && (
              <div className="min-w-0 sidebar-label">
                <div className="truncate text-[14px] font-semibold leading-tight text-white">ScanApp</div>
                <div className="truncate text-[11px] leading-tight text-slate-300">Gestion documentaire</div>
              </div>
            )}
          </Link>
        </div>

        <nav className="mt-3 flex-1 space-y-3 overflow-y-auto px-2 text-sm scrollbar-thin">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <div className="sidebar-label px-2.5 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300/70">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {NAV_CONFIG.filter((entry) => section.ids.includes(entry.id)).map((entry) =>
                  entry.type === "link" ? (
                    <NavItem key={entry.id} href={entry.href} icon={entry.icon} collapsed={collapsed} active={entry.match(pathname)}>
                      {entry.label}
                    </NavItem>
                  ) : (
                    <NavGroup
                      key={entry.id}
                      group={entry}
                      collapsed={collapsed}
                      pathname={pathname}
                      active={groupActiveMap[entry.id]}
                      open={openGroups[entry.id] ?? groupActiveMap[entry.id]}
                      onToggle={() => toggleGroup(entry.id)}
                      openGroups={openGroups}
                      onToggleGroup={toggleGroup}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-navy-800/70 px-2 py-2.5">
          <a href="/api/export" className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white cursor-pointer" title="Export Excel">
            <Download size={17} strokeWidth={1.75} className="shrink-0" />
            {!collapsed && <span className="sidebar-label">Export Excel</span>}
          </a>
        </div>

        {societe && (
          <div className="border-t border-navy-800/70 px-2.5 py-2.5">
            {!collapsed && (
              <div className="sidebar-label mb-1.5 flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[13px] font-semibold text-white">
                  {societe.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[12.5px] font-medium text-white">{societe}</div>
                  <div className="truncate text-[11px] text-slate-400">{admin ? "Administrateur" : "Membre"}</div>
                </div>
              </div>
            )}
            <form action="/api/logout" method="POST">
              <button className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white cursor-pointer" title="Déconnexion">
                <LogOut size={17} strokeWidth={1.75} className="shrink-0" />
                {!collapsed && <span className="sidebar-label">Déconnexion</span>}
              </button>
            </form>
          </div>
        )}
      </aside>

      {/* Reserves the compact width permanently — the sidebar itself overlays the content when it
          expands on hover, so the page layout never shifts. */}
      <div className="w-[72px] shrink-0" />
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
        "relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150 cursor-pointer " +
        (active
          ? "bg-white/[0.09] font-medium text-white"
          : "text-slate-300 hover:bg-white/[0.06] hover:text-white")
      }
    >
      {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-sky-400" />}
      <span className={"shrink-0 transition-transform duration-200 " + (active ? "text-sky-300" : "") + (collapsed ? " scale-[1.2]" : "")}>{icon}</span>
      {!collapsed && <span className="sidebar-label">{children}</span>}
    </Link>
  );
}

// A group (or subgroup) is active if the current path matches one of its children — a nested
// subgroup counts as active if any of *its own* children match.
function isChildActive(child: NavGroupChild, pathname: string): boolean {
  if (child.type === "link") return child.match(pathname);
  return child.children.some((c) => c.match(pathname));
}

function NavGroup({
  group, collapsed, pathname, active, open, onToggle, openGroups, onToggleGroup,
}: {
  group: NavGroupConfig;
  collapsed: boolean;
  pathname: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  openGroups: Record<string, boolean>;
  onToggleGroup: (id: string) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        title={collapsed ? group.label : undefined}
        aria-expanded={open}
        className={
          "relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150 cursor-pointer " +
          (active
            ? "bg-white/[0.09] font-medium text-white"
            : "text-slate-300 hover:bg-white/[0.06] hover:text-white")
        }
      >
        {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-sky-400" />}
        <span className={"shrink-0 transition-transform duration-200 " + (active ? "text-sky-300" : "") + (collapsed ? " scale-[1.2]" : "")}>{group.icon}</span>
        {!collapsed && (
          <>
            <span className="sidebar-label flex-1 text-left">{group.label}</span>
            <ChevronDown
              size={15}
              strokeWidth={1.75}
              className={`shrink-0 transition-transform duration-200 ease-in-out ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      {!collapsed && (
        <div
          className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="min-h-0 space-y-0.5 overflow-hidden pt-0.5">
            {group.children.map((child) =>
              child.type === "link" ? (
                <Link
                  key={child.href}
                  href={child.href}
                  className={
                    "relative flex items-center gap-3 rounded-lg py-1.5 pl-8 pr-2.5 text-[13px] transition-all duration-150 cursor-pointer " +
                    (child.match(pathname)
                      ? "bg-white/[0.09] font-medium text-white"
                      : "text-slate-300 hover:bg-white/[0.06] hover:text-white")
                  }
                >
                  <span className={"shrink-0 " + (child.match(pathname) ? "text-sky-300" : "")}>{child.icon}</span>
                  <span className="sidebar-label">{child.label}</span>
                </Link>
              ) : (
                <NavSubGroup
                  key={child.id}
                  group={child}
                  collapsed={collapsed}
                  pathname={pathname}
                  open={openGroups[child.id] ?? isChildActive(child, pathname)}
                  onToggle={() => onToggleGroup(child.id)}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NavSubGroup({
  group, collapsed, pathname, open, onToggle,
}: {
  group: NavSubGroupConfig;
  collapsed: boolean;
  pathname: string;
  open: boolean;
  onToggle: () => void;
}) {
  const active = group.children.some((c) => c.match(pathname));
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        title={collapsed ? group.label : undefined}
        aria-expanded={open}
        className={
          "relative flex w-full items-center gap-3 rounded-lg py-1.5 pl-8 pr-2.5 text-[13px] transition-all duration-150 cursor-pointer " +
          (active
            ? "bg-white/[0.09] font-medium text-white"
            : "text-slate-300 hover:bg-white/[0.06] hover:text-white")
        }
      >
        <span className={"shrink-0 " + (active ? "text-sky-300" : "")}>{group.icon}</span>
        {!collapsed && (
          <>
            <span className="sidebar-label flex-1 text-left">{group.label}</span>
            <ChevronDown
              size={13}
              strokeWidth={1.75}
              className={`shrink-0 transition-transform duration-200 ease-in-out ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      {!collapsed && (
        <div
          className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="min-h-0 space-y-0.5 overflow-hidden pt-0.5">
            {group.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={
                  "relative flex items-center gap-3 rounded-md py-1.5 pl-12 pr-2.5 text-[13px] transition-colors cursor-pointer " +
                  (child.match(pathname)
                    ? "bg-white/[0.09] font-medium text-white"
                    : "text-slate-300 hover:bg-white/[0.06] hover:text-white")
                }
              >
                <span className={"shrink-0 " + (child.match(pathname) ? "text-sky-300" : "")}>{child.icon}</span>
                <span className="sidebar-label">{child.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

