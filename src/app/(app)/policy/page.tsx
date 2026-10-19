"use client";

import { ArrowUpRight, Hourglass, Scale } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { useSimulation } from "@/components/simulation-provider";
import { fmtUsdc, shortAddr } from "@/lib/format";
import { buildHouseMoneyPolicy } from "@/lib/policy/policy";
import { SIM_ASSET, SIM_SAFE } from "@/lib/simulation/scenario";

export default function PolicyPage() {
  const { scenario } = useSimulation();
  if (!scenario) return <PageHeader title="Signed Policy" description="Loading…" />;
  const policy = buildHouseMoneyPolicy({
    asset: SIM_ASSET,
    principalAtomic: scenario.principalAtomic,
    chain: "base",
    safeAddress: SIM_SAFE,
    timelockMs: scenario.timelockMs,
  });
  const cards = [
    { icon: ArrowUpRight, name: "One destination", value: `${shortAddr(SIM_SAFE)} on Base`, text: "The only place funds can ever go. Nothing comes back from it." },
    { icon: Scale, name: "One cap", value: `${fmtUsdc(scenario.principalAtomic)} USDC per transaction`, text: "Exactly the stake, so even the exit itself is bounded." },
    { icon: Hourglass, name: "One delay", value: `${scenario.timelockMs / 1000}s veto window`, text: "1 hour in production. The owner can cancel before anything leaves." },
  ];
  return (
    <>
      <PageHeader title="Signed Policy" description="The entire discipline is three signed numbers. The owner signs once; the agent can only act inside them." />
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ icon: Icon, name, value, text }, i) => (
          <div key={name} className="rounded-xl border bg-card p-5">
            <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
            <Icon className="mt-3 size-6 text-accent" />
            <h3 className="mt-3 font-display text-lg font-semibold">{name}</h3>
            <p className="mt-1 font-mono text-xs text-accent">{value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
      <Panel title="Policy as sent to the Agent API" subtitle="Withdraw is the only allowed action, so there is no route back" className="mt-6">
        <pre className="overflow-x-auto rounded-lg border bg-muted p-4 font-mono text-xs leading-relaxed">{JSON.stringify(policy, null, 2)}</pre>
      </Panel>
    </>
  );
}
