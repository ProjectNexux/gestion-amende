import Link from "next/link";
import { cn } from "@/lib/utils";

export type StatTone = "brand" | "info" | "warning" | "danger" | "success" | "neutral";

const iconToneClasses: Record<StatTone, string> = {
  brand: "bg-brand-50 text-brand-600",
  info: "bg-blue-50 text-blue-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
  success: "bg-emerald-50 text-emerald-600",
  neutral: "bg-slate-100 text-slate-600",
};

const hoverBorderClasses: Record<StatTone, string> = {
  brand: "hover:border-brand-200",
  info: "hover:border-blue-200",
  warning: "hover:border-amber-200",
  danger: "hover:border-rose-200",
  success: "hover:border-emerald-200",
  neutral: "hover:border-slate-300",
};

export function StatCard({
  href,
  icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: StatTone;
}) {
  const content = (
    <>
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", iconToneClasses[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-none text-slate-900">{value}</div>
        <div className="mt-1 truncate text-xs font-medium text-slate-500">{label}</div>
        {hint && <div className="mt-0.5 truncate text-[10.5px] text-slate-400">{hint}</div>}
      </div>
    </>
  );

  const classes = cn(
    "group flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-card transition-colors",
    href && hoverBorderClasses[tone]
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return <div className={classes}>{content}</div>;
}
