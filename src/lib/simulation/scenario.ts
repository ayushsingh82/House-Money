import { MockAgentApi } from "@/lib/agent-api/mock";
import { buildHouseMoneyPolicy } from "@/lib/policy/policy";
import { principalKey } from "@/lib/risk/trigger";
import type { TokenInfo } from "@/lib/policy/types";
import { EventLog } from "@/lib/runner/events";
import { HouseMoneyRunner } from "@/lib/runner/runner";
import { MemoryStateStore, type StateStore } from "@/lib/runner/store";
import { applyStep, buildScenario, type Step } from "@/lib/simulation/strategy";

export const SIM_ASSET = "nep141:usdc-sim";
export const SIM_AGENT = "agent-house-money";
export const SIM_SAFE = "0xSAFE000000000000000000000000000000000001";

export type Snapshot = {
  /** Simulated seconds since start. */
  t: number;
  equityAtomic: bigint;
  /** Principal that has left to the safe account (settled). */
  bankedAtomic: bigint;
  /** Queued principal exit not yet released, with seconds remaining. */
  countdownSec: number | null;
  phase: "gains" | "red-day";
};

export type ScenarioOptions = {
  principalAtomic?: bigint;
  /** Simulated seconds per step. */
  stepSec?: number;
  gainSteps?: number;
  lossSteps?: number;
  lossPct?: number;
  /** Simulation timelock; production is 3_600_000. */
  timelockMs?: number;
  store?: StateStore;
  /** Steps to run after the red day so the countdown can finish. */
  tailSteps?: number;
};

const fresh = (clockNow: Date): TokenInfo => ({
  asset_id: SIM_ASSET,
  symbol: "USDC",
  decimals: 6,
  blockchain: "near",
  price: 1,
  price_updated_at: clockNow.toISOString(),
  price_expires_at: new Date(clockNow.getTime() + 600_000).toISOString(),
});

/**
 * The 60-second story on the mock, advanced one step at a time so a UI can pause, step and
 * poke it (cancel the exit, attempt refused withdrawals) between steps.
 * Defaults: 20 gain steps + 10 loss steps + 25 tail, 1 simulated second each, 30s timelock.
 */
export class HouseMoneySimulation {
  readonly api = new MockAgentApi([]);
  readonly log = new EventLog();
  readonly timeline: Snapshot[] = [];
  readonly principalAtomic: bigint;
  readonly timelockMs: number;
  readonly gainSteps: number;
  readonly startMs: number;
  readonly store: StateStore;
  runner!: HouseMoneyRunner;
  token!: string;
  index = 0;
  private steps: Step[] = [];
  private banked = 0n;
  private elapsed = 0;
  private stepSec: number;

  constructor(private opts: ScenarioOptions = {}) {
    this.principalAtomic = opts.principalAtomic ?? 1_000_000_000n; // 1000 USDC
    this.stepSec = opts.stepSec ?? 1;
    this.timelockMs = opts.timelockMs ?? 30_000;
    this.gainSteps = opts.gainSteps ?? 20;
    this.startMs = this.api.clock.now();
    this.store = opts.store ?? new MemoryStateStore();
  }

  get totalSteps() {
    return this.steps.length;
  }
  get done() {
    return this.index >= this.steps.length;
  }
  get grant() {
    return this.api.forGrant(this.token);
  }

  async init() {
    const { api, principalAtomic: principal } = this;
    api.setTokens([fresh(api.clock.date())]);
    api.createAgent(SIM_AGENT, { [SIM_ASSET]: principal });
    await api.updatePolicy(
      SIM_AGENT,
      buildHouseMoneyPolicy({ asset: SIM_ASSET, principalAtomic: principal, chain: "base", safeAddress: SIM_SAFE, timelockMs: this.timelockMs }),
      0,
    );
    this.token = (await api.issueGrant(SIM_AGENT, "house-money:runner", new Date(api.clock.now() + 86_400_000))).token;
    this.runner = new HouseMoneyRunner({
      client: api,
      grant: this.grant,
      agentId: SIM_AGENT,
      asset: SIM_ASSET,
      principalAtomic: principal,
      principalMicroUsd: principal, // USDC: 6 decimals == micro-USD
      chain: "base",
      safeAddress: SIM_SAFE,
      store: this.store,
      log: this.log,
      now: () => api.clock.date(),
    });
    this.steps = buildScenario({
      gainAtomic: principal,
      gainSteps: this.gainSteps,
      lossPct: this.opts.lossPct ?? 0.4,
      lossSteps: this.opts.lossSteps ?? 10,
    });
    for (let i = 0; i < (this.opts.tailSteps ?? 25); i++) this.steps.push({ kind: "hold" });
    await this.snap("gains");
    return this;
  }

  /** Apply one strategy step, advance the clock, let the runner react. Returns false when finished. */
  async step(): Promise<boolean> {
    if (this.done) return false;
    const { api } = this;
    const step = this.steps[this.index]!;
    const phase = this.index < this.gainSteps ? "gains" : "red-day";
    const cur = BigInt((await this.grant.getBalances(SIM_AGENT)).balances[SIM_ASSET] ?? "0");
    api.setBalance(SIM_AGENT, SIM_ASSET, applyStep(cur, step));
    api.setTokens([fresh(api.clock.date())]);
    api.advance(this.stepSec * 1000);
    this.elapsed += this.stepSec;
    this.index++;
    await this.runner.tick();
    this.banked = api.settled.reduce((s, o) => s + BigInt(o.request.amount), 0n);
    await this.snap(phase);
    return !this.done;
  }

  async runToEnd() {
    while (await this.step());
    return this;
  }

  private async snap(phase: Snapshot["phase"]) {
    const { balances } = await this.grant.getBalances(SIM_AGENT);
    const queued = (await this.api.listScheduledExecutions(SIM_AGENT))[0];
    this.timeline.push({
      t: this.elapsed,
      equityAtomic: BigInt(balances[SIM_ASSET] ?? "0"),
      bankedAtomic: this.banked,
      countdownSec: queued?.execute_after
        ? Math.max(0, Math.ceil((Date.parse(queued.execute_after) - this.api.clock.now()) / 1000))
        : null,
      phase,
    });
  }
}

export type ScenarioResult = {
  api: MockAgentApi;
  runner: HouseMoneyRunner;
  log: EventLog;
  timeline: Snapshot[];
  principalAtomic: bigint;
};

/** Run the whole story to completion (tests, headless runs). */
export async function runHouseMoneyScenario(opts: ScenarioOptions = {}): Promise<ScenarioResult> {
  const s = await new HouseMoneySimulation(opts).init();
  await s.runToEnd();
  return { api: s.api, runner: s.runner, log: s.log, timeline: s.timeline, principalAtomic: s.principalAtomic };
}

export { principalKey };
