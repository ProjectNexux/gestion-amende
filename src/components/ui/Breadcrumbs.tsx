import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

/** Fil d'Ariane cohérent pour les pages de détail — remplace les liens "Retour" ad-hoc dispersés
 * par une navigation hiérarchique uniforme. Le dernier élément est la page courante (non cliquable). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-[13px] text-slate-500">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {item.href && !isLast ? (
              <Link href={item.href} className="rounded px-0.5 transition-colors hover:text-slate-800 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-slate-700" : ""}>{item.label}</span>
            )}
            {!isLast && <ChevronRight size={13} className="text-slate-300" />}
          </span>
        );
      })}
    </nav>
  );
}
