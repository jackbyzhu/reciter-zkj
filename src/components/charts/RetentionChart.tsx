import { useMemo, useRef, useState } from 'react';
import type { CurvePoint } from '../../algorithms/curve';

const W = 720;
const H = 290;
const PAD = { top: 14, right: 18, bottom: 40, left: 46 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

function fmtDate(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function RetentionChart({
  points,
  dueTime,
  nowTime,
  target,
  word,
  status,
}: {
  points: CurvePoint[];
  dueTime: number;
  nowTime: number;
  target: number;
  word: string;
  status: string;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => {
    if (points.length < 2) return null;
    const t0 = points[0].time;
    const t1 = points[points.length - 1].time;
    const minR = Math.max(
      0,
      Math.min(points.reduce((a, p) => Math.min(a, p.r), 1) - 0.06, 0.45)
    );
    const y0 = Math.floor(minR * 20) / 20;
    const x = (t: number) =>
      PAD.left + ((Math.min(Math.max(t, t0), t1) - t0) / (t1 - t0)) * PW;
    const y = (r: number) =>
      PAD.top + (1 - Math.min(1, Math.max(y0, Math.min(1, r)))) * PH;
    const line = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.time).toFixed(1)},${y(p.r).toFixed(1)}`)
      .join(' ');
    const area = `${line} L${x(t1).toFixed(1)},${y(y0).toFixed(1)} L${x(t0).toFixed(1)},${y(
      y0
    ).toFixed(1)} Z`;
    return { t0, t1, y0, x, y, line, area };
  }, [points]);

  if (!view) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
        {status === 'new'
          ? '这是新词，还没有形成记忆曲线，先去「回顾」复习一次吧'
          : '暂无足够数据绘制曲线'}
      </div>
    );
  }

  const { t0, t1, y0, x, y, line, area } = view;
  const gridLines = [1, 0.9, 0.7, 0.5].filter((g) => g >= y0);

  const markers = [
    { key: 'last', time: t0, x: x(t0), text: `上次复习 ${fmtDate(t0)}` },
    { key: 'now', time: nowTime, x: x(nowTime), text: '今天', now: true },
    {
      key: 'due',
      time: dueTime,
      x: x(dueTime),
      text: dueTime <= nowTime ? `复习日已过 ${fmtDate(dueTime)}` : `复习日 ${fmtDate(dueTime)}`,
      due: true,
    },
  ].filter(
    (m, i, arr) => !arr.some((o, j) => j < i && Math.abs(o.x - m.x) < 4)
  );

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t = t0 + ((px - PAD.left) / PW) * (t1 - t0);
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.time - t);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`${word} 的记忆曲线`}
      >
        <defs>
          <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridLines.map((g) => (
          <g key={g}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(g)}
              y2={y(g)}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text x={PAD.left - 6} y={y(g) + 3.5} textAnchor="end" fontSize={11} fill="#94a3b8">
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}

        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(target)}
          y2={y(target)}
          stroke="#f59e0b"
          strokeWidth={1.2}
          strokeDasharray="5 4"
        />
        <text
          x={W - PAD.right}
          y={y(target) - 5}
          textAnchor="end"
          fontSize={11}
          fill="#b45309"
        >
          目标 {Math.round(target * 100)}%
        </text>

        <path d={area} fill="url(#curve-fill)" stroke="none" />
        <path
          d={line}
          fill="none"
          stroke="#4f46e5"
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {markers.map((m, i) => (
          <g key={m.key}>
            <line
              x1={m.x}
              x2={m.x}
              y1={PAD.top}
              y2={PAD.top + PH}
              stroke={
                m.now
                  ? '#4f46e5'
                  : m.due
                    ? dueTime <= nowTime
                      ? '#ef4444'
                      : '#0ea5e9'
                    : '#94a3b8'
              }
              strokeWidth={1}
              strokeDasharray={m.now ? undefined : '4 3'}
            />
            <text
              x={Math.min(Math.max(m.x, PAD.left + 40), W - PAD.right - 40)}
              y={PAD.top + PH + (i % 2 === 0 ? 14 : 28)}
              textAnchor="middle"
              fontSize={11}
              fontWeight={m.now ? 600 : 500}
              fill={m.now ? '#4338ca' : m.due ? (dueTime <= nowTime ? '#dc2626' : '#0284c7') : '#64748b'}
            >
              {m.text}
            </text>
          </g>
        ))}

        {hp ? (
          <g>
            <line
              x1={x(hp.time)}
              x2={x(hp.time)}
              y1={PAD.top}
              y2={PAD.top + PH}
              stroke="#c7d2fe"
              strokeWidth={1}
            />
            <circle cx={x(hp.time)} cy={y(hp.r)} r={4.5} fill="#fff" stroke="#4f46e5" strokeWidth={2} />
            <text
              x={Math.min(Math.max(x(hp.time), PAD.left + 34), W - PAD.right - 34)}
              y={Math.max(y(hp.r) - 12, PAD.top + 14)}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fill="#4338ca"
            >
              {Math.round(hp.r * 100)}%
            </text>
            <text
              x={Math.min(Math.max(x(hp.time), PAD.left + 34), W - PAD.right - 34)}
              y={Math.max(y(hp.r) + 2, PAD.top + 26)}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
            >
              {fmtDate(hp.time)}
            </text>
          </g>
        ) : null}
      </svg>
      <p className="mt-1 text-center text-xs text-slate-400">
        鼠标悬停查看任意时刻的预测保持率 · 曲线代表单词记忆随时间衰减
      </p>
    </div>
  );
}

export function Sparkline({
  points,
  danger,
  width = 84,
  height = 26,
}: {
  points: CurvePoint[];
  danger?: boolean;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return <div className="h-6 w-[84px]" />;
  }
  const t0 = points[0].time;
  const t1 = points[points.length - 1].time;
  const min = Math.min(...points.map((p) => p.r), 0.5);
  const x = (t: number) => 1 + ((t - t0) / (t1 - t0)) * (width - 2);
  const y = (r: number) => height - 1 - ((r - min) / (1 - min)) * (height - 2);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.time).toFixed(1)},${y(p.r).toFixed(1)}`)
    .join(' ');
  const last = points[points.length - 1];
  const color = danger ? '#ef4444' : '#6366f1';
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={x(last.time)} cy={y(last.r)} r={1.9} fill={color} />
    </svg>
  );
}