"use client";

import { useState } from "react";

export type DayActivity = { label: string; recus: number; traites: number };

const WIDTH = 600;
const HEIGHT = 108;
const PAD_LEFT = 6;
const PAD_RIGHT = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;

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

/**
 * Compact, hand-rolled SVG line chart (no charting library) — reduced height vs the previous
 * version, 3 distinguishable series (reçus / traités / restants), each with both a distinct
 * color AND a distinct stroke/marker style so two series never look identical even when their
 * values happen to coincide on a given point.
 */
export function WeeklyActivityChart({ data }: { data: DayActivity[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0 || data.every((d) => d.recus === 0 && d.traites === 0)) {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg bg-slate-50 text-[12.5px] text-slate-400">
        Pas assez de données sur cette période.
      </div>
    );
  }

  const restants = data.map((d) => Math.max(0, d.recus - d.traites));
  const max = Math.max(1, ...data.map((d) => d.recus), ...data.map((d) => d.traites), ...restants);
  const niceMax = Math.ceil(max / 4) * 4 || 4;
  const totalRecus = data.reduce((a, d) => a + d.recus, 0);
  const totalTraites = data.reduce((a, d) => a + d.traites, 0);
  const totalRestants = restants.reduce((a, v) => a + v, 0);

  const recusPoints = buildPoints(data.map((d) => d.recus), niceMax);
  const traitesPoints = buildPoints(data.map((d) => d.traites), niceMax);
  const restantsPoints = buildPoints(restants, niceMax);
  const linePath = smoothPath(recusPoints);
  const areaPath = linePath ? `${linePath} L${recusPoints[recusPoints.length - 1].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} L${recusPoints[0].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} Z` : "";

  // Show at most ~8 x-axis labels regardless of period, to avoid overlapping text on 30j/12 mois.
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4C63D2]" /> Reçus
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-mint-500" /> Traités
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Restants
          </span>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-[15px] font-extrabold leading-none text-slate-900">{totalRecus}</div>
            <div className="mt-0.5 text-[10px] text-slate-400">Reçus</div>
          </div>
          <div>
            <div className="text-[15px] font-extrabold leading-none text-mint-600">{totalTraites}</div>
            <div className="mt-0.5 text-[10px] text-slate-400">Traités</div>
          </div>
          <div>
            <div className="text-[15px] font-extrabold leading-none text-amber-600">{totalRestants}</div>
            <div className="mt-0.5 text-[10px] text-slate-400">Restants</div>
          </div>
        </div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[86px] w-full" preserveAspectRatio="none">
          <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={HEIGHT - PAD_BOTTOM} y2={HEIGHT - PAD_BOTTOM} stroke="#e9ebf7" strokeWidth={1} />

          {areaPath && <path d={areaPath} fill="rgba(76,99,210,0.09)" stroke="none" />}
          <path d={linePath} fill="none" stroke="#4C63D2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <path d={smoothPath(traitesPoints)} fill="none" stroke="#2BBF91" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 5" />
          <path d={smoothPath(restantsPoints)} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />

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
            <circle key={`r${i}`} cx={p.x} cy={p.y} r={hover === i ? 3.5 : 0} className="transition-all" fill="#4C63D2" />
          ))}
          {traitesPoints.map((p, i) => (
            <circle key={`t${i}`} cx={p.x} cy={p.y} r={hover === i ? 3.5 : 0} className="transition-all" fill="#2BBF91" />
          ))}
          {restantsPoints.map((p, i) => (
            <circle key={`s${i}`} cx={p.x} cy={p.y} r={hover === i ? 3.5 : 0} className="transition-all" fill="#f59e0b" />
          ))}

          {data.map((d, i) => {
            if (i % labelStep !== 0 && i !== data.length - 1) return null;
            const x = recusPoints[i]?.x ?? 0;
            return (
              <text key={d.label} x={x} y={HEIGHT - 5} fontSize={9} fill="#94a3b8" textAnchor="middle">
                {d.label}
              </text>
            );
          })}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-[11px] shadow-popover backdrop-blur-sm"
            style={{ left: `${(recusPoints[hover].x / WIDTH) * 100}%`, top: `${(recusPoints[hover].y / HEIGHT) * 100 - 6}%` }}
          >
            <div className="mb-1 font-bold text-slate-700">{data[hover].label}</div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4C63D2]" /> Reçus <span className="font-semibold text-slate-800">{data[hover].recus}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-mint-500" /> Traités <span className="font-semibold text-slate-800">{data[hover].traites}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Restants <span className="font-semibold text-slate-800">{restants[hover]}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

