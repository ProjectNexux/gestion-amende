// Plain config module (not a special Next.js file) so it can export arbitrary values safely,
// shared between the server layout and the client-side nav component.
export type ClientNavItem = { href: string; label: string; icon: string };
export type ClientNavSection = { label?: string; items: ClientNavItem[] };

// Icon components are resolved client-side (see ClientSidebar.tsx) from this string key so this
// config can stay a plain, server-renderable data structure.
export const CLIENT_NAV_SECTIONS: ClientNavSection[] = [
  { items: [{ href: "/client", label: "Tableau de bord", icon: "LayoutDashboard" }] },
  {
    label: "Documents",
    items: [
      { href: "/client/courriers", label: "Documents reçus", icon: "Mail" },
      { href: "/client/contraventions", label: "Contraventions", icon: "FileWarning" },
      { href: "/client/documents-envoyes", label: "Documents envoyés", icon: "Send" },
    ],
  },
  {
    label: "Assistance",
    // Contact déjà configuré dans l'app (mailto) — pas de fausse messagerie tant qu'aucune
    // vraie interface de messagerie n'existe.
    items: [{ href: "mailto:contact@gestion-amendes.local", label: "Assistance", icon: "LifeBuoy" }],
  },
  {
    label: "Mon espace",
    items: [{ href: "/client/profil", label: "Mon compte", icon: "UserCircle" }],
  },
];
