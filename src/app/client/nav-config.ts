// Plain config module (not a special Next.js file) so it can export arbitrary values safely,
// shared between the server layout and the client-side nav component.
export type ClientNavItem = { href: string; label: string; icon: string };
export type ClientNavSection = { label?: string; items: ClientNavItem[] };

// Icon components are resolved client-side (see ClientSidebar.tsx) from this string key so this
// config can stay a plain, server-renderable data structure.
// Refonte espace client (2026-09-23): nouvelle arborescence demandée — Tableau de bord / Mes
// documents / Mes contraventions / Documents envoyés / Favoris / Assistance et guide / Mon profil.
// Aucun outil réservé à l'administrateur n'apparaît jamais ici (routes /admin/* volontairement
// absentes, en plus du blocage serveur déjà appliqué par middleware.ts).
export const CLIENT_NAV_SECTIONS: ClientNavSection[] = [
  { items: [{ href: "/client", label: "Tableau de bord", icon: "LayoutDashboard" }] },
  {
    label: "Documents",
    items: [
      { href: "/client/courriers", label: "Mes documents", icon: "FolderOpen" },
      { href: "/client/contraventions", label: "Mes contraventions", icon: "FileWarning" },
      { href: "/client/documents-envoyes", label: "Documents envoyés", icon: "Send" },
      { href: "/client/favoris", label: "Favoris", icon: "Star" },
    ],
  },
  {
    label: "Aide",
    items: [{ href: "/client/aide", label: "Assistance et guide", icon: "LifeBuoy" }],
  },
  {
    label: "Mon espace",
    items: [{ href: "/client/profil", label: "Mon profil", icon: "UserCircle" }],
  },
];
