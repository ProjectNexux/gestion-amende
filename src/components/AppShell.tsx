"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

/**
 * Application shell (refonte "Nouvelle interface documentaire", 2026-09-24).
 *
 * Owns the two pieces of chrome state shared by the sidebar and topbar:
 *  - `collapsed`  : desktop rail vs full sidebar, persisted in localStorage ("sb-collapsed") so the
 *                   user's choice survives reloads. Open by default on large screens.
 *  - `mobileOpen` : off-canvas drawer state on small screens, opened from the topbar hamburger and
 *                   closed on navigation / backdrop tap.
 *
 * The fixed sidebar never shifts the page: a spacer reserves its width on desktop and animates
 * smoothly between the rail (76px) and full (264px) widths.
 */
export function AppShell({
  societe,
  admin,
  organizationName,
  children,
}: {
  societe: string;
  admin: boolean;
  organizationName?: string | null;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem("sb-collapsed") === "1");
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("sb-collapsed", next ? "1" : "0");
      } catch {
        /* localStorage may be unavailable (private mode) — non-critical */
      }
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        societe={societe}
        admin={admin}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      {/* Desktop spacer: reserves the fixed sidebar's width so content never sits underneath it. */}
      <div
        className={`hidden shrink-0 transition-[width] duration-200 ease-in-out lg:block ${
          collapsed ? "w-[76px]" : "w-[264px]"
        }`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          societe={societe}
          admin={admin}
          organizationName={organizationName}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
