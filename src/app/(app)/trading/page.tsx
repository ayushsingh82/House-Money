"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel, PulseRail } from "@/components/panel";
import type { RunnerEvent } from "@/lib/runner/events";
import { TradingSimulation, type TradingSnapshot } from "@/lib/simulation/trading";

type Run = { timeline: TradingSnapshot[]; events: { t: number; e: RunnerEvent }[]; principal: number; timelockSec: number };

const usd = (micro: bigint) => (Number(micro) / 1e6).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

async function simulate(): Promise<Run> {
  const sim = await new TradingSimulation().init();
  const start = sim.api.clock.now();
  await sim.runToEnd();
  return {
    timeline: sim.timeline,
    events: sim.log.events.filter((e) => e.type !== "tick" && e.type !== "awaiting_cash").map((e) => ({ t: Math.round((Date.parse(e.at) - start) / 1000), e })),
    principal: Number(sim.principalAtomic) / 1e6,
    timelockSec: sim.timelockMs / 1000,
  };
}

function describe(e: RunnerEvent): { text: string; tone: string } | null {
  switch (e.type) {
    case "swap_queued": return { text: `${e.reason === "raise_cash" ? "Raise cash for the exit" : "Trend"}: swap ${e.from.includes("usdc") ? "USDC → wNEAR" : "wNEAR → USDC"} queued`, tone: "text-foreground" };
    case "swap_settled": return { text: "Swap filled at the price when its timelock released", tone: "text-emerald-400" };
    case "swap_failed": return { text: `Swap failed: ${e.failureCode}`, tone: "text-red-400" };
    case "trigger": return { text: "Gains equal the principal: exit triggered", tone: "text-amber-400" };
    case "withdraw_queued": return { text: "Principal exit queued to the safe account", tone: "text-foreground" };
    case "withdraw_settled": return { text: "Principal settled to the safe account", tone: "text-emerald-400" };
    case "refused": return { text: `Refused: ${e.code}`, tone: "text-red-400" };
    default: return null;
  }
}

