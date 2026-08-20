import Link from "next/link";
import { ArrowRight, CheckCircle2, ListChecks, type LucideIcon } from "lucide-react";

export type PriorityItem = {
  icon: LucideIcon;
  tone: "warning" | "danger";
  text: string;
  href: string;
};

/** Top-of-dashboard "needs attention" block, fed with items from any module regardless of origin. */
export function PriorityPanel({ items }: { items: PriorityItem[] }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-card">
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <ListChecks size={15} className="text-brand-600" />
        <h2 className="text-[13px] font-semibold text-slate-900">À traiter</h2>
      </div>
      <div className="px-4 pb-3.5 pt-2">
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50/70 px-3.5 py-2.5">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <div>
              <div className="text-[13px] font-semibold text-emerald-800">Tout est à jour</div>
              <div className="text-xs text-emerald-700/80">Aucune action urgente pour le moment.</div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="group -mx-1.5 flex items-center justify-between gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5 text-[13px] text-slate-700">
                  <item.icon size={15} className={item.tone === "danger" ? "text-rose-500" : "text-amber-500"} />
                  {item.text}
                </span>
                <ArrowRight size={13} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
