import { useMemo } from 'react';
import type { RatePoint } from '@/lib/types';
import { metalLabel } from '@/lib/format';

const COLORS = ['#bd5510', '#334155', '#0f766e', '#6d28d9'];

function fmt(n: number) {
  return n.toLocaleString('en-EG');
}

export default function RateChart({ points, days }: { points: RatePoint[]; days: number }) {
  const series = useMemo(() => {
    const map = new Map<string, RatePoint[]>();
    for (const p of points) {
      const key = `${p.metalType}:${p.carat ?? ''}`;
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return [...map.entries()]
      .map(([key, pts]) => ({ key, pts: pts.sort((a, b) => (a.day < b.day ? -1 : 1)) }))
      .filter((s) => s.pts.length >= 2);
  }, [points]);

  if (series.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-500">
        لا توجد بيانات كافية بعد — تظهر الأسعار بعد يومين من التشغيل.
      </div>
    );
  }

  const W = 700;
  const H = 240;
  const PAD_L = 52;
  const PAD_R = 16;
  const PAD_T = 14;
  const PAD_B = 26;

  const allVals = series.flatMap((s) => s.pts.map((p) => p.pricePerGram));
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const span = Math.max(max - min, 1);
  const lo = Math.floor((min - span * 0.08) / 100) * 100;
  const hi = Math.ceil((max + span * 0.08) / 100) * 100;
  const range = Math.max(hi - lo, 100);

  const xFor = (i: number, n: number) => (n === 1 ? (PAD_L + W - PAD_R) / 2 : PAD_L + ((W - PAD_L - PAD_R) * i) / (n - 1));
  const yFor = (v: number) => PAD_T + (1 - (v - lo) / range) * (H - PAD_T - PAD_B);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: PAD_T + t * (H - PAD_T - PAD_B),
    v: lo + (1 - t) * range,
  }));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="مخطط أسعار المعدن">
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={g.y} y2={g.y} className="stroke-slate-200" strokeDasharray="3 3" />
            <text x={PAD_L - 6} y={g.y + 3} textAnchor="end" fontSize="10" className="fill-slate-400">
              {fmt(g.v)}
            </text>
          </g>
        ))}

        {series.map((s, si) => {
          const n = s.pts.length;
          const d = s.pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i, n).toFixed(1)},${yFor(p.pricePerGram).toFixed(1)}`).join(' ');
          const last = s.pts[n - 1];
          const color = COLORS[si % COLORS.length];
          return (
            <g key={s.key}>
              <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={xFor(n - 1, n)} cy={yFor(last.pricePerGram)} r="3.5" fill={color} />
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-600">
        {series.map((s, si) => {
          const last = s.pts[s.pts.length - 1];
          return (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: COLORS[si % COLORS.length] }} />
              {metalLabel(s.pts[0].metalType)} {s.pts[0].carat ?? ''} — {fmt(last.pricePerGram)} ج.م/جم
              <span className="font-medium text-slate-400">آخر {days} يوم</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
