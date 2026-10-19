import type { Policy } from "@/lib/policy/types";

export type HouseMoneyPolicyInput = {
  /** Asset id from GET /v1/tokens. */
  asset: string;
  /** Exactly the owner's stake, in atomic units. */
  principalAtomic: bigint;
  chain: string;
  safeAddress: string;
  /** Veto window on the principal exit. Production: 3_600_000 (1h). */
  timelockMs?: number;
};

export const DEFAULT_TIMELOCK_MS = 3_600_000;

/** The house-money rule: one destination, one size, one veto window. */
export function buildHouseMoneyPolicy(input: HouseMoneyPolicyInput): Policy {
  if (input.principalAtomic <= 0n) throw new Error("principalAtomic must be positive");
  if (!input.safeAddress) throw new Error("safeAddress required");
  return {
    frozen: false,
    actions: ["withdraw"],
    confidential: false,
    owner_approval: false,
    assets: [input.asset],
    limits: { per_transaction: { [input.asset]: input.principalAtomic.toString() } },
    max_actions_per_hour: 5,
    destinations: {
      mode: "only",
      list: [{ action: "withdraw", chain: input.chain, address: input.safeAddress, memo: null }],
    },
    budget: { daily_usd: null, weekly_usd: null, monthly_usd: null },
    timelock_ms: input.timelockMs ?? DEFAULT_TIMELOCK_MS,
  };
}

/**
 * The same policy with `withdraw` removed. Applied after the principal has settled, it turns
 * "exactly once" from a runner convention into a policy fact: no grant, old or new, can withdraw again.
 */
export function buildSealedPolicy(policy: Policy): Policy {
  return { ...policy, actions: policy.actions.filter((a) => a !== "withdraw") };
}
