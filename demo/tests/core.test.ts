import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHouseMoneyPolicy,
  portfolioValueMicroUsd,
  PriceUnavailableError,
  principalKey,
  shouldBankPrincipal,
  usdToMicro,
  type TokenInfo,
} from "../src/core/index.js";

const USDC = "nep141:usdc-test";
const NOW = new Date("2026-10-19T12:00:00Z");
const token = (over: Partial<TokenInfo> = {}): TokenInfo => ({
  asset_id: USDC,
  symbol: "USDC",
  decimals: 6,
  blockchain: "near",
  price: 1,
  price_updated_at: "2026-10-19T11:55:00Z",
  price_expires_at: "2026-10-19T12:05:00Z",
  ...over,
});

describe("buildHouseMoneyPolicy", () => {
  const policy = buildHouseMoneyPolicy({ asset: USDC, principalAtomic: 1000n, chain: "base", safeAddress: "0xsafe" });
  it("allows only withdraw, one asset, one destination", () => {
    assert.deepEqual(policy.actions, ["withdraw"]);
    assert.deepEqual(policy.assets, [USDC]);
    assert.equal(policy.destinations.mode, "only");
    assert.equal(policy.destinations.list.length, 1);
    assert.equal(policy.destinations.list[0]!.address, "0xsafe");
  });
  it("caps per-transaction at exactly the principal and defaults to a 1h timelock", () => {
    assert.equal(policy.limits.per_transaction![USDC], "1000");
    assert.equal(policy.timelock_ms, 3_600_000);
    assert.equal(policy.max_actions_per_hour, 5);
  });
  it("rejects a non-positive principal", () => {
    assert.throws(() => buildHouseMoneyPolicy({ asset: USDC, principalAtomic: 0n, chain: "base", safeAddress: "0x" }));
  });
});

describe("usdToMicro", () => {
  it("converts without float drift", () => {
    assert.equal(usdToMicro(0.999785), 999_785n);
    assert.equal(usdToMicro("12.5"), 12_500_000n);
    assert.equal(usdToMicro(1), 1_000_000n);
  });
});

describe("portfolioValueMicroUsd", () => {
  it("prices balances by decimals", () => {
    assert.equal(portfolioValueMicroUsd({ [USDC]: "2500000" }, [token({ price: 0.999785 })], NOW), 2_499_462n);
  });
  it("ignores zero balances even if unpriced", () => {
    assert.equal(portfolioValueMicroUsd({ other: "0" }, [], NOW), 0n);
  });
  it("fails closed on a stale price", () => {
    assert.throws(
      () => portfolioValueMicroUsd({ [USDC]: "1" }, [token({ price_expires_at: "2026-10-19T11:59:59Z" })], NOW),
      (e) => e instanceof PriceUnavailableError && e.code === "spend_price_unavailable",
    );
  });
  it("fails closed on a missing or null price", () => {
    assert.throws(() => portfolioValueMicroUsd({ x: "1" }, [], NOW), PriceUnavailableError);
    assert.throws(() => portfolioValueMicroUsd({ [USDC]: "1" }, [token({ price: null })], NOW), PriceUnavailableError);
  });
});

describe("shouldBankPrincipal", () => {
  const principal = 1_000_000n;
  it("is false just below 2x, true at exactly 2x and above", () => {
    assert.equal(shouldBankPrincipal({ equity: 1_999_999n, principal, banked: false }), false);
    assert.equal(shouldBankPrincipal({ equity: 2_000_000n, principal, banked: false }), true);
    assert.equal(shouldBankPrincipal({ equity: 5_000_000n, principal, banked: false }), true);
  });
  it("never fires once banked", () => {
    assert.equal(shouldBankPrincipal({ equity: 9_000_000n, principal, banked: true }), false);
  });
  it("supports a lower multiple for live low-funds spikes", () => {
    assert.equal(shouldBankPrincipal({ equity: 1_100_000n, principal, banked: false, multiple: 1n }), true);
  });
  it("uses a fixed key per agent, not per date", () => {
    assert.equal(principalKey("a1"), "principal:a1");
  });
});
