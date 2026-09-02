"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, ChevronDown, LogOut, Loader2, ScanLine } from "lucide-react";
import { NewDocumentMenu } from "@/components/NewDocumentMenu";
import type { SearchResultGroup } from "@/app/api/search/route";

// Small, purely presentational lookup used to auto-derive the breadcrumb from the current route —
// kept in sync with the sidebar's own routes but intentionally decoupled (display strings only,
// no navigation logic lives here).
const BREADCRUMBS: { prefix: string; section: string; page: string }[] = [
  { prefix: "/contraventions/scan", section: "Gestion", page: "Scanner un document" },
  { prefix: "/contraventions", section: "Gestion", page: "Contraventions" },
  { prefix: "/guide-infractions", section: "Gestion", page: "Guide des infractions" },
  { prefix: "/vehicules", section: "Gestion", page: "Véhicules" },
  { prefix: "/conducteurs", section: "Gestion", page: "Conducteurs" },
  { prefix: "/courriers/mise-en-demeure", section: "Courriers", page: "Mise en demeure" },
  { prefix: "/courriers/urssaf", section: "Courriers", page: "URSSAF" },
  { prefix: "/courriers/retards-paiement", section: "Courriers", page: "Retards de paiement" },
  { prefix: "/courriers/sinistres", section: "Courriers", page: "Sinistres" },
  { prefix: "/courriers/certificats-immatriculation", section: "Courriers", page: "Certificats d'immatriculation" },
  { prefix: "/courriers/pub", section: "Courriers", page: "Pub" },
  { prefix: "/courriers/a-transmettre", section: "Courriers", page: "À transmettre" },
  { prefix: "/courriers", section: "Courriers", page: "Tous les courriers" },
  { prefix: "/comptabilite/factures", section: "Comptabilité", page: "Factures" },
  { prefix: "/comptabilite/impots", section: "Comptabilité", page: "Impôts" },
  { prefix: "/admin", section: "Administration", page: "Sociétés" },
];

function resolveBreadcrumb(pathname: string): { section: string; page: string } {
  if (pathname === "/") return { section: "Tableau de bord", page: "Vue d'ensemble" };
  const match = BREADCRUMBS.filter((b) => pathname.startsWith(b.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match ?? { section: "Gestion", page: "" };
}

export function Topbar({ societe, admin }: { societe: string; admin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { section, page } = resolveBreadcrumb(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // Debounced global search — queries /api/search, which itself stays tenant-scoped server-side.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setGroups([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data) => setGroups(data.groups ?? []))
        .catch(() => setGroups([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!searchOpen) return;
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [searchOpen]);

  const hasQuery = query.trim().length >= 2;
  const hasResults = groups.some((g) => g.items.length > 0);

  function goTo(href: string) {
    setSearchOpen(false);
    setQuery("");
    setGroups([]);
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-20 flex h-[68px] shrink-0 items-center gap-3 border-b border-slate-200/80 bg-[#FBFBFE]/90 px-4 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur-md sm:px-6">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">{section}</div>
        <div className="truncate text-[15px] font-bold leading-tight text-slate-900">{page}</div>
      </div>

      <div ref={searchRef} className="relative hidden lg:block">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSearchOpen(false);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Enter") {
              const first = groups.find((g) => g.items.length > 0)?.items[0];
              if (first) goTo(first.href);
            }
          }}
          placeholder="Rechercher…"
          className="w-48 rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 transition-all duration-150 focus:w-64 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 xl:w-64 xl:focus:w-72"
        />
        {searchOpen && hasQuery && (
          <div className="absolute right-0 top-full z-40 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-slate-200/80 bg-white py-1.5 shadow-popover animate-[modalIn_150ms_ease-out]">
            {searching ? (
              <div className="flex items-center gap-2 px-3.5 py-3 text-[13px] text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Recherche…
              </div>
            ) : hasResults ? (
              groups.map((group) => (
                <div key={group.category} className="py-1">
                  <div className="px-3.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{group.category}</div>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => goTo(item.href)}
                      className="flex w-full flex-col items-start px-3.5 py-2 text-left transition-colors hover:bg-slate-50"
                    >
                      <span className="truncate text-[13px] font-medium text-slate-800">{item.label}</span>
                      {item.sublabel && <span className="truncate text-[11.5px] text-slate-400">{item.sublabel}</span>}
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div className="px-3.5 py-3 text-[13px] text-slate-400">Aucun résultat pour « {query.trim()} ».</div>
            )}
          </div>
        )}
      </div>

      <Link
        href="/"
        title="Notifications"
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell size={17} />
      </Link>

      <div className="flex items-center gap-2">
        <Link href="/contraventions/scan" className="btn-secondary">
          <ScanLine size={16} />
          Scanner un document
        </Link>
        <NewDocumentMenu />
      </div>

      <div ref={ref} className="relative border-l border-slate-200 pl-3.5">
        <button type="button" onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-lg py-1 transition-colors duration-150 hover:opacity-80">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(37,99,235,0.35)]">
            {societe.charAt(0).toUpperCase()}
          </div>
          <div className="hidden text-left leading-tight md:block">
            <div className="max-w-[120px] truncate text-[12.5px] font-medium text-slate-800">{societe}</div>
            <div className="text-[11px] text-slate-400">{admin ? "Administrateur" : "Membre"}</div>
          </div>
          <ChevronDown size={14} className={`hidden text-slate-400 transition-transform duration-150 md:block ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1.5 shadow-popover animate-[modalIn_150ms_ease-out]">
            <div className="border-b border-slate-100 px-3.5 py-2">
              <div className="truncate text-[13px] font-medium text-slate-800">{societe}</div>
              <div className="text-[11px] text-slate-400">{admin ? "Administrateur" : "Membre"}</div>
            </div>
            <form action="/api/logout" method="POST">
              <button className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] text-slate-700 transition-colors hover:bg-slate-50">
                <LogOut size={15} className="text-slate-400" />
                Déconnexion
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
