import Link from "next/link";
import { ArrowRight, CheckCircle2, ListChecks, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PriorityItem = {
  icon: LucideIcon;
  tone: "info" | "warning" | "danger";
  title: string;
  subtitle: string;
  /** Société concernée par le dossier — affichée explicitement (jamais fusionnée silencieusement). */
  societe?: string;
  /** Action concrète attendue de l'utilisateur (ex. "Identifier le conducteur"). */
  action?: string;
  meta?: string;
  href: string;
};

const toneDot: Record<PriorityItem["tone"], string> = {
  info: "bg-blue-500",
  warning: "bg-amber-500",
  danger: "bg-coral-500",
};
const toneChip: Record<PriorityItem["tone"], string> = {
  info: "bg-blue-50 text-blue-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-coral-50 text-coral-600",
};
const toneMeta: Record<PriorityItem["tone"], string> = {
  info: "text-blue-600",
  warning: "text-amber-600",
  danger: "text-coral-600",
};

/** Top-of-dashboard "needs attention" block, fed with items from any module regardless of origin.
 * A colored dot (rouge=urgent / orange=à traiter / bleu=information) marks each row's severity. */
export function PriorityPanel({ items, title = "À traiter", className }: { items: PriorityItem[]; title?: string; className?: string }) {
  const hasUrgent = items.length > 0;
  return (
    <div className={cn("flex h-full flex-col overflow-hidden rounded-2xl border shadow-card", hasUrgent ? "border-coral-200/60 bg-coral-50/30" : "border-slate-200/70 bg-surface-raised", className)}>
      <div className={cn("flex items-center justify-between gap-2 border-b px-5 py-3.5", hasUrgent ? "border-coral-100 bg-coral-50/50" : "border-slate-100 bg-slate-50/60")}>
        <div className="flex items-center gap-2">
          <ListChecks size={15} className="text-brand-600" />
          <h2 className="text-[14px] font-bold text-slate-900">{title}</h2>
        </div>
        {items.length > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1.5 text-[11px] font-bold text-white">{items.length}</span>
        )}
      </div>
      <div className="flex-1 px-2 py-1.5">
        {items.length === 0 ? (
          <div className="m-2.5 flex items-center gap-3 rounded-xl bg-emerald-50/70 px-3.5 py-3">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <div>
              <div className="text-[13px] font-semibold text-emerald-800">Tout est à jour</div>
              <div className="text-xs text-emerald-700/80">Aucune action urgente pour le moment.</div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="group relative flex items-center gap-3 py-2.5 pl-3 pr-1 transition-colors duration-150 hover:bg-blue-50/50"
              >
                <span className={cn("absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full", toneDot[item.tone])} />
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", toneChip[item.tone])}>
                  <item.icon size={16} strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-slate-800">
                    {item.title}
                    {item.societe && <span className="truncate text-[11px] font-normal text-slate-400">— {item.societe}</span>}
                  </span>
                  <span className="block truncate text-[12px] text-slate-500">{item.subtitle}</span>
                  {item.action && (
                    <span className="mt-0.5 block truncate text-[11.5px] font-medium text-brand-600">→ {item.action}</span>
                  )}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {item.meta && (
                    <span className={cn("whitespace-nowrap text-[11px] font-semibold", toneMeta[item.tone])}>{item.meta}</span>
                  )}
                  <span className="flex items-center gap-1 text-[11.5px] font-medium text-slate-400 transition-colors group-hover:text-brand-600">
                    Ouvrir <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
