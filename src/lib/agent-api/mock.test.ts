import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { MockAgentApi, POLICY_COOLDOWN_MS } from "@/lib/agent-api/mock";
import { AgentApiError } from "@/lib/errors";
import { buildHouseMoneyPolicy } from "@/lib/policy/policy";
import { principalKey } from "@/lib/risk/trigger";

const USDC = "nep141:usdc-test";
const SAFE = "0xsafe";
const AGENT = "agent-1";
const PRINCIPAL = 1_000_000n;
const HOUR = 3_600_000;

let api: MockAgentApi;
let house: ReturnType<MockAgentApi["forGrant"]>;

const policy = (over = {}) => ({
  ...buildHouseMoneyPolicy({ asset: USDC, principalAtomic: PRINCIPAL, chain: "base", safeAddress: SAFE }),
  ...over,
});
const req = (over = {}) => ({ asset: USDC, amount: PRINCIPAL.toString(), chain: "base", recipient: SAFE, ...over });
const code = (c: string) => (e: unknown) => e instanceof AgentApiError && e.code === c;

beforeEach(async () => {
  api = new MockAgentApi([]);
  api.createAgent(AGENT, { [USDC]: 2_000_000n });
  await api.updatePolicy(AGENT, policy(), 0);
  const { token } = await api.issueGrant(AGENT, "runner", new Date(api.clock.now() + 86_400_000));
  house = api.forGrant(token);
});

