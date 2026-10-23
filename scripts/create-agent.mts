/**
 * Creates the owner's agent on the Agent API. Moves no funds: the agent starts empty.
 *   npm run live:create-agent
 *
 * Needs NEAR_INTENTS_AGENT_API_KEY, NEAR_OWNER_ACCOUNT_ID, NEAR_OWNER_PRIVATE_KEY, and optionally
 * NEAR_INTENTS_BASE_URL. The starting policy allows no withdrawals and no destinations; `live:run`
 * replaces it with the house-money policy. Prints the agent id to put in HOUSE_AGENT_ID.
 */
import { createAgentApi, type Policy } from "@near-intents-agent-api/sdk";
import { nearOwnerFromEnv } from "@/lib/agent-api/near-signer";

const apiKey = process.env.NEAR_INTENTS_AGENT_API_KEY;
if (!apiKey) {
  console.error("Missing NEAR_INTENTS_AGENT_API_KEY");
  process.exit(2);
}
const api = createAgentApi({ apiKey, baseUrl: process.env.NEAR_INTENTS_BASE_URL });
const owner = nearOwnerFromEnv();

const policy: Policy = {
  frozen: false,
  actions: ["swap"],
  confidential: false,
  owner_approval: false,
  assets: "any",
  limits: {},
  max_actions_per_hour: 5,
  destinations: { mode: "only", list: [] },
  budget: { daily_usd: "10", weekly_usd: null, monthly_usd: null },
  timelock_ms: 0,
};

const generated = await api.generateIntent({ type: "agent_create", name: process.env.HOUSE_AGENT_NAME ?? "house-money", owner: owner.owner, policy });
console.log(`Owner ${owner.owner.account_id}\nPolicy to sign:\n${JSON.stringify(generated.preview.policy, null, 2)}\n`);

const signedData = await owner.sign(generated);
await api.submitIntent({ type: generated.type, correlation_id: generated.correlation_id, signed_data: signedData });

for (;;) {
  const status = await api.getStatus(generated.correlation_id, { waitMs: 30_000 });
  console.log(`status: ${status.status}`);
  if (status.status === "SUCCESS") break;
  if (["FAILED", "NEEDS_REVIEW", "REFUNDED"].includes(status.status)) {
    console.error(`failed: ${status.failure_code ?? status.status}`);
    process.exit(1);
  }
}
console.log(`\nHOUSE_AGENT_ID=${generated.agent_id}`);
