# Phase 0 Findings (2026-10-19)

Reference clones (untrusted, read-only): `ref/sdk-typescript`, `ref/skills`, `ref/examples`.
Public calls made: `GET /v1/network`, `GET /v1/tokens` (no key, no funds).

## Answers to plan §2

| # | Question | Answer |
|---|----------|--------|
| 1 | SDK / origin | `@near-intents-agent-api/sdk` v0.5.2, `createAgentApi({ apiKey, baseUrl? })`. Default origin `https://api.agentsonintents.com`. **Mainnet only, real funds.** Needs Node 24+ (this machine: v23.3.0). Network status: operational. |
| 2 | Shorten timelock? | Yes, `timelock_ms` is any value and is enforced by the API (no chain tx). Demo can use 30–60s. **But policy changes are throttled to 10 min apart** (`policy_change_throttled`), so set the demo timelock in the initial policy, not by a later edit. |
| 3 | Simulate gains | No testnet. Real balances are priced from `GET /v1/tokens`. Gains must be simulated: mock mode (planned `MockAgentApi`) for the 60s demo; real mode proves the withdraw/refusal path with small amounts and a lowered "trigger multiple". |
| 4 | Cancel queued withdrawal | Owner-signed `execution_cancel` intent `{ agent_id, correlation_id }`. Queued items listed via `listScheduledExecutions` (`execute_after`, `state`). A grant cannot cancel. Editing the policy invalidates queued work. |
| 5 | Safe account | Any valid address on the destination chain; no setup needed. |
| 6 | Refusal codes | `policy_action_denied`, `policy_destination_denied`, `spend_budget_exceeded`, `insufficient_balance`, `policy_schedule_denied`, `policy_revision_conflict`, `policy_change_throttled`. |

## Corrections to the spec snippet

- Constructor: use `createAgentApi({...})`, not `new AgentApi(...)`; env var is `NEAR_INTENTS_AGENT_API_KEY`.
- Asset id `nep141:usdc.near` is not in the catalog. Real ids:
  - NEAR USDC: `nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` (6 decimals)
  - Base USDC: `nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near` (6 decimals)
  - Prices carry `price_expires_at` (~10 min TTL), so fail closed when stale.
- Every owner action (policy_update, grant_issue, execution_cancel) needs an owner signature; the backend cannot do it alone. Supported owner types on this deployment: `near`, `passkey`. `examples/support/sign-near-intent.ts` has a NEAR signer to reuse.
- `agent_create` is a real on-chain onboarding.
- `idempotencyKey` is passed as an option on `withdraw(...)`; `principal:${isoDate}` still has the cross-day risk noted in plan §6, so prefer a fixed key.

## Blockers for the live (non-mock) spike

1. `NEAR_INTENTS_AGENT_API_KEY` (`naa_...`) from https://partners.near-intents.org/ , not set here.
2. A dedicated NEAR owner account + key holding little value, plus a small USDC stake to fund the agent.
3. Node 24+ (install via `nvm install 24`).
4. A safe-account address on Base (or NEAR) for the destination.
5. Go-ahead to spend real (small) funds on mainnet.

## Not done yet

Authenticated calls (`whoami`), agent creation, policy signing, grant issue, test withdraw. All wait on the blockers above.