describe("MockAgentApi policy enforcement", () => {
  it("queues the principal withdrawal under the timelock, then settles on release", async () => {
    const op = await house.withdraw(AGENT, req(), { idempotencyKey: principalKey(AGENT) });
    assert.equal(op.status, "QUEUED");
    assert.equal((await api.listScheduledExecutions(AGENT)).length, 1);
    api.advance(HOUR - 1);
    assert.equal((await api.getStatus(op.correlation_id)).status, "QUEUED");
    api.advance(1);
    assert.equal((await api.getStatus(op.correlation_id)).status, "SUCCESS");
    assert.deepEqual((await house.getBalances(AGENT)).balances[USDC], "1000000");
  });

  it("refuses a non-whitelisted destination", async () => {
    await assert.rejects(house.withdraw(AGENT, req({ recipient: "0xevil" }), { idempotencyKey: "k" }), code("policy_destination_denied"));
    await assert.rejects(house.withdraw(AGENT, req({ chain: "near" }), { idempotencyKey: "k2" }), code("policy_destination_denied"));
  });

  it("refuses principal + 1 (per-transaction cap)", async () => {
    await assert.rejects(house.withdraw(AGENT, req({ amount: (PRINCIPAL + 1n).toString() }), { idempotencyKey: "k" }), code("policy_limit_exceeded"));
  });

  it("refuses the reverse flow: transfer is not an allowed action", async () => {
    await assert.rejects(house.transfer(AGENT, { asset: USDC, amount: "1", recipient: "0xowner" }), code("policy_action_denied"));
  });

  it("refuses assets outside the allowlist", async () => {
    await assert.rejects(house.withdraw(AGENT, req({ asset: "nep141:other" }), { idempotencyKey: "k" }), code("policy_denied"));
  });

  it("replays an identical idempotency key without a second withdrawal", async () => {
    const a = await house.withdraw(AGENT, req(), { idempotencyKey: "same" });
    const b = await house.withdraw(AGENT, req(), { idempotencyKey: "same" });
    assert.equal(a.correlation_id, b.correlation_id);
    api.advance(HOUR);
    assert.equal(api.settled.length, 1);
  });

  it("rate-limits the 6th action within an hour", async () => {
    for (let i = 0; i < 5; i++) await house.withdraw(AGENT, req({ amount: "1" }), { idempotencyKey: `k${i}` });
    await assert.rejects(house.withdraw(AGENT, req({ amount: "1" }), { idempotencyKey: "k5" }), code("policy_action_limit_exceeded"));
    api.advance(HOUR + 1);
    await house.withdraw(AGENT, req({ amount: "1" }), { idempotencyKey: "k6" });
  });

  it("refuses when balance is insufficient at request time", async () => {
    api.setBalance(AGENT, USDC, 10n);
    await assert.rejects(house.withdraw(AGENT, req(), { idempotencyKey: "k" }), code("insufficient_balance"));
  });

  it("fails a queued op that can no longer be covered at release", async () => {
    const op = await house.withdraw(AGENT, req(), { idempotencyKey: "k" });
    api.setBalance(AGENT, USDC, 10n);
    api.advance(HOUR);
    const done = await api.getStatus(op.correlation_id);
    assert.equal(done.status, "FAILED");
    assert.equal(done.failure_code, "insufficient_balance");
  });

  it("lets the owner cancel during the veto window, and nothing moves", async () => {
    const op = await house.withdraw(AGENT, req(), { idempotencyKey: "k" });
    const cancelled = await api.cancelExecution(AGENT, op.correlation_id);
    assert.equal(cancelled.status, "CANCELLED");
    api.advance(HOUR);
    assert.equal((await house.getBalances(AGENT)).balances[USDC], "2000000");
    await assert.rejects(api.cancelExecution(AGENT, op.correlation_id), code("execution_not_cancellable"));
  });

  it("rejects revoked, expired and foreign grants", async () => {
    const { token } = await api.issueGrant(AGENT, "tmp", new Date(api.clock.now() + 1000));
    const g = api.forGrant(token);
    await api.revokeGrant(AGENT, token);
    await assert.rejects(g.getBalances(AGENT), code("agent_grant_required"));

    const { token: t2 } = await api.issueGrant(AGENT, "tmp2", new Date(api.clock.now() + 1000));
    api.advance(1001);
    await assert.rejects(api.forGrant(t2).getBalances(AGENT), code("agent_grant_required"));
    await assert.rejects(api.forGrant("ngt_bogus").getBalances(AGENT), code("agent_grant_required"));
  });

  it("guards policy edits with expected_revision", async () => {
    await assert.rejects(api.updatePolicy(AGENT, policy(), 0), code("policy_revision_conflict"));
    assert.deepEqual(await api.updatePolicy(AGENT, policy({ frozen: true }), 1), { revision: 2 });
    await assert.rejects(house.withdraw(AGENT, req(), { idempotencyKey: "k" }), code("wallet_frozen"));
  });
  it("refuses the same idempotency key with a different request body", async () => {
    await house.withdraw(AGENT, req({ amount: "5" }), { idempotencyKey: "k" });
    await assert.rejects(house.withdraw(AGENT, req({ amount: "6" }), { idempotencyKey: "k" }), code("idempotency_conflict"));
  });

  it("throttles ordinary policy edits for 10 minutes but lets a pure freeze through", async () => {
    const { policy, revision } = await api.getPolicy(AGENT);
    await assert.rejects(api.updatePolicy(AGENT, { ...policy!, timelock_ms: 1 }, revision!), code("policy_change_throttled"));
    api.advance(POLICY_COOLDOWN_MS);
    const { revision: next } = await api.updatePolicy(AGENT, { ...policy!, timelock_ms: 1 }, revision!);
    await api.updatePolicy(AGENT, { ...(await api.getPolicy(AGENT)).policy!, frozen: true }, next);
    await assert.rejects(house.withdraw(AGENT, req(), { idempotencyKey: "k" }), code("wallet_frozen"));
  });
});

