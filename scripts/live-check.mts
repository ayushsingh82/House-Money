/**
 * Read-only check of the real NEAR Intents Agent API. Moves no funds and signs nothing.
 *   npm run live:check
 * Without NEAR_INTENTS_AGENT_API_KEY it still checks the public endpoints (network, token catalog);
 * with a key it also validates the key and reports your quota.
 */
import { createAgentApi } from "@near-intents-agent-api/sdk";
import { LiveAgentApi } from "@/lib/agent-api/live";
import { portfolioValueMicroUsd } from "@/lib/risk/pricing";

const key = process.env.NEAR_INTENTS_AGENT_API_KEY;
const apiKey = key ?? `naa_${"0".repeat(43)}`; // well-formed placeholder: public endpoints ignore it
const sdk = createAgentApi({ apiKey });
const live = new LiveAgentApi({ apiKey, owner: { sign: async () => { throw new Error("read-only check: no signing"); } } });

const network = await sdk.getNetwork();
console.log(`network: ${network.network}, overall status: ${network.status.overall}`);
for (const c of network.status.components) console.log(`  ${c.id}: ${c.status}`);

const tokens = await live.getTokens();
const usdc = tokens.filter((t) => t.symbol === "USDC");
console.log(`\ntoken catalog: ${tokens.length} assets, ${usdc.length} USDC variants`);
for (const t of usdc.slice(0, 4)) console.log(`  ${t.blockchain.padEnd(8)} ${t.asset_id.slice(0, 60)}  price ${t.price}  expires ${t.price_expires_at}`);

const near = usdc.find((t) => t.blockchain === "near");
if (near) {
  const value = portfolioValueMicroUsd({ [near.asset_id]: "1000000000" }, tokens);
  console.log(`\n1,000 NEAR-USDC priced by the runner's own pricing: $${Number(value) / 1e6}`);
}

if (key) {
  const who = await sdk.whoami();
  console.log("\nAPI key accepted:", JSON.stringify(who).slice(0, 200));
} else {
  console.log("\nNo NEAR_INTENTS_AGENT_API_KEY set: skipped whoami. Set it to validate your key.");
}
