import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { MockAgentApi } from "@/lib/agent-api/mock";
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
    await assert.rejects(house.withdraw(AGENT, req({ asset: "nep141:other" }), { idempotencyKey: "k" }), code("policy_asset_denied"));
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
    await assert.rejects(house.withdraw(AGENT, req({ amount: "1" }), { idempotencyKey: "k5" }), code("policy_rate_limited"));
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
    await assert.rejects(g.getBalances(AGENT), code("grant_revoked"));

    const { token: t2 } = await api.issueGrant(AGENT, "tmp2", new Date(api.clock.now() + 1000));
    api.advance(1001);
    await assert.rejects(api.forGrant(t2).getBalances(AGENT), code("grant_expired"));
    await assert.rejects(api.forGrant("ngt_bogus").getBalances(AGENT), code("grant_invalid"));
  });

  it("guards policy edits with expected_revision", async () => {
    await assert.rejects(api.updatePolicy(AGENT, policy(), 0), code("policy_revision_conflict"));
    assert.deepEqual(await api.updatePolicy(AGENT, policy({ frozen: true }), 1), { revision: 2 });
    await assert.rejects(house.withdraw(AGENT, req(), { idempotencyKey: "k" }), code("agent_frozen"));
  });
});