function Chart({ run, upTo }: { run: Run; upTo: number }) {
  const w = 600, h = 260, pad = { l: 44, r: 8, t: 10, b: 22 };
  const n = run.timeline.length - 1;
  const maxEq = Math.max(...run.timeline.map((s) => Number(s.equityMicroUsd) / 1e6), run.principal * 2) * 1.08;
  const maxPx = Math.max(...run.timeline.map((s) => s.priceUsd));
  const x = (t: number) => pad.l + (t / n) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / maxEq) * (h - pad.t - pad.b);
  const line = (f: (s: TradingSnapshot) => number) => run.timeline.slice(0, upTo + 1).map((s, i) => `${x(i)},${y(f(s))}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Asset price, agent equity and banked principal">
      {[0, 0.5, 1, 1.5, 2].map((m) => (
        <g key={m}>
          <line x1={pad.l} x2={w - pad.r} y1={y(m * run.principal)} y2={y(m * run.principal)} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={pad.l - 6} y={y(m * run.principal) + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">{Math.round(m * run.principal).toLocaleString("en-US")}</text>
        </g>
      ))}
      <line x1={pad.l} x2={w - pad.r} y1={y(2 * run.principal)} y2={y(2 * run.principal)} stroke="#fbbf24" strokeDasharray="2 4" />
      <text x={pad.l + 4} y={y(2 * run.principal) - 5} fontSize="10" fill="#fbbf24">trigger 2×</text>
      <polyline fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.6" strokeDasharray="4 4" strokeWidth="1.5" points={line((s) => (s.priceUsd / maxPx) * maxEq * 0.9)} />
      <polyline fill="none" stroke="#34d399" strokeWidth="1.75" points={line((s) => Number(s.bankedMicroUsd) / 1e6)} />
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" points={line((s) => Number(s.equityMicroUsd) / 1e6)} />
      <line x1={x(upTo)} x2={x(upTo)} y1={pad.t} y2={h - pad.b} stroke="var(--muted-foreground)" strokeOpacity="0.4" />
      {[0, 10, 20, 30, 40, 50].filter((t) => t <= n).map((t) => (
        <text key={t} x={x(t)} y={h - 4} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{t}s</text>
      ))}
    </svg>
  );
}

export default function TradingPage() {
  const [run, setRun] = useState<Run | null>(null);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void simulate().then(setRun);
  }, []);
  useEffect(() => {
    if (!run || !playing) return;
    timer.current = setInterval(() => setAt((a) => (a >= run.timeline.length - 1 ? a : a + 1)), 250);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [run, playing]);

  const view = useMemo(() => {
    if (!run) return null;
    const s = run.timeline[at]!;
    return { s, events: run.events.filter((x) => x.t <= at && describe(x.e)).reverse() };
  }, [run, at]);

  return (
    <>
      <PageHeader title="Trading Agent" description="A trend-following agent trades a rally through the policy, banks its principal when gains cover it, then rides out the drawdown on house money." />
      <p className="-mt-4 mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-accent" />
        Mock Agent API · simulated price path · the same code runs live
      </p>
      {!run || !view ? (
        <p className="text-sm text-muted-foreground">Running the agent…</p>
      ) : (
        <>
          <div className="mb-6 flex items-center gap-3">
            <button onClick={() => { if (at >= run.timeline.length - 1) setAt(0); setPlaying((p) => !p); }} className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background">
              {playing && at < run.timeline.length - 1 ? <Pause className="size-4" /> : <Play className="size-4" />}
              {playing && at < run.timeline.length - 1 ? "Pause" : "Play"}
            </button>
            <button onClick={() => { setAt(0); setPlaying(true); }} className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium hover:bg-muted"><RotateCcw className="size-4" />Replay</button>
            <input type="range" min={0} max={run.timeline.length - 1} value={at} onChange={(e) => { setPlaying(false); setAt(Number(e.target.value)); }} className="ml-2 flex-1 accent-[var(--accent)]" aria-label="Time" />
            <span className="w-16 text-right font-mono text-xs text-muted-foreground">t = {at}s</span>
          </div>
          <PulseRail
            items={[
              { label: "Asset price", value: `$${view.s.priceUsd.toFixed(2)}`, hint: "wNEAR (simulated)" },
              { label: "Equity in agent", value: usd(view.s.equityMicroUsd), hint: `${Math.round(view.s.riskShare * 100)}% in wNEAR` },
              { label: "Banked", value: usd(view.s.bankedMicroUsd), hint: "in the safe account", tone: view.s.bankedMicroUsd > 0n ? "good" : "default" },
              { label: "Principal", value: `$${run.principal.toLocaleString("en-US")}`, hint: "banks at 2×" },
              { label: "Swap delay", value: `${run.timelockSec}s`, hint: "the timelock covers swaps too", tone: "warn" },
            ]}
          />
          <Panel title="Price, equity and banked" subtitle="Dashed grey is the asset price (scaled). Orange is the agent's equity. Green is what reached the safe account.">
            <Chart run={run} upTo={at} />
          </Panel>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Panel title="What the agent did" subtitle="Newest first">
              {view.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Waiting for a trend…</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {view.events.slice(0, 10).map((x, i) => {
                    const d = describe(x.e)!;
                    return (
                      <li key={i} className="flex gap-3 border-t pt-1.5 first:border-t-0 first:pt-0">
                        <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{x.t}s</span>
                        <span className={d.tone}>{d.text}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
            <Panel title="Why it is built this way" subtitle="Constraints the live API imposes">
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><span className="text-foreground">Swaps wait too.</span> The policy delay applies to every money action except deposits, so each swap fills at the price when its delay ends.</li>
                <li><span className="text-foreground">Cash first.</span> At 2× the trader sells into the stake asset, because the exit needs that balance twice: when requested and when released.</li>
                <li><span className="text-foreground">Reserve.</span> While the exit is queued, the stake in the stake asset is never swapped away.</li>
                <li><span className="text-foreground">Latched trigger.</span> A dip while the cash is being raised does not cancel the exit.</li>
              </ul>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
