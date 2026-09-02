import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type OverviewTone = "brand" | "warning" | "danger" | "violet";

const toneCell: Record<OverviewTone, string> = {
  brand: "bg-blue-50/70",
  warning: "bg-amber-50/70",
  danger: "bg-coral-50/70",
  violet: "bg-violet-50/60",
};

const toneChip: Record<OverviewTone, string> = {
  brand: "bg-blue-100/80 text-blue-600",
  warning: "bg-amber-100/70 text-amber-600",
  danger: "bg-coral-100/70 text-coral-600",
  violet: "bg-violet-100/70 text-violet-600",
};

const toneHint: Record<OverviewTone, string> = {
  brand: "text-blue-600",
  warning: "text-amber-600",
  danger: "text-coral-600",
  violet: "text-violet-600",
};

export type OverviewStat = {
  icon: LucideIcon;
  tone: OverviewTone;
  value: React.ReactNode;
  label: string;
  hint?: string;
};

/**
 * The dashboard's "Vue d'ensemble" hero block — one strong, graphic surface instead of four
 * identical white KPI rectangles. Each stat now gets its own very-pale tinted background matching
 * its meaning (bleu=documents, ambre=à traiter, corail=urgents, violet=montant), so the block reads
 * as four distinct zones at a glance instead of four white columns separated by hairlines only.
 */
export function OverviewBlock({ stats, className }: { stats: OverviewStat[]; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-slate-200/70 bg-surface-raised shadow-card", className)}>
      <div className="flex items-center justify-between px-6 pb-2 pt-5">
        <h2 className="text-[15px] font-bold text-slate-900">Vue d&apos;ensemble</h2>
        <span className="text-[11px] font-medium text-slate-400">Aujourd&apos;hui</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-3 pb-3 sm:grid-cols-4">
        {stats.map((s, i) => (
          <div key={i} className={cn("rounded-xl px-4 py-4", toneCell[s.tone])}>
            <div className={cn("grid h-9 w-9 place-items-center rounded-lg", toneChip[s.tone])}>
              <s.icon size={17} strokeWidth={1.9} />
            </div>
            <div className="mt-3 text-[26px] font-extrabold leading-none tracking-tight text-slate-900">{s.value}</div>
            <div className="mt-1.5 text-[13px] font-medium text-slate-600">{s.label}</div>
            {s.hint && <div className={cn("mt-1.5 text-[11.5px] font-semibold", toneHint[s.tone])}>{s.hint}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
