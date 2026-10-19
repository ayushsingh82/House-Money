/** 6-decimal atomic USDC -> "1,234.56". */
export function fmtUsdc(atomic: bigint, dp = 2): string {
  const whole = atomic / 1_000_000n;
  const frac = (atomic % 1_000_000n).toString().padStart(6, "0").slice(0, dp);
  return `${whole.toLocaleString("en-US")}${dp ? `.${frac}` : ""}`;
}

export const shortAddr = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;
