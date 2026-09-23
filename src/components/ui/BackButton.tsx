"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Back navigation that actually returns to the exact previous list state (filter, tab, search,
 * page, scroll position) instead of a hardcoded link that always resets to the list's default
 * view. Falls back to `fallbackHref` only when there's no in-app history to go back to (e.g. the
 * page was opened directly from a bookmark/shared link in a fresh tab).
 */
export function BackButton({ fallbackHref, label = "Retour", className }: { fallbackHref: string; label?: string; className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className={className ?? "inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-700"}
    >
      <ArrowLeft size={15} /> {label}
    </button>
  );
}
