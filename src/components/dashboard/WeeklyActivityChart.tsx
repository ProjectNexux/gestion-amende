"use client";

import { useState } from "react";

export type DayActivity = { label: string; recus: number; traites: number };

const WIDTH = 600;
const HEIGHT = 190;
const PAD_LEFT = 6;
const PAD_RIGHT = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

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

// Catmull-Rom → cubic Bézier conversion for a softer, non-jagged curve than plain straight segments.
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return points.length === 1 ? `M${points[0].x},${points[0].y}` : "";
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Lightweight hand-rolled SVG line chart — no charting library is installed, and this dashboard-only need doesn't justify adding one. */
export function WeeklyActivityChart({ data }: { data: DayActivity[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.recus), ...data.map((d) => d.traites));
  const niceMax = Math.ceil(max / 4) * 4 || 4;
  const totalRecus = data.reduce((a, d) => a + d.recus, 0);
  const totalTraites = data.reduce((a, d) => a + d.traites, 0);

  const recusPoints = buildPoints(data.map((d) => d.recus), niceMax);
  const traitesPoints = buildPoints(data.map((d) => d.traites), niceMax);
  const linePath = smoothPath(recusPoints);
  const areaPath = linePath ? `${linePath} L${recusPoints[recusPoints.length - 1].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} L${recusPoints[0].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} Z` : "";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11.5px] font-medium text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4C63D2]" /> Reçus
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-mint-500" /> Traités
          </span>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-[17px] font-extrabold leading-none text-slate-900">{totalRecus}</div>
            <div className="mt-0.5 text-[10.5px] text-slate-400">Reçus (7j)</div>
          </div>
          <div>
            <div className="text-[17px] font-extrabold leading-none text-mint-600">{totalTraites}</div>
            <div className="mt-0.5 text-[10.5px] text-slate-400">Traités (7j)</div>
          </div>
        </div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-44 w-full" preserveAspectRatio="none">
          <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={HEIGHT - PAD_BOTTOM} y2={HEIGHT - PAD_BOTTOM} stroke="#e9ebf7" strokeWidth={1} />

          {areaPath && <path d={areaPath} fill="rgba(76,99,210,0.09)" stroke="none" />}
          <path d={linePath} fill="none" stroke="#4C63D2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <path d={smoothPath(traitesPoints)} fill="none" stroke="#2BBF91" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 5" />

          {data.map((d, i) => (
            <rect
              key={`hit${i}`}
              x={(recusPoints[i]?.x ?? 0) - (WIDTH / data.length) / 2}
              y={0}
              width={WIDTH / data.length}
              height={HEIGHT - PAD_BOTTOM}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            />
          ))}

          {hover !== null && (
            <line x1={recusPoints[hover].x} x2={recusPoints[hover].x} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke="#e2e8f0" strokeWidth={1} />
          )}

          {recusPoints.map((p, i) => (
            <circle key={`r${i}`} cx={p.x} cy={p.y} r={hover === i ? 4.5 : 0} className="transition-all" fill="#4C63D2" />
          ))}
          {traitesPoints.map((p, i) => (
            <circle key={`t${i}`} cx={p.x} cy={p.y} r={hover === i ? 4.5 : 0} className="transition-all" fill="#2BBF91" />
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

        {hover !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200/80 bg-white/95 px-3.5 py-2.5 text-[11.5px] shadow-popover backdrop-blur-sm"
            style={{ left: `${(recusPoints[hover].x / WIDTH) * 100}%`, top: `${(recusPoints[hover].y / HEIGHT) * 100 - 6}%` }}
          >
            <div className="mb-1.5 font-bold text-slate-700">{data[hover].label}</div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4C63D2]" /> Reçus <span className="font-semibold text-slate-800">{data[hover].recus}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-mint-500" /> Traités <span className="font-semibold text-slate-800">{data[hover].traites}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
