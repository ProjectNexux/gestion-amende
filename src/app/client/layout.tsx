import { redirect } from "next/navigation";
import { getSociete } from "@/lib/auth";
import { NotificationBell } from "@/components/client/NotificationBell";
import { ClientHeaderMenu } from "./ClientHeaderMenu";
import { ClientSidebar } from "./ClientSidebar";
import { CLIENT_NAV_SECTIONS } from "./nav-config";

export const dynamic = "force-dynamic";

/**
 * Espace client (2026-08-24, refonte premium 2026-08-25, sidebar hover 2026-08-25) — deliberately
 * separate chrome from the admin app. Root layout.tsx already skips its own Sidebar/Topbar for
 * CLIENT sessions, so this is the entire nav a société customer ever sees. `ClientSidebar` shares
 * the exact same hover-expand/collapse behavior as the admin `Sidebar.tsx` (via
 * `useSidebarHover()`), fixed/overlaid so it never shifts this layout's content. NOTE: the design
 * reference shared for the visual pass used violet/indigo accents — kept to brand blue only
 * instead, per this repo's standing "no purple/violet" convention (see
 * /memories/repo/project-notes.md).
 */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const societe = await getSociete();
  if (!societe) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[#F7F8FC]">
      <ClientSidebar societe={societe} sections={CLIENT_NAV_SECTIONS} />

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Espace client</h1>
            <p className="text-xs text-slate-500">{societe}</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ClientHeaderMenu societe={societe} />
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
