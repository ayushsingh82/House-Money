"use client";

import type { RunnerEvent } from "@/lib/runner/events";
import { useSimulation } from "@/components/simulation-provider";
import { fmtUsdc } from "@/lib/format";

type Line = { text: string; tone: "default" | "good" | "bad" };

function describe(e: RunnerEvent, principal: bigint, timelockSec: number): Line | null {
  switch (e.type) {
    case "trigger": return { text: `Gains cover the principal. Banking ${fmtUsdc(principal)} USDC.`, tone: "default" };
    case "withdraw_queued": return { text: `Exit queued, releases in ${timelockSec}s. The owner can veto.`, tone: "default" };
    case "withdraw_settled": return { text: "Principal settled to the safe account.", tone: "good" };
    case "withdraw_failed": return { text: `Exit did not settle (${e.failureCode}).`, tone: "bad" };
    case "refused": return { text: `Refused: ${e.code}`, tone: "bad" };
    case "price_unavailable": return { text: "Price unavailable. Failing closed.", tone: "bad" };
    case "error": return { text: e.message, tone: "bad" };
    default: return null; // ticks feed the chart, not the log
  }
}

const TONE = { default: "text-foreground", good: "text-emerald-400", bad: "text-red-400" } as const;

export function EventFeed({ limit }: { limit?: number }) {
  const { scenario, eventT } = useSimulation();
  if (!scenario) return <p className="text-sm text-muted-foreground">Starting…</p>;
  const lines = scenario.log.events
    .map((e) => ({ t: eventT(e), line: describe(e, scenario.principalAtomic, scenario.timelockMs / 1000) }))
    .filter((x): x is { t: number; line: Line } => x.line !== null)
    .reverse()
    .slice(0, limit);
  if (lines.length === 0) return <p className="text-sm text-muted-foreground">Waiting for gains…</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {lines.map((x, i) => (
        <li key={i} className="flex gap-3 border-t pt-1.5 first:border-t-0 first:pt-0">
          <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{x.t}s</span>
          <span className={TONE[x.line.tone]}>{x.line.text}</span>
        </li>
      ))}
    </ul>
  );
}
