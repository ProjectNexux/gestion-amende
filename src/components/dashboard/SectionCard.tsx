import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const tintClasses = {
  raised: "bg-surface-raised",
  muted: "bg-surface-muted",
  accent: "bg-surface-accent",
} as const;

/** Bigger, sparser section wrapper for the redesigned dashboard (replaces the compact DashboardSection for this page). */
export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  tint = "raised",
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Surface level — "raised" (white, default) keeps a section neutral, "muted"/"accent" give it a
   * very light tint so not every card on the page reads as the exact same white rectangle. */
  tint?: keyof typeof tintClasses;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/70 shadow-card", tintClasses[tint], className)}>
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-[18px]">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
            {Icon && <Icon size={16} className="text-blue-600" />}
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[12.5px] text-slate-400">{description}</p>}
        </div>
        {action && (
          <Link href={action.href} className="shrink-0 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700">
            {action.label} →
          </Link>
        )}
      </div>
      <div className={cn("p-5 pt-3", bodyClassName)}>{children}</div>
    </div>
  );
}
