export type DayActivity = { label: string; recus: number; traites: number };

const WIDTH = 600;
const HEIGHT = 200;
const PAD_LEFT = 28;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

function buildPoints(values: number[], max: number) {
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  return values.map((v, i) => {
    const x = PAD_LEFT + i * step;
    const y = PAD_TOP + innerH - (max === 0 ? 0 : (v / max) * innerH);
    return { x, y };
  });
}

function pathFrom(points: { x: number; y: number }[]) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

/** Lightweight hand-rolled SVG line chart — no charting library is installed, and this dashboard-only need doesn't justify adding one. */
export function WeeklyActivityChart({ data }: { data: DayActivity[] }) {
  const max = Math.max(1, ...data.map((d) => d.recus), ...data.map((d) => d.traites));
  const niceMax = Math.ceil(max / 4) * 4 || 4;

  const recusPoints = buildPoints(data.map((d) => d.recus), niceMax);
  const traitesPoints = buildPoints(data.map((d) => d.traites), niceMax);
  const areaPath =
    recusPoints.length > 0
      ? `${pathFrom(recusPoints)} L${recusPoints[recusPoints.length - 1].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} L${recusPoints[0].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} Z`
      : "";

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs font-medium text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Reçus
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Traités
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-44 w-full" preserveAspectRatio="none">
        {gridLines.map((f) => {
          const y = PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) * (1 - f);
          return (
            <g key={f}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="#f1f5f9" strokeWidth={1} />
              <text x={0} y={y + 3} fontSize={9} fill="#94a3b8">
                {Math.round(niceMax * f)}
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill="rgba(59,130,246,0.08)" stroke="none" />}
        <path d={pathFrom(recusPoints)} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFrom(traitesPoints)} fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {recusPoints.map((p, i) => (
          <circle key={`r${i}`} cx={p.x} cy={p.y} r={2.75} fill="#3b82f6" />
        ))}
        {traitesPoints.map((p, i) => (
          <circle key={`t${i}`} cx={p.x} cy={p.y} r={2.75} fill="#10b981" />
        ))}

        {data.map((d, i) => {
          const x = recusPoints[i]?.x ?? 0;
          return (
            <text key={d.label} x={x} y={HEIGHT - 6} fontSize={9.5} fill="#94a3b8" textAnchor="middle">
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
