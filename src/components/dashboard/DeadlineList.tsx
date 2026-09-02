import Link from "next/link";
import { Inbox, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { cn } from "@/lib/utils";

export type DeadlineTone = "brand" | "warning" | "danger";

const iconToneClasses: Record<DeadlineTone, string> = {
  brand: "bg-blue-50 text-blue-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-coral-50 text-coral-600",
};

const textToneClasses: Record<DeadlineTone, string> = {
  brand: "text-blue-600",
  warning: "text-amber-600",
  danger: "text-coral-600",
};

export type DeadlineItem = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  date: Date;
  href: string;
};

/** Days-remaining label + urgency tone, derived straight from the real date — never invented. */
function urgency(date: Date): { text: string; tone: DeadlineTone } {
  const diffDays = Math.round((date.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays < 0) return { text: `En retard de ${Math.abs(diffDays)} j`, tone: "danger" };
  if (diffDays === 0) return { text: "Aujourd'hui", tone: "danger" };
  if (diffDays <= 3) return { text: `Dans ${diffDays} jour${diffDays > 1 ? "s" : ""}`, tone: "danger" };
  if (diffDays <= 10) return { text: `Dans ${diffDays} jours`, tone: "warning" };
  return { text: `Dans ${diffDays} jours`, tone: "brand" };
}

/** Chronological list mixing deadlines from any module (contraventions, mises en demeure, retards de paiement...). */
export function DeadlineList({ items }: { items: DeadlineItem[] }) {
  if (items.length === 0) {
    return <EmptyState icon={Inbox} title="Aucune échéance à venir" description="Les prochaines échéances de tous les modules apparaîtront ici." />;
  }
  return (
    <div className="divide-y divide-slate-100">
      {items.map((item, i) => {
        const { text, tone } = urgency(new Date(item.date));
        return (
          <Link key={i} href={item.href} className="flex items-center gap-3 py-3 transition-colors hover:bg-slate-50">
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", iconToneClasses[tone])}>
              <item.icon size={16} strokeWidth={1.9} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-slate-800">{item.title}</span>
              <span className="block truncate text-[12px] text-slate-500">{item.subtitle}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[11.5px] text-slate-400">
                {item.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              <span className={cn("block text-[11.5px] font-semibold", textToneClasses[tone])}>{text}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
