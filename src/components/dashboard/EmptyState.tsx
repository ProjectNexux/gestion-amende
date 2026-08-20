import type { LucideIcon } from "lucide-react";

/** Generic empty-state block for dashboard sections that have no real data to show yet. */
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
      <Icon size={20} className="text-slate-300" />
      <div className="text-[13px] font-medium text-slate-600">{title}</div>
      {description && <div className="max-w-xs text-[11.5px] text-slate-400">{description}</div>}
    </div>
  );
}
