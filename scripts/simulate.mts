/**
 * Headless run of the 60-second House Money simulation on the mock Agent API.
 *   npm run simulate              fast (no waiting)
 *   npm run simulate -- --realtime  1 simulated second = 1 real second (the live pacing)
 * Exits non-zero if the story or any refusal check does not hold.
 */
import { HouseMoneySimulation, SIM_SAFE } from "@/lib/simulation/scenario";
import { TradingSimulation } from "@/lib/simulation/trading";
import { runRefusalMatrix } from "@/lib/simulation/refusals";

const realtime = process.argv.includes("--realtime");
const usdc = (a: bigint) => `${(Number(a) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const started = Date.now();
const wall = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;

const s = await new HouseMoneySimulation().init();
const P = s.principalAtomic;
const policy = (await s.api.getPolicy("agent-house-money")).policy!;
console.log("House Money simulation (mock Agent API)");
console.log(`  policy: withdraw only -> ${SIM_SAFE.slice(0, 10)}… on base, cap ${usdc(P)}/tx, veto ${policy.timelock_ms / 1000}s\n`);

const seen = new Set<unknown>();
let failures = 0;
const assert = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`);
  if (!ok) failures++;
};

while (await s.step()) {
  const snap = s.timeline[s.timeline.length - 1]!;
  for (const e of s.log.events) {
    if (seen.has(e) || e.type === "tick") continue;
    seen.add(e);
    const msg =
      e.type === "trigger" ? `gains cover the principal -> banking ${usdc(P)}`
      : e.type === "withdraw_queued" ? `exit queued, owner veto window open`
      : e.type === "withdraw_settled" ? `principal settled to the safe account`
      : `${e.type}`;
    console.log(`[t=${String(snap.t).padStart(2)}s | wall ${wall()}] ${msg}`);
  }
  if (snap.t % 10 === 0)
    console.log(`[t=${String(snap.t).padStart(2)}s] equity ${usdc(snap.equityAtomic).padStart(14)} | banked ${usdc(snap.bankedAtomic).padStart(14)}${snap.countdownSec !== null ? ` | exit in ${snap.countdownSec}s` : ""}`);
  if (realtime) await sleep(1000);
}

const last = s.timeline[s.timeline.length - 1]!;
const peak = s.timeline.reduce((m, x) => (x.equityAtomic > m ? x.equityAtomic : m), 0n);
console.log("\nOutcome checks");
assert(peak >= 2n * P, `portfolio doubled (peak ${usdc(peak)})`);
assert(s.api.settled.length === 1, "principal exit executed exactly once");
assert(s.api.settled[0]?.request.amount === P.toString() && s.api.settled[0]?.request.recipient === SIM_SAFE, `exit was exactly ${usdc(P)} to the safe account`);
assert(last.bankedAtomic === P, `banked ${usdc(last.bankedAtomic)}`);
assert(last.equityAtomic < P, `red day burned only house money (${usdc(last.equityAtomic)} left)`);

console.log("\nRefusal matrix");
for (const c of await runRefusalMatrix(s)) assert(c.pass, `${c.label} -> ${c.got}`);

console.log("\nTrading agent (trend following through the policy)");
const t = await new TradingSimulation().init();
await t.runToEnd();
const tLast = t.timeline[t.timeline.length - 1]!;
assert(t.api.swaps.length >= 3, `the agent traded (${t.api.swaps.length} swaps filled)`);
assert(t.api.settled.length === 1 && t.api.settled[0]?.request.amount === t.principalAtomic.toString(), "principal exit executed exactly once, for exactly the principal");
assert(t.log.ofType("trigger").length === 1, "one trigger");
assert(tLast.bankedMicroUsd === t.principalAtomic, `banked ${usdc(tLast.bankedMicroUsd)}`);
assert(tLast.equityMicroUsd >= t.principalAtomic, `stake still whole after the drawdown (${usdc(tLast.equityMicroUsd)} left in the agent)`);

console.log(`\n${failures === 0 ? "ALL CHECKS HELD" : `${failures} CHECK(S) FAILED`} in ${wall()} wall time`);
process.exit(failures === 0 ? 0 : 1);
