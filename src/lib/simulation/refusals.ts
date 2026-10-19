import { AgentApiError } from "@/lib/errors";
import { principalKey } from "@/lib/risk/trigger";
import { SIM_AGENT, SIM_ASSET, SIM_SAFE, type HouseMoneySimulation } from "@/lib/simulation/scenario";

export type RefusalCheck = {
  id: string;
  label: string;
  /** Error code the policy must answer with, or "replay" when the same operation must come back. */
  expected: string;
  got: string;
  pass: boolean;
};

type Attempt = () => Promise<unknown>;

async function code(fn: Attempt): Promise<string> {
  try {
    await fn();
    return "allowed";
  } catch (e) {
    return e instanceof AgentApiError ? e.code : `unexpected: ${String(e)}`;
  }
}

/**
 * The simulation's refusal matrix, run against whatever state the scenario is in. Order matters: the
 * rate-limit probe goes last because it consumes the agent's hourly action budget (its probes
 * are 1-atom withdrawals to the safe account, which the policy permits).
 */
export async function runRefusalMatrix(s: HouseMoneySimulation): Promise<RefusalCheck[]> {
  const g = s.grant;
  const P = s.principalAtomic;
  const out: RefusalCheck[] = [];
  const check = (id: string, label: string, expected: string, got: string) =>
    out.push({ id, label, expected, got, pass: expected === got });

  const withdraw = (over: Partial<{ amount: string; chain: string; recipient: string; asset: string; memo: string | null }>, key: string) =>
    g.withdraw(
      SIM_AGENT,
      { asset: SIM_ASSET, amount: P.toString(), chain: "base", recipient: SIM_SAFE, ...over },
      { idempotencyKey: key },
    );

  check("reverse", "“Give me my money back” (transfer out)", "policy_action_denied",
    await code(() => g.transfer(SIM_AGENT, { asset: SIM_ASSET, amount: "1", recipient: "owner.near" })));

  check("other-address", "Withdraw to another address", "policy_destination_denied",
    await code(() => withdraw({ recipient: "0xATTACKER" }, "m-addr")));

  check("other-chain", "Withdraw to the safe address on another chain", "policy_destination_denied",
    await code(() => withdraw({ chain: "near" }, "m-chain")));

  check("memo", "Withdraw with an unlisted memo", "policy_destination_denied",
    await code(() => withdraw({ memo: "sneaky" }, "m-memo")));

  check("other-asset", "Withdraw an asset outside the allowlist", "policy_denied",
    await code(() => withdraw({ asset: "nep141:other" }, "m-asset")));

  check("over-cap", "Withdraw principal + 1", "policy_limit_exceeded",
    await code(() => withdraw({ amount: (P + 1n).toString() }, "m-cap")));

  // Only meaningful once the exit exists; the runner's persisted state holds its operation id.
  const original = (await s.store.load()).withdrawalId;
  if (original) {
    let replayed: string;
    try {
      replayed = (await withdraw({}, principalKey(SIM_AGENT))).correlation_id === original ? "replay" : "new-operation";
    } catch (e) {
      replayed = e instanceof AgentApiError ? e.code : String(e);
    }
    check("replay", "Replay the principal exit (same key)", "replay", replayed);
  }

  const { token } = await s.api.issueGrant(SIM_AGENT, "matrix-revoked", new Date(s.api.clock.now() + 60_000));
  await s.api.revokeGrant(SIM_AGENT, token);
  check("revoked", "Use a revoked grant", "agent_grant_required",
    await code(() => s.api.forGrant(token).getBalances(SIM_AGENT)));

  let rate = "never-limited";
  for (let i = 0; i < 10; i++) {
    const r = await code(() => withdraw({ amount: "1" }, `m-rate-${i}`));
    if (r === "policy_action_limit_exceeded") { rate = r; break; }
    if (r !== "allowed" && r !== "insufficient_balance") { rate = r; break; }
  }
  check("rate", "Exceed 5 actions in an hour", "policy_action_limit_exceeded", rate);

  return out;
}
