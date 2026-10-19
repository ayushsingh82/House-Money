export type TriggerInput = {
  /** Current portfolio value, micro-USD. */
  equity: bigint;
  /** Original stake, micro-USD. */
  principal: bigint;
  /** Already banked (persisted by the runner). */
  banked: boolean;
  /** Gains-to-principal ratio needed: 2 means equity >= 2x principal (gains == principal). */
  multiple?: bigint;
};

/** Bank the principal once gains cover it: equity >= principal * multiple, and never twice. */
export function shouldBankPrincipal({ equity, principal, banked, multiple = 2n }: TriggerInput): boolean {
  if (banked || principal <= 0n) return false;
  return equity >= principal * multiple;
}

/** Fixed per-agent key: a second day cannot produce a second principal exit. */
export function principalKey(agentId: string): string {
  return `principal:${agentId}`;
}
