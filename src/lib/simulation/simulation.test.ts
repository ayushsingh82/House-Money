import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyStep, buildScenario } from "@/lib/simulation/strategy";
import { SIM_ASSET, SIM_AGENT, SIM_SAFE, runHouseMoneyScenario } from "@/lib/simulation/scenario";

describe("strategy", () => {
  it("gain steps sum to exactly the target gain", () => {
    const steps = buildScenario({ gainAtomic: 1003n, gainSteps: 20, lossPct: 0.4, lossSteps: 10 });
    const bal = steps.slice(0, 20).reduce((b, s) => applyStep(b, s), 1000n);
    assert.equal(bal, 2003n);
  });
  it("loss steps compound to roughly the requested loss", () => {
    const steps = buildScenario({ gainAtomic: 0n, gainSteps: 1, lossPct: 0.4, lossSteps: 10 });
    const bal = steps.slice(1).reduce((b, s) => applyStep(b, s), 2_000_000n);
    assert.ok(bal > 1_190_000n && bal < 1_210_000n, String(bal));
  });
});

describe("house-money scenario (mock, full story)", () => {
  it("doubles, banks the principal once, and the red day only burns house money", async () => {
    const { api, timeline, log, principalAtomic } = await runHouseMoneyScenario();

    assert.equal(log.ofType("trigger").length, 1);
    assert.equal(log.ofType("withdraw_queued").length, 1);
    assert.equal(log.ofType("withdraw_settled").length, 1);

    assert.equal(api.settled.length, 1);
    assert.equal(api.settled[0]!.request.amount, principalAtomic.toString());
    assert.equal(api.settled[0]!.request.recipient, "0xSAFE000000000000000000000000000000000001");

    const last = timeline.at(-1)!;
    assert.equal(last.bankedAtomic, principalAtomic, "banked is exactly the stake");
    assert.ok(last.equityAtomic < principalAtomic, "remaining equity is house money only, below the stake");
    assert.equal(last.countdownSec, null);

    const peak = timeline.reduce((m, s) => (s.equityAtomic > m ? s.equityAtomic : m), 0n);
    assert.ok(peak >= 2n * principalAtomic);

    // Banked never decreases: the red day cannot touch it.
    for (let i = 1; i < timeline.length; i++) assert.ok(timeline[i]!.bankedAtomic >= timeline[i - 1]!.bankedAtomic);
  });

  it("shows a countdown while the exit is queued, then settles within the 60s run", async () => {
    const { timeline } = await runHouseMoneyScenario();
    const queued = timeline.filter((s) => s.countdownSec !== null);
    assert.ok(queued.length >= 20);
    assert.ok(queued[0]!.countdownSec! <= 30);
    assert.ok(timeline.at(-1)!.t <= 60);
  });

  it("a deep crash during the veto window leaves the exit unable to settle (documented caveat)", async () => {
    const { log, api } = await runHouseMoneyScenario({ lossPct: 0.7 });
    assert.equal(api.settled.length, 0);
    assert.equal(log.ofType("withdraw_failed").length, 1);
  });

  it("refuses the reverse flow and any other destination after banking", async () => {
    const { api } = await runHouseMoneyScenario();
    const { token } = await api.issueGrant(SIM_AGENT, "post", new Date(api.clock.now() + 1000));
    const g = api.forGrant(token);
    await assert.rejects(g.transfer(SIM_AGENT, { asset: SIM_ASSET, amount: "1", recipient: "0xowner" }), /policy_action_denied/);
    await assert.rejects(
      g.withdraw(SIM_AGENT, { asset: SIM_ASSET, amount: "1", chain: "base", recipient: "0xattacker" }, { idempotencyKey: "x" }),
      /policy_destination_denied/,
    );
  });
});

describe("house-money scenario with the post-bank seal", () => {
  it("seals the policy once the exit settles, so a second exit is impossible even with a new key", async () => {
    const { api, log } = await runHouseMoneyScenario({ sealAfterSettlement: true });
    assert.equal(log.ofType("withdraw_settled").length, 1);
    assert.equal(log.ofType("policy_sealed").length, 1);
    const { token } = await api.issueGrant(SIM_AGENT, "post", new Date(api.clock.now() + 1000));
    await assert.rejects(
      api.forGrant(token).withdraw(SIM_AGENT, { asset: SIM_ASSET, amount: "1", chain: "base", recipient: SIM_SAFE }, { idempotencyKey: "second-exit" }),
      /policy_action_denied/,
    );
  });
});

