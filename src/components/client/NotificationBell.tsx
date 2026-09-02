"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type Notification = { id: string; type: "contravention" | "courrier" | "echeance"; label: string; date: string; href: string };

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/client/notifications")
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((data) => { if (!cancelled) setItems(data.notifications ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
        className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        title="Notifications"
      >
        <Bell size={18} />
        {items.length > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-80 rounded-xl border border-slate-200 bg-white shadow-popover">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Rien de nouveau pour le moment.</p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-slate-50 px-4 py-3 text-sm text-slate-700 transition last:border-0 hover:bg-slate-50"
                >
                  {n.label}
                  <div className="mt-0.5 text-xs text-slate-400">{new Date(n.date).toLocaleDateString("fr-FR")}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
