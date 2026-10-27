/**
 * Runs House Money against the real Agent API on mainnet. REAL FUNDS.
 *   npm run live:run              prints the plan and the policy it would sign; sends nothing
 *   HOUSE_CONFIRM=spend-real-funds npm run live:run
 *
 * Needs Node.js 24+, an existing agent funded with the stake asset, and:
 *   NEAR_INTENTS_AGENT_API_KEY   naa_... key
 *   NEAR_OWNER_ACCOUNT_ID, NEAR_OWNER_PRIVATE_KEY   the agent's owner (use a dedicated, low-value account)
 *   NEAR_INTENTS_BASE_URL        optional API base URL (default: the hosted API)
 *   HOUSE_AGENT_ID               64-hex agent id
 *   HOUSE_ASSET                  stake asset id from GET /v1/tokens (e.g. NEAR USDC)
 *   HOUSE_PRINCIPAL              stake in whole units of that asset (e.g. 5)
 *   HOUSE_SAFE_CHAIN, HOUSE_SAFE_ADDRESS   where the principal goes (e.g. base, 0x...)
 * Optional:
 *   HOUSE_MULTIPLE_BPS           trigger in basis points; 20000 = 2x (default). Mainnet gains cannot be
 *                                simulated, so lower it (e.g. 10100) to watch the exit happen
 *   HOUSE_TIMELOCK_MS            veto window (default 3600000 = 1h)
 *   HOUSE_RISK_ASSET             also let the agent trade this asset (adds `swap` to the policy)
 *   HOUSE_SEAL=1                 drop `withdraw` from the policy once the exit settles
 */
import { LiveAgentApi } from "@/lib/agent-api/live";
import { nearOwnerFromEnv } from "@/lib/agent-api/near-signer";
import { buildHouseMoneyPolicy } from "@/lib/policy/policy";
import { portfolioValueMicroUsd } from "@/lib/risk/pricing";
import { FileStateStore } from "@/lib/runner/file-store";
import { EventLog } from "@/lib/runner/events";
import { HouseMoneyRunner } from "@/lib/runner/runner";
import { Trader } from "@/lib/strategy/trader";
import { TrendStrategy } from "@/lib/strategy/trend";

const need = (name: string) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. See the header of scripts/live-run.mts.`);
    process.exit(2);
  }
  return v;
};

const apiKey = need("NEAR_INTENTS_AGENT_API_KEY");
const agentId = need("HOUSE_AGENT_ID");
const asset = need("HOUSE_ASSET");
const principalWhole = need("HOUSE_PRINCIPAL");
const chain = need("HOUSE_SAFE_CHAIN");
const rawSafeAddress = need("HOUSE_SAFE_ADDRESS");
const safeAddress = /^0x[0-9a-fA-F]{40}$/.test(rawSafeAddress) ? rawSafeAddress.toLowerCase() : rawSafeAddress; // the API requires canonical lowercase EVM addresses
const multipleBps = BigInt(process.env.HOUSE_MULTIPLE_BPS ?? "20000");
const timelockMs = Number(process.env.HOUSE_TIMELOCK_MS ?? "3600000");
const riskAsset = process.env.HOUSE_RISK_ASSET;
const confirmed = process.env.HOUSE_CONFIRM === "spend-real-funds";

const owner = nearOwnerFromEnv();
const live = new LiveAgentApi({ apiKey, baseUrl: process.env.NEAR_INTENTS_BASE_URL, owner });
const tokens = await live.getTokens();
const stake = tokens.find((t) => t.asset_id === asset);
if (!stake || stake.price === null) throw new Error(`${asset} is not priced in the token catalog`);
const [whole = "0", frac = ""] = principalWhole.split(".");
const principalAtomic = BigInt(whole) * 10n ** BigInt(stake.decimals) + BigInt((frac + "0".repeat(stake.decimals)).slice(0, stake.decimals));
const principalMicroUsd = portfolioValueMicroUsd({ [asset]: principalAtomic.toString() }, tokens);

const policy = buildHouseMoneyPolicy({
  asset,
  principalAtomic,
  chain,
  safeAddress,
  timelockMs,
  ...(riskAsset ? { trading: { assets: { [riskAsset]: (principalAtomic * 1000n).toString() } } } : {}),
});

console.log(`Agent        ${agentId}`);
console.log(`Owner        ${owner.owner.account_id} (${owner.publicKey})`);
console.log(`Stake        ${principalWhole} ${stake.symbol} ≈ $${Number(principalMicroUsd) / 1e6}`);
console.log(`Safe         ${safeAddress} on ${chain}`);
console.log(`Trigger      ${Number(multipleBps) / 10_000}x equity   Timelock ${timelockMs / 1000}s ${riskAsset ? "(also delays every swap)" : ""}`);
console.log(`Policy to sign:\n${JSON.stringify(policy, null, 2)}\n`);

if (!confirmed) {
  console.log("Dry run: nothing was signed or sent. Re-run with HOUSE_CONFIRM=spend-real-funds to proceed.");
  process.exit(0);
}

if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error(`The Agent API SDK declares Node.js 24+; this is ${process.version}. Upgrade before spending real funds.`);
  process.exit(2);
}

const current = await live.getPolicy(agentId);
console.log(`Signing policy_update (revision ${current.revision ?? 0})…`);
await live.updatePolicy(agentId, policy, current.revision ?? 0);
console.log("Issuing a 24h grant to the runner…");
const { token } = await live.issueGrant(agentId, "house-money:runner", new Date(Date.now() + 86_400_000));
const grant = live.forGrant(token);

const store = new FileStateStore(`.house-state/${agentId}.json`);
const log = new EventLog();
log.subscribe((e) => e.type !== "tick" && console.log(new Date().toISOString(), JSON.stringify(e)));
const runner = new HouseMoneyRunner({ client: live, grant, agentId, asset, principalAtomic, principalMicroUsd, chain, safeAddress, store, log, multipleBps, sealAfterSettlement: process.env.HOUSE_SEAL === "1" });
const trader = riskAsset
  ? new Trader({ client: live, grant, agentId, stableAsset: asset, riskAsset, principalAtomic, principalMicroUsd, strategy: new TrendStrategy(), store, log, multipleBps, maxStableSwap: principalAtomic, slippageBps: 1_000n })
  : null;

const abort = new AbortController();
process.on("SIGINT", () => {
  console.log("\nStopping. The grant stays valid until it expires or you revoke it; the policy stays in force.");
  abort.abort();
});
console.log("Running. Ctrl-C to stop.");
while (!abort.signal.aborted) {
  try {
    await trader?.step();
    await runner.tick();
  } catch (e) {
    console.error("tick failed:", e instanceof Error ? e.message : e);
  }
  await new Promise((r) => setTimeout(r, 30_000));
}
