import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** Card-style section wrapper used across the dashboard so every block shares the same header/body layout. */
export function DashboardSection({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200/80 bg-white shadow-card ${className ?? ""}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          {Icon && <Icon size={15} className="text-brand-600" />}
          {title}
        </h2>
        {action && (
          <Link href={action.href} className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline">
            {action.label} →
          </Link>
        )}
      </div>
      <div className="border-t border-slate-100">{children}</div>
    </div>
  );
}

