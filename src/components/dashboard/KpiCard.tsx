import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "brand" | "success" | "warning" | "danger" | "violet";

const iconToneClasses: Record<KpiTone, string> = {
  brand: "bg-blue-50 text-blue-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
};

const hintToneClasses: Record<KpiTone, string> = {
  brand: "text-blue-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-rose-600",
  violet: "text-violet-600",
};

/** Large "hero" KPI card for the top of the dashboard — bigger and sparser than the compact StatCard/StatItem. */
export function KpiCard({
  icon: Icon,
  tone = "brand",
  label,
  value,
  hint,
  href,
}: {
  icon: LucideIcon;
  tone?: KpiTone;
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", iconToneClasses[tone])}>
        <Icon size={20} strokeWidth={1.9} />
      </div>
      <div className="mt-3.5 text-[28px] font-bold leading-none text-slate-900">{value}</div>
      <div className="mt-1.5 text-sm font-medium text-slate-500">{label}</div>
      {hint && <div className={cn("mt-2.5 text-xs font-semibold", hintToneClasses[tone])}>{hint}</div>}
    </>
  );

  const classes = "block rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover";

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return <div className={classes}>{content}</div>;
}
