import { Clock, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { cn } from "@/lib/utils";

export type ActivityTone = "brand" | "success" | "warning" | "violet" | "neutral";

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

/** Reverse-chronological feed mixing activity from any module (scans, paiements, courriers...). */
export function ActivityList({ items }: { items: ActivityEntry[] }) {
  if (items.length === 0) {
    return <EmptyState icon={Clock} title="Aucune activité récente" description="Les événements de toute l'application apparaîtront ici." />;
  }
  return (
    <div className="space-y-4">
      {items.map((entry, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", toneClasses[entry.tone ?? "neutral"])}>
            <entry.icon size={15} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-slate-700">{entry.label}</div>
            <div className="truncate text-[11.5px] text-slate-400">{entry.meta}</div>
          </div>
          <div className="shrink-0 text-[11px] text-slate-400">
            {entry.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
          </div>
        </div>
      ))}
    </div>
  );
}
