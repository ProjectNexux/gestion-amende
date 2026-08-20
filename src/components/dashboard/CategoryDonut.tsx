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
      <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-[12px] grid place-items-center rounded-full bg-white">
          <div className="text-center">
            <div className="text-2xl font-bold leading-none text-slate-900">{total}</div>
            <div className="mt-1 text-[10.5px] text-slate-400">Total</div>
          </div>
        </div>
      </div>
      <div className="w-full space-y-1.5">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} className="flex items-start gap-2 text-[12px] leading-snug">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 text-slate-600">{s.label}</span>
              <span className="shrink-0 whitespace-nowrap font-medium text-slate-900">
                {s.value} <span className="text-slate-400">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
