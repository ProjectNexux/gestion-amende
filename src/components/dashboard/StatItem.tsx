export type StatTone = "info" | "warning" | "danger" | "success" | "neutral";

const toneClasses: Record<StatTone, string> = {
  info: "text-blue-600",
  warning: "text-amber-600",
  danger: "text-rose-600",
  success: "text-emerald-600",
  neutral: "text-slate-900",
};

/** Compact value/label pair used inside dashboard sections to avoid repeating full StatCards everywhere. */
export function StatItem({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: StatTone;
}) {
  return (
    <div className="rounded-lg bg-slate-50/60 px-3 py-2">
      <div className={`text-base font-bold leading-none ${toneClasses[tone]}`}>{value}</div>
      <div className="mt-1 truncate text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  );
}
