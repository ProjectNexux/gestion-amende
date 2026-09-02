import { Clock, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { cn } from "@/lib/utils";

export type ActivityTone = "brand" | "success" | "warning" | "violet" | "neutral";

const dotClasses: Record<ActivityTone, string> = {
  brand: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  violet: "bg-violet-500",
  neutral: "bg-slate-400",
};

const toneClasses: Record<ActivityTone, string> = {
  brand: "bg-blue-50 text-blue-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  neutral: "bg-slate-100 text-slate-500",
};

export type ActivityEntry = {
  icon: LucideIcon;
  label: string;
  meta: string;
  date: Date;
  tone?: ActivityTone;
};

/** Presentational-only relative time label ("il y a 2h", "hier", "il y a 5j") — purely a display
 * format derived from the real timestamp already passed in, no new data. */
function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffDays = Math.round(diffH / 24);
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/** Reverse-chronological timeline mixing activity from any module (scans, paiements, courriers...). */
export function ActivityList({ items }: { items: ActivityEntry[] }) {
  if (items.length === 0) {
    return <EmptyState icon={Clock} title="Aucune activité récente" description="Les événements de toute l'application apparaîtront ici." />;
  }
  return (
    <div className="relative">
      <div className="absolute bottom-2 left-[15px] top-2 w-px bg-slate-100" />
      <div className="space-y-4">
        {items.map((entry, i) => (
          <div key={i} className="relative flex items-start gap-3">
            <div className={cn("relative z-10 mt-0.5 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full ring-4 ring-white", toneClasses[entry.tone ?? "neutral"])}>
              <entry.icon size={13} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClasses[entry.tone ?? "neutral"])} />
                {entry.label}
              </div>
              <div className="truncate pl-3 text-[12px] text-slate-500">{entry.meta}</div>
            </div>
            <div className="shrink-0 whitespace-nowrap pt-1 text-[11px] text-slate-400">{relativeTime(entry.date)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
