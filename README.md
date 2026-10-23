# House Money

Policy-enforced principal protection for autonomous trading agents, built on the NEAR Intents Agent API.

An agent trades with an owner's capital. The moment its gains equal the principal, the principal
withdraws itself to a safe account, automatically and exactly once. Everything after that is the
house's money: the worst case is already banked, and no later prompt, market crash or compromised
strategy can reach it.

*Experiment 18, Treasury theme.*

| | |
|---|---|
| **Stack** | Next.js (App Router), React, Tailwind CSS v4, TypeScript |
| **Integration** | `@near-intents-agent-api/sdk` (real client) and a policy-enforcing mock |
| **Verification** | 86 unit tests, a 22-check browser test, a headless end-to-end simulation |
| **Status** | Complete on the mock, including a trading agent. The live mainnet run is built and guarded but has not been executed (see [Going live](#going-live)) |

## Contents

1. [Overview](#overview)
2. [How it works](#how-it-works)
3. [Safety model](#safety-model)
4. [Getting started](#getting-started)
5. [Scripts](#scripts)
6. [Project structure](#project-structure)
7. [Testing](#testing)
8. [Demonstration](#demonstration)
9. [Known limitations](#known-limitations)
10. [Going live](#going-live)

## Overview

Use cases the system supports:

- **Bank the stake.** Withdraw the initial principal as soon as gains cover it, then never re-risk it.
- **Bounded drawdowns.** After the exit, losses can only consume unrealized gains, never the banked principal.
- **One-way destination.** The safe account receives funds; nothing is ever sent back from it.

The entire discipline is a single policy, signed once by the owner:

| Element | Value used in the simulation | Purpose |
|---|---|---|
| Destination | One safe account on Base | The only address funds may ever reach |
| Cap | Exactly the principal, per transaction | Bounds the exit itself |
| Delay | 30 s timelock (1 h in production) | Gives the owner a veto window before the principal leaves |

The policy permits `withdraw` only, so no route exists from the safe account back to the agent.

## How it works

1. The owner signs the policy once and issues one revocable grant to the runner. A grant carries no
   permissions of its own; the policy is the sole authority.
2. On each tick the runner reads the agent's balances and prices them from the token catalog. A
   missing or stale price halts the tick (`spend_price_unavailable`); the runner never acts on an
   estimated value.
3. When equity reaches 2x the principal, the runner withdraws exactly the principal under the fixed
   idempotency key `principal:<agentId>`. It submits the withdrawal first and persists the `banked`
   flag second, so a crash between the two replays the same request instead of paying twice.
4. The withdrawal is queued for the timelock duration. The owner may cancel it during that window.
5. Once the exit settles, the runner only reports status. Optionally, it can seal the policy (see
   [Known limitations](#known-limitations)).

On the real Agent API this corresponds to a `policy_update` (a single `only` destination, a
per-transaction cap equal to the principal, and `timelock_ms`), a `grant_issue` for the strategy,
and a grant-scoped `withdraw` carrying an idempotency key.

## The trading agent

`src/lib/strategy/` is the part that earns the gains. `TrendStrategy` (an EMA with a dead band) decides
whether to hold the risk asset or the stake asset; `Trader` quotes, then swaps through the grant. It
cooperates with the runner through three rules:

- **Cash first.** At the trigger the trader converts the position into the stake asset. The withdrawal needs
  that balance when it is requested and again when its timelock releases it, and a gain held in another
  asset cannot be withdrawn as the stake. Until the cash is there the runner reports `awaiting_cash`.
- **Reserve.** While the exit is queued, the stake-asset balance it needs is never swapped away.
- **Latched trigger.** The first time equity reaches the trigger it is recorded. A dip while the cash is being
  raised does not cancel the exit.

The policy's `timelock_ms` applies to every money action except deposits, so a swap is queued for the veto
window too and fills at the price when it releases, not when it was requested. `min_amount_out` therefore only
guards against a disaster; size `slippageBps` to how far the market moves over the delay. The mock models all
of this (queued swaps, re-pricing at release, `min_amount_out_not_met`). The strategy is exercised on a
deterministic price path (the **Trading Agent** page); it has not traded real markets.

## Safety model

Every refusal below is produced by the policy layer and is exercised by `runRefusalMatrix` (the
Safety page, `npm run simulate` and the test suite).

| Attempt | Refused with |
|---|---|
| Transfer out of the agent ("return my money") | `policy_action_denied` |
| Withdraw to another address, chain or memo | `policy_destination_denied` |
| Withdraw an asset outside the allowlist | `policy_denied` |
| Withdraw more than the principal in one transaction | `policy_limit_exceeded` |
| Replay the principal exit with the same key | Original operation returned; no second withdrawal |
| Use a revoked grant | `agent_grant_required` |
| Exceed the hourly action limit | `policy_action_limit_exceeded` |

Error codes follow the Agent API's published error list. The API does not specify the code for an
unlisted asset or a revoked grant, so `policy_denied` and `agent_grant_required` are inferred and
should be confirmed during the first live run.

The mock also reproduces two behaviours of the real service: a 10-minute cooldown between ordinary
policy edits (a pure freeze bypasses it), and rejection of a reused idempotency key accompanied by a
different request body (`idempotency_conflict`).

## Getting started

Requirements: Node.js 22 or later (verified on Node.js 23). The real SDK requires Node.js 24 or later; the mock does not.

```sh
npm install
npm run dev
```

Open <http://localhost:3000>. To autoplay the full run at 12x speed, open
<http://localhost:3000/dashboard?auto>.

For a production build:

```sh
npm run build
npm start
```

The accent colour is a single design token, `--accent` in `src/app/globals.css`.

## Scripts

| Script | Description |
|---|---|
| `npm run dev`, `build`, `start` | Standard Next.js development, build and production server |
| `npm run check` | Generates Next.js route types, typechecks, then runs all 86 tests |
| `npm test` | Unit tests only (`src/lib/**/*.test.ts`) |
| `npm run simulate` | Plays the whole story headless and verifies the outcome and the refusal matrix. Add `-- --realtime` for the 55 s live pacing. Exits non-zero on any failure |
| `npm run live:check` | Read-only check of the real Agent API: network status, token catalog, runner pricing on live data, and the API key if set. Moves no funds |
| `npm run live:run` | The real thing, on mainnet. Prints the plan and the policy it would sign and sends nothing, unless `HOUSE_CONFIRM=spend-real-funds` is set. See [Going live](#going-live) |
| `npm run live:create-agent` | Creates the owner's agent (empty, no withdrawals, $10/day budget) and prints `HOUSE_AGENT_ID`. Moves no funds. See [Live setup walkthrough](#live-setup-walkthrough) |
| `npm run e2e` | Starts the production server and drives Chrome through every page and button. Run `npm run build` first |

## Project structure

```
.
├── package.json  tsconfig.json  next.config.ts  postcss.config.mjs
├── scripts/
│   ├── simulate.mts        Headless run of the full scenario
│   ├── live-check.mts      Read-only check of the real Agent API
│   ├── live-run.mts        Guarded run against the real Agent API (real funds)
│   └── e2e.mts             Browser test (Playwright, system Chrome)
└── src/
    ├── app/                Routes: landing, live simulation, policy, safety, events
    ├── components/         Sidebar, panels, chart, simulation provider and controls
    └── lib/
        ├── policy/         Policy builder and Agent API types
        ├── risk/           Fail-closed pricing, principal trigger, idempotency key
        ├── agent-api/      Client interfaces, policy-enforcing mock, real-API client, NEAR owner signer
        ├── strategy/       Trend strategy and the trader (swap, cash-first, reserve)
        ├── runner/         Strategy loop, persisted state, typed event log
        └── simulation/     Deterministic strategy, steppable scenario, refusal matrix
```

Unit tests are colocated with the code they cover (`*.test.ts`).

## Testing

| Layer | Command | Coverage |
|---|---|---|
| Unit and integration | `npm test` | Policy, pricing, trigger, mock enforcement, runner behaviour, real-API client (through the real SDK against a fake network), simulation, refusal matrix |
| Static | `npm run typecheck` | TypeScript strict mode, including Next.js route types |
| Headless scenario | `npm run simulate` | Equity doubles, the principal exits exactly once, the red day burns only house money, nine refusal checks hold |
| Browser | `npm run live:run` | The real thing, on mainnet. Prints the plan and the policy it would sign and sends nothing, unless `HOUSE_CONFIRM=spend-real-funds` is set. See [Going live](#going-live) |
| `npm run e2e` | 22 checks in Chrome: autoplay, all pages, the trading replay, every button, the owner veto, reset, theme colour |
| Live read-only | `npm run live:check` | Real network status and token catalog; verifies the runner's pricing against live prices |

## Demonstration

A complete run takes about 55 seconds. Present the UI, and keep `npm run simulate -- --realtime`
as a terminal fallback.

| Time | Screen | Event |
|---|---|---|
| 0 to 5 s | Signed Policy | One destination, one cap, one delay |
| 5 to 20 s | Live Simulation | Equity climbs toward 2x; the runner prices the portfolio each step |
| 20 s | Live Simulation | Equity reaches the 2x line; the principal exit is queued with a countdown |
| 20 to 30 s | Live Simulation | A red day reduces equity; the countdown continues and the owner may veto |
| 50 s | Live Simulation | The principal settles; the banked line never moves again |
| After | Try to Break It | Run all checks: all nine refusals hold |

## Known limitations

- **Exactly-once is enforced by the runner, not by the policy, unless the seal is enabled.** The
  per-transaction cap remains at the principal, so a second exit under a different idempotency key
  would be policy-legal, though only to the safe account. Setting `sealAfterSettlement: true` on the
  runner closes this: once the exit settles, an owner-signed `policy_update` removes `withdraw`, and
  retries when the API's 10-minute edit cooldown defers it. The option is off by default because it
  departs from the original specification.
- **Drawdown during the veto window.** The principal leaves when the timelock releases and requires
  sufficient balance at that moment. A loss of roughly half the position inside the window can cause
  the exit to fail with `insufficient_balance`. A test documents this case.
- **Simulated gains.** The live service is mainnet-only and offers no test network, so gains cannot be
  simulated against it.
- **Live client not yet run against the service.** It is tested through the real SDK against a fake
  network, and the owner signer is tested on its own, but neither has signed or sent anything to the real
  service. The mock does not model `confidential`, `owner_approval` or USD budgets.
- **The strategy has only seen a scripted price path.** It is a simple trend follower. Its swap-quote parsing
  (`quoteAmountOut`) reads the quote defensively because the API schema leaves the quote's fields open.
- **A swap that fails its minimum output** is a mock-only code (`min_amount_out_not_met`); the real API's
  response is undocumented.

## Going live

`LiveAgentApi` (`src/lib/agent-api/live.ts`) implements the same interfaces as the mock on top of
`@near-intents-agent-api/sdk`, and `NearOwnerSigner` (`near-signer.ts`) signs the owner's intents with an
ed25519 NEAR key (`nep413` and `nep366`). `npm run live:run` wires them to the runner and, optionally, the
trader. What remains is supplying inputs:

1. **API key.** Create a `naa_...` key in the partner dashboard: `NEAR_INTENTS_AGENT_API_KEY`.
   `npm run live:check` validates it without moving funds.
2. **Owner account.** A dedicated, low-value NEAR account that owns an existing agent:
   `NEAR_OWNER_ACCOUNT_ID` and `NEAR_OWNER_PRIVATE_KEY` (never commit the key).
3. **Funding.** A small stake in the agent, and a safe address: `HOUSE_AGENT_ID`, `HOUSE_ASSET`,
   `HOUSE_PRINCIPAL`, `HOUSE_SAFE_CHAIN`, `HOUSE_SAFE_ADDRESS`.
4. **Runtime.** Node.js 24 or later; the script refuses to transact on anything older.
5. **Approval to transact.** The hosted API runs on mainnet with real funds. Without
   `HOUSE_CONFIRM=spend-real-funds` the script prints the plan and policy and exits.

Use asset identifiers from `GET /v1/tokens`. For example, NEAR-chain USDC is
`nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`. Mainnet gains cannot be simulated,
so lower the trigger (`HOUSE_MULTIPLE_BPS=10100` is 1.01x) and a short `HOUSE_TIMELOCK_MS` to watch the exit and
the refusals happen on a small stake. Set `HOUSE_RISK_ASSET` to let the agent trade as well.

## Live setup walkthrough

The steps taken to get from the simulation to a live run, in order.

1. **Owner wallet.** Generate a dedicated, low-value NEAR owner account and a Base safe address into
   `.secrets/` (gitignored). Put `NEAR_OWNER_ACCOUNT_ID` and `NEAR_OWNER_PRIVATE_KEY` in the local `.env`.
2. **API key.** The agent API keys come from the partner dashboard at
   <https://partners.demo.agentsonintents.com/dashboard> (**API keys**, then create). The mainnet
   dashboard at `partners.near-intents.org` only offers 1Click, relay, Explorer and circuit-breaker keys,
   so it does not issue `naa_...` Agent API keys. Put the key in `.env` as `NEAR_INTENTS_AGENT_API_KEY`.
3. **Point at the matching API.** A demo-dashboard key is rejected by `https://api.agentsonintents.com`
   (`401 invalid_api_key`) and accepted by `https://api.demo.agentsonintents.com`. Set
   `NEAR_INTENTS_BASE_URL=https://api.demo.agentsonintents.com` in `.env`. The scripts read it. Note that
   `/v1/network` on the demo API still reports `mainnet`, so treat funds as real.
4. **Check the key.** `npm run live:check` validates the key and the live token catalog. No funds move.
5. **Fund the owner for gas.** The owner is an implicit NEAR account that does not exist until it receives
   NEAR. Send about 0.1 to 0.5 NEAR to `NEAR_OWNER_ACCOUNT_ID`. Without it, signing fails with
   `AccessKeyDoesNotExistError`.
6. **Create the agent.** The dashboard has no create button; agents are created through the SDK.
   `npm run live:create-agent` generates the `agent_create` intent, signs it with the owner key, submits it,
   waits for `SUCCESS` and prints `HOUSE_AGENT_ID=...`. Put that in `.env`.
7. **Choose the stake.** Set `HOUSE_PRINCIPAL` (for example 5 USDC) and deposit that stake into the agent.
8. **Dry run.** `npm run live:run` prints the plan and the policy it would sign, and sends nothing.
9. **Go live.** Only when you are ready to spend real funds, set `HOUSE_CONFIRM=spend-real-funds` and run
   `npm run live:run` again.

`.env` and `.secrets/` are gitignored. Never put `NEAR_OWNER_PRIVATE_KEY`, the API key or `HOUSE_CONFIRM`
on a deployed server; the web app reads no environment variables.
