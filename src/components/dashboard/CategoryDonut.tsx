export type CategorySlice = { label: string; value: number; color: string }; // color: any valid CSS color

/** Donut built with a CSS conic-gradient (no charting library installed/needed for a single static ring). */
export function CategoryDonut({ segments, total }: { segments: CategorySlice[]; total: number }) {
  const withValue = segments.filter((s) => s.value > 0);
  let cursor = 0;
  const stops: string[] = [];
  for (const s of withValue) {
    const pct = total > 0 ? (s.value / total) * 100 : 0;
    const start = cursor;
    const end = cursor + pct;
    stops.push(`${s.color} ${start}% ${end}%`);
    cursor = end;
  }
  const gradient = stops.length > 0 ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(#e2e8f0 0% 100%)";

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-[104px] w-[104px] shrink-0 rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-[14px] grid place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]">
          <div className="text-center">
            <div className="text-[22px] font-extrabold leading-none text-slate-900">{total}</div>
            <div className="mt-1 text-[10px] text-slate-400">document{total > 1 ? "s" : ""}</div>
          </div>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-x-4 gap-y-2">
        {withValue.length === 0 ? (
          <p className="text-center text-[12px] text-slate-400">Aucun document pour le moment.</p>
        ) : (
          withValue.map((s) => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
            return (
              <div key={s.label} className="flex items-center gap-2 text-[12px] leading-snug">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="min-w-0 flex-1 truncate text-slate-600">{s.label}</span>
                <span className="shrink-0 whitespace-nowrap font-semibold text-slate-900">
                  {s.value} <span className="font-normal text-slate-400">({pct}%)</span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
