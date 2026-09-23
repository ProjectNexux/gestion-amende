import { fmtDateTime } from "@/lib/utils";
import { humanizeAction } from "../shared";

type Audit = { id: string; action: string; details: string | null; acteur: string | null; createdAt: Date };

export function ActivityTab({ audits }: { audits: Audit[] }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-card">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{audits.length} événement(s)</h2>
      {audits.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun événement pour cette société.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {audits.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />
              <div>
                <div className="font-medium text-slate-800">{humanizeAction(a.action)}</div>
                {a.details && <div className="text-xs text-slate-500">{a.details}</div>}
                <div className="text-[11px] text-slate-400">{a.acteur ? `${a.acteur} — ` : ""}{fmtDateTime(a.createdAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
