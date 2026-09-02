import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Shared "nothing here yet" state — replaces plain text like "Aucun document" or "sera ajoutée
 * prochainement" everywhere in the app. Keep usage consistent: icon + title + one-line
 * explanation + optional single action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string } | { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-14 text-center", className)}>
      <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <p className="mt-1 text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && (
        "href" in action ? (
          <Link href={action.href} className="mt-2 btn-primary">
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="mt-2 btn-primary">
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
