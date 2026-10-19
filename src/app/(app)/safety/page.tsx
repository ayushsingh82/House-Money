"use client";

import { Check, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { useSimulation } from "@/components/simulation-provider";
import { SIM_AGENT, SIM_ASSET, SIM_SAFE } from "@/lib/simulation/scenario";

const btn = "rounded-lg border border-red-400/40 px-3.5 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-40";

export default function SafetyPage() {
  const { scenario, attempts, attempt, matrix, runMatrix } = useSimulation();
  const key = () => `try-${Math.random()}`;
  const g = scenario?.grant;
  const P = scenario?.principalAtomic ?? 0n;

  return (
    <>
      <PageHeader title="Try to Break It" description="Each attempt below is a real call against the policy. Every one should be refused." />
      <Panel title="Attempts" subtitle="Run these at any point, before, during or after the exit">
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={!g} onClick={() => void attempt("Pull money back to the owner (transfer)", () => g!.transfer(SIM_AGENT, { asset: SIM_ASSET, amount: "1000000", recipient: "owner.near" }))}>
            Give me my money back
          </button>
          <button className={btn} disabled={!g} onClick={() => void attempt("Withdraw 1 USDC to another address", () => g!.withdraw(SIM_AGENT, { asset: SIM_ASSET, amount: "1000000", chain: "base", recipient: "0xATTACKER" }, { idempotencyKey: key() }))}>
            Withdraw to another address
          </button>
          <button className={btn} disabled={!g} onClick={() => void attempt("Withdraw principal + 1 to the safe account", () => g!.withdraw(SIM_AGENT, { asset: SIM_ASSET, amount: (P + 1n).toString(), chain: "base", recipient: SIM_SAFE }, { idempotencyKey: key() }))}>
            Withdraw principal + 1
          </button>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm">
          {attempts.length === 0 && <li className="text-muted-foreground">Attempts show up here.</li>}
          {attempts.map((a, i) => (
            <li key={i} className="flex gap-3 border-t pt-1.5 first:border-t-0 first:pt-0">
              <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{a.t}s</span>
              <span>{a.label}</span>
              <span className={`ml-auto font-mono text-xs ${a.code ? "text-red-400" : "text-emerald-400"}`}>{a.code ? `refused: ${a.code}` : "allowed"}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Refusal matrix"
        subtitle="Nine checks across destination, cap, action, asset, replay, grant and rate limit"
        className="mt-6"
        right={
          <button onClick={() => void runMatrix()} disabled={!scenario} className="rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40">
            Run all checks
          </button>
        }
      >
        {!matrix ? (
          <p className="text-sm text-muted-foreground">Not run yet. Start the simulation first for the strongest result.</p>
        ) : (
          <>
            <p className="mb-3 text-sm">
              <span className={matrix.every((c) => c.pass) ? "text-emerald-400" : "text-red-400"}>
                {matrix.filter((c) => c.pass).length} / {matrix.length} held
              </span>
            </p>
            <ul className="space-y-1.5 text-sm">
              {matrix.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-t pt-1.5 first:border-t-0 first:pt-0">
                  {c.pass ? <Check className="size-4 shrink-0 text-emerald-400" /> : <X className="size-4 shrink-0 text-red-400" />}
                  <span>{c.label}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{c.pass ? c.expected : `got ${c.got}`}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </>
  );
}
