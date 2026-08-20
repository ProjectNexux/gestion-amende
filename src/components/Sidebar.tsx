"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Car,
  Users,
  FileText,
  FileWarning,
  ScanLine,
  LayoutDashboard,
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
    label: "Tableau de bord",
    icon: <LayoutDashboard size={17} strokeWidth={1.75} />,
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
        href: "/contraventions/scan",
        label: "Scanner une amende",
        icon: <ScanLine size={17} strokeWidth={1.75} />,
        match: (pathname) => pathname.startsWith("/contraventions/scan"),
      },
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

export function Sidebar({ societe, admin = false }: { societe: string | null; admin?: boolean }) {
  const [collapsed, setCollapsed] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
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
        className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-800 bg-slate-900 text-slate-100 transition-[width] duration-[220ms] ease-in-out cursor-default ${collapsed ? "w-14" : "w-60"}`}
      >
        <div className="border-b border-slate-800/80 px-3 py-4">
          <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-600 text-white">
              <ShieldCheck size={17} strokeWidth={2} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold leading-tight text-white">ScanAppAmendes</div>
                <div className="truncate text-[11px] leading-tight text-slate-400">Gestion des contraventions</div>
              </div>
            )}
          </Link>
        </div>

        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 text-sm scrollbar-thin">
          {NAV_CONFIG.map((entry) =>
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
        </nav>

        <div className="border-t border-slate-800/80 px-2 py-2.5">
          <a href="/api/export" className="flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white cursor-pointer" title="Export Excel">
            <Download size={17} strokeWidth={1.75} className="shrink-0" />
            {!collapsed && <span>Export Excel</span>}
          </a>
        </div>

        {!collapsed && <div className="px-4 py-2 text-[10.5px] text-slate-500">v0.1 · local SQLite</div>}

        {societe && (
          <div className="border-t border-slate-800/80 px-2 py-2.5">
            <form action="/api/logout" method="POST">
              <button className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white cursor-pointer" title="Déconnexion">
                <LogOut size={17} strokeWidth={1.75} className="shrink-0" />
                {!collapsed && <span>Déconnexion</span>}
              </button>
            </form>
          </div>
        )}
      </aside>

      <div className={`shrink-0 transition-[width] duration-[220ms] ease-in-out ${collapsed ? "w-14" : "w-60"}`} />
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
        "relative flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] transition-colors cursor-pointer " +
        (active
          ? "bg-white/[0.07] font-medium text-white"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100")
      }
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-500" />}
      <span className={"shrink-0 " + (active ? "text-brand-400" : "")}>{icon}</span>
      {!collapsed && <span>{children}</span>}
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
          "relative flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-[13px] transition-colors cursor-pointer " +
          (active
            ? "bg-white/[0.07] font-medium text-white"
            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100")
        }
      >
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-500" />}
        <span className={"shrink-0 " + (active ? "text-brand-400" : "")}>{group.icon}</span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{group.label}</span>
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
                    "relative flex items-center gap-3 rounded-md py-1.5 pl-8 pr-2.5 text-[13px] transition-colors cursor-pointer " +
                    (child.match(pathname)
                      ? "bg-white/[0.07] font-medium text-white"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100")
                  }
                >
                  {child.match(pathname) && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-500" />}
                  <span className={"shrink-0 " + (child.match(pathname) ? "text-brand-400" : "")}>{child.icon}</span>
                  <span>{child.label}</span>
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
          "relative flex w-full items-center gap-3 rounded-md py-1.5 pl-8 pr-2.5 text-[13px] transition-colors cursor-pointer " +
          (active
            ? "bg-white/[0.07] font-medium text-white"
            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100")
        }
      >
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-500" />}
        <span className={"shrink-0 " + (active ? "text-brand-400" : "")}>{group.icon}</span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{group.label}</span>
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
                    ? "bg-white/[0.07] font-medium text-white"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100")
                }
              >
                {child.match(pathname) && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-500" />}
                <span className={"shrink-0 " + (child.match(pathname) ? "text-brand-400" : "")}>{child.icon}</span>
                <span>{child.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

