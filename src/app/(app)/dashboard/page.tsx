"use client";

import { SIM_SAFE } from "@/lib/simulation/scenario";
import { SimulationControls } from "@/components/simulation-controls";
import { useSimulation } from "@/components/simulation-provider";
import { EquityChart } from "@/components/equity-chart";
import { EventFeed } from "@/components/event-feed";
import { PageHeader } from "@/components/page-header";
import { Panel, PulseRail } from "@/components/panel";
import { fmtUsdc, shortAddr } from "@/lib/format";

export default function DashboardPage() {
  const { scenario, cancelExit, eventT } = useSimulation();

  const header = (
    <>
      <PageHeader
        title="Live Simulation"
        description="Once gains equal the principal, the principal leaves for the safe account once and never returns."
      />
      <p className="-mt-4 mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-accent" />
        Mock Agent API · simulated gains
      </p>
      <SimulationControls />
    </>
  );
  if (!scenario) return header;

  const s = scenario.timeline[scenario.timeline.length - 1]!;
  const p = scenario.principalAtomic;
  const settled = s.bankedAtomic > 0n;
  const queued = s.countdownSec !== null;
  const gains = s.equityAtomic > p ? s.equityAtomic - p : 0n;
  const house = settled ? s.equityAtomic : gains;
  const total = s.bankedAtomic + s.equityAtomic;
  const bankedPct = total === 0n ? 0 : Number((s.bankedAtomic * 1000n) / total) / 10;
  const trigger = scenario.log.ofType("trigger")[0];
  const status = settled ? "Settled" : queued ? `Exit in ${s.countdownSec}s` : s.phase === "red-day" ? "Red day" : "Climbing";

  return (
    <>
      {header}
      <PulseRail
        items={[
          { label: "Equity in agent", value: `${fmtUsdc(s.equityAtomic)}`, hint: "USDC" },
          { label: "Banked", value: fmtUsdc(s.bankedAtomic), hint: "in the safe account", tone: settled ? "good" : "default" },
          { label: "House money", value: fmtUsdc(house), hint: settled ? "all that remains is at risk" : "gains above the stake", tone: "warn" },
          { label: "Principal", value: fmtUsdc(p, 0), hint: `banks at ${fmtUsdc(p * 2n, 0)} (2×)` },
          { label: "Status", value: status, hint: `t = ${s.t}s`, tone: settled ? "good" : s.phase === "red-day" ? "bad" : "default" },
        ]}
      />

      <Panel title="Equity vs principal" subtitle="The equity line crosses 2× once, then the principal exits to the safe account">
        <EquityChart
          timeline={scenario.timeline}
          principal={Number(p) / 1e6}
          totalSteps={scenario.totalSteps}
          triggerT={trigger ? eventT(trigger) : null}
        />
      </Panel>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Where the money sits" subtitle="Banked is untouchable; house money is all that can still be lost">
          <div className="flex h-5 overflow-hidden rounded-full bg-muted">
            <div className="bg-emerald-400 transition-[width] duration-300" style={{ width: `${bankedPct}%` }} />
            <div className="bg-amber-400 transition-[width] duration-300" style={{ width: `${100 - bankedPct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-emerald-400">Banked · {fmtUsdc(s.bankedAtomic)}</span>
            <span className="text-amber-400">At risk · {fmtUsdc(s.equityAtomic)}</span>
          </div>
        </Panel>

        <Panel title="Principal exit" subtitle={`${fmtUsdc(p)} USDC → ${shortAddr(SIM_SAFE)} on Base`}>
          {queued ? (
            <div>
              <p className="font-display text-4xl font-semibold">{s.countdownSec}s</p>
              <div className="my-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${100 - (s.countdownSec! * 100000) / scenario.timelockMs}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">Veto window. Nothing has left yet.</p>
              <button onClick={() => void cancelExit()} className="mt-3 rounded-lg border border-red-400/40 px-3.5 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/10">
                Owner veto: cancel exit
              </button>
            </div>
          ) : settled ? (
            <p className="text-sm text-emerald-400">Settled. Everything left in the agent is house money.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for gains to equal the principal.</p>
          )}
        </Panel>
      </div>

      <Panel title="Event feed" subtitle="What the runner did, newest first" className="mt-6">
        <EventFeed limit={8} />
      </Panel>
    </>
  );
}
