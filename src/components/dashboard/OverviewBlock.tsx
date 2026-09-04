import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type OverviewTone = "brand" | "warning" | "danger" | "violet";

const toneCell: Record<OverviewTone, string> = {
  brand: "bg-white",
  warning: "bg-white",
  danger: "bg-white",
  violet: "bg-white",
};

const toneChip: Record<OverviewTone, string> = {
  brand: "bg-brand-50 text-brand-700",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-500",
  violet: "bg-violet-50 text-violet-700",
};

const toneHint: Record<OverviewTone, string> = {
  brand: "text-brand-700",
  warning: "text-warning-600",
  danger: "text-danger-500",
  violet: "text-violet-700",
};

export type OverviewStat = {
  icon: LucideIcon;
  tone: OverviewTone;
  value: React.ReactNode;
  label: string;
  hint?: string;
  href?: string;
};

/**
 * The dashboard's "Vue d'ensemble" hero block — one strong, graphic surface instead of four
 * identical white KPI rectangles. Each stat now gets its own very-pale tinted background matching
 * its meaning (bleu=documents, ambre=à traiter, corail=urgents, violet=montant), so the block reads
 * as four distinct zones at a glance instead of four white columns separated by hairlines only.
 */
export function OverviewBlock({ stats, className }: { stats: OverviewStat[]; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-card", className)}>
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <h2 className="text-[15px] font-bold tracking-[-0.02em] text-slate-900">Vue d&apos;ensemble</h2>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Aujourd&apos;hui</span>
      </div>
      <div className="grid grid-cols-2 gap-3 px-3 pb-3 sm:grid-cols-4">
        {stats.map((s, i) => {
          const cellClass = cn(
            "rounded-[14px] border border-slate-200 px-4 py-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover",
            toneCell[s.tone],
            s.href && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          );
          const content = (
            <>
              <div className={cn("grid h-9 w-9 place-items-center rounded-lg", toneChip[s.tone])}>
                <s.icon size={17} strokeWidth={1.9} />
              </div>
              <div className="mt-3 text-[26px] font-extrabold leading-none tracking-tight text-slate-900">{s.value}</div>
              <div className="mt-1.5 text-[13px] font-medium text-slate-600">{s.label}</div>
              {s.hint && <div className={cn("mt-1.5 text-[11.5px] font-semibold", toneHint[s.tone])}>{s.hint}</div>}
            </>
          );
          return s.href ? (
            <Link key={i} href={s.href} className={cn(cellClass, "block")}>
              {content}
            </Link>
          ) : (
            <div key={i} className={cellClass}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
