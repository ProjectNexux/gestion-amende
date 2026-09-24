"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HelpCircle, ArrowRight } from "lucide-react";

/**
 * Small "?" icon button used on important pages — opens a short, plain-language explanation of
 * what the page/action does, plus a link into the matching step-by-step guide. Never a chatbot,
 * never fetches anything: pure static text passed in as props.
 */
export function HelpHint({ text, guideHref, guideLabel = "Comment ça fonctionne ?" }: { text: string; guideHref: string; guideLabel?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Aide sur cette page"
        aria-expanded={open}
        className="grid h-6 w-6 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
      >
        <HelpCircle size={16} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-popover animate-[modalIn_150ms_ease-out] sm:left-auto sm:right-0">
          <p className="text-[13px] leading-relaxed text-slate-600">{text}</p>
          <Link href={guideHref} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
            {guideLabel} <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
