import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Bigger, sparser section wrapper for the redesigned dashboard (replaces the compact DashboardSection for this page). */
export function SectionCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: LucideIcon;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/70 bg-white shadow-card", className)}>
      <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-[18px]">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          {Icon && <Icon size={16} className="text-blue-600" />}
          {title}
        </h2>
        {action && (
          <Link href={action.href} className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
            {action.label} →
          </Link>
        )}
      </div>
      <div className={cn("p-5 pt-3", bodyClassName)}>{children}</div>
    </div>
  );
}
