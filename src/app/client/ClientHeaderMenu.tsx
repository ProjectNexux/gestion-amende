"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, UserCircle, LogOut } from "lucide-react";

function initials(societe: string): string {
  const words = societe.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function ClientHeaderMenu({ societe }: { societe: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-sm transition hover:bg-slate-50"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {initials(societe)}
        </span>
        <span className="min-w-0 text-left">
          <span className="block truncate text-sm font-medium leading-tight text-slate-800">{societe}</span>
          <span className="block text-[11px] leading-tight text-slate-400">Compte client</span>
        </span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-popover">
          <Link
            href="/client/profil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <UserCircle size={16} className="text-slate-400" /> Mon profil
          </Link>
          <form action="/api/logout" method="POST">
            <button className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50">
              <LogOut size={16} /> Déconnexion
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