describe("MockAgentApi swaps", () => {
  const A = "nep141:a";
  const B = "nep141:b";
  const tokens = (now: Date) => [
    { asset_id: A, symbol: "A", decimals: 6, blockchain: "near", price: 1, price_updated_at: now.toISOString(), price_expires_at: new Date(now.getTime() + 600_000).toISOString() },
    { asset_id: B, symbol: "B", decimals: 6, blockchain: "near", price: 2, price_updated_at: now.toISOString(), price_expires_at: new Date(now.getTime() + 600_000).toISOString() },
  ];
  const policy = (over: Record<string, unknown> = {}) =>
    ({ ...buildHouseMoneyPolicy({ asset: A, principalAtomic: 1_000_000n, chain: "base", safeAddress: "0xS", timelockMs: 0, trading: { assets: { [B]: "5000000" } } }), ...over }) as ReturnType<typeof buildHouseMoneyPolicy>;
  async function setup(p = policy()) {
    const api = new MockAgentApi([]);
    api.setTokens(tokens(api.clock.date()));
    api.createAgent("x", { [A]: 1_000_000n }, p);
    const { token } = await api.issueGrant("x", "t", new Date(api.clock.now() + 1e6));
    return { api, g: api.forGrant(token) };
  }

  it("quotes at catalog prices less the fee, and executes immediately without a timelock", async () => {
    const { api, g } = await setup();
    assert.equal((await g.quote("x", { origin_asset: A, destination_asset: B, amount: "1000000" })).amountOut, "498500");
    const op = await g.swap("x", { origin_asset: A, destination_asset: B, amount: "1000000" }, { idempotencyKey: "swap-key-1" });
    assert.equal(op.status, "SUCCESS");
    assert.equal(op.swap?.amountOut, "498500");
    assert.equal((await g.getBalances("x")).balances[B], "498500");
    assert.equal(api.swaps.length, 1);
  });

  it("queues behind the timelock like any money action, and re-prices at release", async () => {
    const { api, g } = await setup(policy({ timelock_ms: 5_000 }));
    const op = await g.swap("x", { origin_asset: A, destination_asset: B, amount: "1000000" }, { idempotencyKey: "swap-key-2" });
    assert.equal(op.status, "QUEUED");
    api.setTokens(tokens(api.clock.date()).map((t) => (t.asset_id === B ? { ...t, price: 4 } : t)));
    api.advance(5_000);
    assert.equal((await api.getStatus(op.correlation_id)).swap?.amountOut, "249250");
  });

  it("fails at release when the fill is worse than min_amount_out", async () => {
    const { api, g } = await setup(policy({ timelock_ms: 5_000 }));
    const op = await g.swap("x", { origin_asset: A, destination_asset: B, amount: "1000000", min_amount_out: "490000" }, { idempotencyKey: "swap-key-3" });
    api.setTokens(tokens(api.clock.date()).map((t) => (t.asset_id === B ? { ...t, price: 4 } : t)));
    api.advance(5_000);
    const done = await api.getStatus(op.correlation_id);
    assert.equal(done.status, "FAILED");
    assert.equal(done.failure_code, "min_amount_out_not_met");
    assert.equal((await g.getBalances("x")).balances[A], "1000000");
  });

  it("refuses swaps the policy does not allow, with the API's codes", async () => {
    const code = async (fn: () => Promise<unknown>) => {
      try { await fn(); } catch (e) { return (e as { code: string }).code; }
    };
    const noSwap = await setup(buildHouseMoneyPolicyNoSwap());
    assert.equal(await code(() => noSwap.g.swap("x", { origin_asset: A, destination_asset: B, amount: "1" }, { idempotencyKey: "swap-key-4" })), "policy_action_denied");
    const { g } = await setup();
    assert.equal(await code(() => g.swap("x", { origin_asset: A, destination_asset: "nep141:zzz", amount: "1" }, { idempotencyKey: "swap-key-5" })), "policy_denied");
    assert.equal(await code(() => g.swap("x", { origin_asset: A, destination_asset: B, amount: "1000001" }, { idempotencyKey: "swap-key-6" })), "policy_limit_exceeded");
    assert.equal(await code(() => g.swap("x", { origin_asset: B, destination_asset: A, amount: "10" }, { idempotencyKey: "swap-key-7" })), "insufficient_balance");
  });

  it("replays the same key and refuses a different body under it", async () => {
    const { api, g } = await setup();
    const a = await g.swap("x", { origin_asset: A, destination_asset: B, amount: "100" }, { idempotencyKey: "swap-key-8" });
    const b = await g.swap("x", { origin_asset: A, destination_asset: B, amount: "100" }, { idempotencyKey: "swap-key-8" });
    assert.equal(a.correlation_id, b.correlation_id);
    assert.equal(api.swaps.length, 1);
    await assert.rejects(g.swap("x", { origin_asset: A, destination_asset: B, amount: "200" }, { idempotencyKey: "swap-key-8" }), (e: unknown) => (e as { code: string }).code === "idempotency_conflict");
  });
});

function buildHouseMoneyPolicyNoSwap() {
  return buildHouseMoneyPolicy({ asset: "nep141:a", principalAtomic: 1_000_000n, chain: "base", safeAddress: "0xS", timelockMs: 0 });
}
