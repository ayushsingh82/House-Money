import type { Snapshot } from "@/lib/simulation/scenario";

/** Dependency-free SVG chart in the style of Orca's LineChart: equity, banked, principal and trigger lines. */
export function EquityChart({
  timeline,
  principal,
  totalSteps,
  triggerT,
  height = 260,
}: {
  timeline: Snapshot[];
  principal: number;
  totalSteps: number;
  triggerT: number | null;
  height?: number;
}) {
  const w = 600;
  const pad = { l: 44, r: 8, t: 10, b: 22 };
  const maxY = principal * 2.4;
  const x = (t: number) => pad.l + (t / totalSteps) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / maxY) * (height - pad.t - pad.b);
  const pts = (f: (s: Snapshot) => number) => timeline.map((s) => `${x(s.t)},${y(f(s))}`).join(" ");
  const ticks = [0, 0.5, 1, 1.5, 2].map((m) => m * principal);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-label="Equity over time against the principal and the 2x trigger">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
              {Math.round(t).toLocaleString("en-US")}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={w - pad.r} y1={y(principal)} y2={y(principal)} stroke="#34d399" strokeDasharray="5 4" />
        <text x={w - pad.r - 2} y={y(principal) - 5} textAnchor="end" fontSize="10" fill="#34d399">principal</text>
        <line x1={pad.l} x2={w - pad.r} y1={y(2 * principal)} y2={y(2 * principal)} stroke="#fbbf24" strokeDasharray="2 4" />
        <text x={pad.l + 4} y={y(2 * principal) - 5} fontSize="10" fill="#fbbf24">trigger 2×</text>
        {triggerT !== null && (
          <g>
            <line x1={x(triggerT)} x2={x(triggerT)} y1={pad.t} y2={height - pad.b} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
            <text x={x(triggerT) + 4} y={pad.t + 10} fontSize="10" fill="var(--muted-foreground)">exit queued</text>
          </g>
        )}
        <polyline fill="none" stroke="#34d399" strokeWidth="1.75" points={pts((s) => Number(s.bankedAtomic) / 1e6)} />
        <polyline fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" points={pts((s) => Number(s.equityAtomic) / 1e6)} />
        {[0, 10, 20, 30, 40, 50].filter((t) => t <= totalSteps).map((t) => (
          <text key={t} x={x(t)} y={height - 4} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{t}s</text>
        ))}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" />Equity in agent</li>
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-400" />Banked in safe account</li>
      </ul>
    </div>
  );
}
