"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared modal shell (blurred overlay, fine border, clear header, hierarchised footer actions) —
 * reuse this for every new modal/panel so they all share the same premium look and feel.
 *
 * Rendered via a portal into `document.body`: a `position: fixed` element is otherwise re-anchored
 * to the nearest ancestor with a `transform`/`filter`/`backdrop-filter`/`perspective`/`will-change`
 * (e.g. Topbar's `header` uses `backdrop-blur-sm`), which silently shrinks the overlay down to that
 * ancestor's own box instead of the full viewport — the actual cause of modals rendered from inside
 * the Topbar appearing clipped/offset. Portalling to `<body>` sidesteps that entirely.
 */
export function Modal({
  open,
  onClose,
  onBack,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** When provided, shows a "← Retour" affordance before the title instead of only a close button. */
  onBack?: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-popover animate-[modalIn_150ms_ease-out]",
          className
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Retour"
                className="-ml-1.5 flex shrink-0 items-center gap-1 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <ArrowLeft size={16} />
                <span className="text-xs font-medium">Retour</span>
              </button>
            )}
            <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
