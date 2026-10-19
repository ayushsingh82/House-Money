# Experiment 18 — House Money

**Proposer:** Joe
**Theme:** Treasury

## Details

**Build in such a way that…**
Once the agent's gains equal the principal the owner put in, the principal withdraws itself to a
safe account — automatically, exactly once. Everything after that trades with the house's money:
the worst case is already banked, and no future prompt, market crash or compromised strategy can
touch it.

**For a trader, to be able to run an autonomous strategy that banks its own principal the moment
it's covered, and only ever risks house money after that.**

**To handle these use cases:**
- "Take my initial stake off the table" executed the moment gains cover it, then never re-risked
- Continuous trading where drawdowns can only burn unrealized gains, never the banked principal
- A one-way door: the safe account receives, nothing ever comes back

## Configurations (specific to Agent Connect)

**Whitelist on an agreement that is made:**
The safe account is the one permanent destination in the policy — the agreement is "principal
leaves once, to here, never returns". The per-transaction cap is the principal amount, so even
the withdrawal itself is bounded; the timelock gives the owner a veto window on the exit.

```ts
const api = new AgentApi({ apiKey: NAA_KEY, baseUrl: API_ORIGIN });

// 1) The house-money rule, signed once: one destination, one size, one veto window
await api.generateIntent({
  type: "policy_update",
  agent_id: tradingAgent.id,
  expected_revision: currentRevision,
  policy: {
    frozen: false,
    actions: ["withdraw"],
    confidential: false,
    owner_approval: false,
    assets: ["nep141:usdc.near"],        // from GET /v1/tokens
    limits: { per_transaction: { "nep141:usdc.near": initialPrincipalAtomic } }, // exactly the stake
    max_actions_per_hour: 5,
    destinations: { mode: "only", list: [
      { action: "withdraw", chain: "base", address: safeAccountAddress, memo: null }, // the only exit
    ] },
    budget: { daily_usd: null, weekly_usd: null, monthly_usd: null },
    timelock_ms: 3_600_000,              // 1h veto window on the principal exit
  },
});

// 2) One grant for the strategy — revocable alone; grants carry no permissions
const { token, commitment } = createGrantCredential();
await api.generateIntent({
  type: "grant_issue", agent_id: tradingAgent.id, label: "house-money:runner",
  credential: commitment, expires_at: horizonEnd.toISOString(),
});
const house = api.forGrant(token);

// 3) The agent prices its own portfolio and banks the principal exactly once
const { balances } = await api.getBalances(tradingAgent.id, { source: "public" });
const equity = await portfolioValueUsd(balances); // agent prices via GET /v1/tokens
if (gte(equity, mul(initialPrincipal, 2))) { // principal + equal gains → bank the principal
  await house.withdraw(tradingAgent.id, {
    asset: "nep141:usdc.near",
    amount: initialPrincipalAtomic, // exactly the stake, never more — the policy caps it anyway
    chain: "base",
    recipient: safeAccountAddress,
  }, { idempotencyKey: `principal:${isoDate}` }); // QUEUED for 1h; cancellable; replay-proof
}
// After this settles, every remaining dollar in the agent is house money.
```

**Notes / constraints:** The principal exit is a one-time event — the idempotency key makes it
replay-proof, and the per-transaction cap stays at the principal amount forever, so the worst
future withdrawal is bounded. Stale or unpriced assets fail closed in the budget check
(`spend_price_unavailable`), so portfolio pricing should read `GET /v1/tokens` with
`price_expires_at` in mind.

## Outcomes

- A 60-second demo: the portfolio doubles → the principal visibly moves to the safe account under
  a 1h countdown → trading continues on house money → a red day can't touch what's banked
- A mid-drawdown "give me my money back" reverse flow is refused — the safe account is not a
  source, only a destination
- The entire discipline is three signed numbers: one destination, one cap, one delay
