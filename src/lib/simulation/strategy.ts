/** Deterministic strategy returns for the simulation. Pure functions; no I/O. */

export type Step = { kind: "gain"; addAtomic: bigint } | { kind: "loss"; keepBps: bigint } | { kind: "hold" };

/**
 * Gain phase: `steps` equal additions summing to exactly `gainAtomic` (so equity reaches 2.0x of
 * principal when gainAtomic == principal). Loss phase: `lossSteps` multiplicative cuts whose
 * compounded keep-ratio is ~(1 - lossPct). Rounding is irrelevant for a simulation.
 */
export function buildScenario(opts: {
  gainAtomic: bigint;
  gainSteps: number;
  lossPct: number;
  lossSteps: number;
}): Step[] {
  const steps: Step[] = [];
  const each = opts.gainAtomic / BigInt(opts.gainSteps);
  const remainder = opts.gainAtomic - each * BigInt(opts.gainSteps);
  for (let i = 0; i < opts.gainSteps; i++) {
    steps.push({ kind: "gain", addAtomic: i === opts.gainSteps - 1 ? each + remainder : each });
  }
  const perStepKeep = Math.pow(1 - opts.lossPct, 1 / opts.lossSteps);
  const keepBps = BigInt(Math.round(perStepKeep * 10_000));
  for (let i = 0; i < opts.lossSteps; i++) steps.push({ kind: "loss", keepBps });
  return steps;
}

export function applyStep(balance: bigint, step: Step): bigint {
  switch (step.kind) {
    case "gain":
      return balance + step.addAtomic;
    case "loss":
      return (balance * step.keepBps) / 10_000n;
    case "hold":
      return balance;
  }
}
