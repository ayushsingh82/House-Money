import { MockAgentApi } from "@/lib/agent-api/mock";
import { buildHouseMoneyPolicy } from "@/lib/policy/policy";
import type { TokenInfo } from "@/lib/policy/types";
import { portfolioValueMicroUsd } from "@/lib/risk/pricing";
import { EventLog } from "@/lib/runner/events";
import { HouseMoneyRunner } from "@/lib/runner/runner";
import { MemoryStateStore } from "@/lib/runner/store";
import { Trader } from "@/lib/strategy/trader";
import { TrendStrategy } from "@/lib/strategy/trend";

export const TRADE_STABLE = "nep141:usdc-sim";
export const TRADE_RISK = "nep141:wnear-sim";
export const TRADE_AGENT = "agent-house-money-trading";
export const TRADE_SAFE = "0xSAFE000000000000000000000000000000000001";

const token = (asset_id: string, symbol: string, decimals: number, price: number, now: Date): TokenInfo => ({
  asset_id,
  symbol,
  decimals,
  blockchain: "near",
  price,
  price_updated_at: now.toISOString(),
  price_expires_at: new Date(now.getTime() + 600_000).toISOString(),
});

/** Price path: a steep run-up, a 40% drawdown, then flat. Deterministic. */
export function pricePath(upSteps = 24, downSteps = 12, tailSteps = 20, start = 1, peak = 4, dropPct = 0.4): number[] {
  const out: number[] = [];
  for (let i = 1; i <= upSteps; i++) out.push(start + ((peak - start) * i) / upSteps);
  for (let j = 1; j <= downSteps; j++) out.push(peak * Math.pow(1 - dropPct, j / downSteps));
  const last = out[out.length - 1]!;
  for (let k = 0; k < tailSteps; k++) out.push(last);
  return out;
}

export type TradingSnapshot = {
  t: number;
  priceUsd: number;
  equityMicroUsd: bigint;
  /** Principal that has reached the safe account, micro-USD (stake asset is $1). */
  bankedMicroUsd: bigint;
  /** Share of equity in the risk asset, 0..1. */
  riskShare: number;
};

export type TradingOptions = {
  principalAtomic?: bigint;
  /** Applies to the exit and to every swap. */
  timelockMs?: number;
  prices?: number[];
  sealAfterSettlement?: boolean;
  /** Worst accepted fill vs the quote, basis points. Default 3000: the fill is priced at timelock release. */
  slippageBps?: bigint;
};

/**
 * The full agent on the mock: a trend-following trader buys the risk asset into a rally, the runner
 * banks the principal once equity doubles (the trader raising the cash first), and the drawdown that
 * follows only burns house money. Steppable, like `HouseMoneySimulation`.
 */
export class TradingSimulation {
  readonly api = new MockAgentApi([]);
  readonly log = new EventLog();
  readonly timeline: TradingSnapshot[] = [];
  readonly principalAtomic: bigint;
  readonly timelockMs: number;
  readonly prices: number[];
  runner!: HouseMoneyRunner;
  trader!: Trader;
  token!: string;
  index = 0;

  constructor(private opts: TradingOptions = {}) {
    this.principalAtomic = opts.principalAtomic ?? 1_000_000_000n;
    this.timelockMs = opts.timelockMs ?? 3_000;
    this.prices = opts.prices ?? pricePath();
  }

  get done() {
    return this.index >= this.prices.length;
  }
  get grant() {
    return this.api.forGrant(this.token);
  }

  private tokens(price: number) {
    const now = this.api.clock.date();
    return [token(TRADE_STABLE, "USDC", 6, 1, now), token(TRADE_RISK, "wNEAR", 24, price, now)];
  }

  async init() {
    const { api, principalAtomic: principal } = this;
    api.setTokens(this.tokens(1));
    api.createAgent(
      TRADE_AGENT,
      { [TRADE_STABLE]: principal },
      buildHouseMoneyPolicy({
        asset: TRADE_STABLE,
        principalAtomic: principal,
        chain: "base",
        safeAddress: TRADE_SAFE,
        timelockMs: this.timelockMs,
        trading: { assets: { [TRADE_RISK]: (10n ** 30n).toString() } },
      }),
    );
    this.token = (await api.issueGrant(TRADE_AGENT, "house-money:trader", new Date(api.clock.now() + 86_400_000))).token;
    const store = new MemoryStateStore();
    const now = () => api.clock.date();
    this.runner = new HouseMoneyRunner({
      client: api,
      grant: this.grant,
      agentId: TRADE_AGENT,
      asset: TRADE_STABLE,
      principalAtomic: principal,
      principalMicroUsd: principal,
      chain: "base",
      safeAddress: TRADE_SAFE,
      store,
      sealAfterSettlement: this.opts.sealAfterSettlement,
      log: this.log,
      now,
    });
    this.trader = new Trader({
      client: api,
      grant: this.grant,
      agentId: TRADE_AGENT,
      stableAsset: TRADE_STABLE,
      riskAsset: TRADE_RISK,
      principalAtomic: principal,
      principalMicroUsd: principal,
      strategy: new TrendStrategy({ alpha: 0.3, band: 0.01 }),
      store,
      log: this.log,
      now,
      maxStableSwap: principal,
      // The fill is priced when the timelock releases, not now, so min_amount_out only guards against a disaster.
      slippageBps: this.opts.slippageBps ?? 3_000n,
    });
    await this.snap(1);
    return this;
  }

  async step(): Promise<boolean> {
    if (this.done) return false;
    const price = this.prices[this.index]!;
    this.api.setTokens(this.tokens(price));
    this.api.advance(1000); // releases any swap or withdrawal whose timelock is due, at this step's price
    await this.trader.step();
    await this.runner.tick();
    this.index++;
    await this.snap(price);
    return !this.done;
  }

  async runToEnd() {
    while (await this.step());
    return this;
  }

  get bankedMicroUsd() {
    return this.api.settled.reduce((s, o) => s + BigInt(o.request.amount), 0n);
  }

  private async snap(price: number) {
    const { balances } = await this.grant.getBalances(TRADE_AGENT);
    const tokens = this.tokens(price);
    const equity = portfolioValueMicroUsd(balances, tokens, this.api.clock.date());
    const riskValue = portfolioValueMicroUsd({ [TRADE_RISK]: balances[TRADE_RISK] ?? "0" }, tokens, this.api.clock.date());
    this.timeline.push({
      t: this.index,
      priceUsd: price,
      equityMicroUsd: equity,
      bankedMicroUsd: this.bankedMicroUsd,
      riskShare: equity === 0n ? 0 : Number((riskValue * 1000n) / equity) / 1000,
    });
  }
}
