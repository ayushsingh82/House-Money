# Plan — House Money Demo (Experiment 18)

Goal: a 60-second demo where an autonomous trading agent doubles its portfolio, banks its own
principal to a safe account under a 1h countdown, keeps trading on house money, and a "give me
my money back" attempt is refused. Spec: `experiment-18-house-money.md`.

## 1. Scope

**In scope (demo):**
- Policy signed once: one destination, one cap (= principal), one delay (1h timelock)
- A runner (strategy loop) holding a revocable grant, pricing its own portfolio
- Exactly-once principal withdrawal, triggered at equity >= 2x principal
- Dashboard showing equity, principal line, countdown, banked vs. house money
- Refused reverse flow and refused over-cap / wrong-destination withdrawals
- A scripted demo mode so the 60s run is deterministic

**Out of scope:** real alpha/strategy quality, multi-asset pricing beyond USDC + 1-2 tokens,
mainnet funds, multi-agent support.

## 2. Open questions (resolve first, ~1h)

| # | Question | Why it matters |
|---|----------|----------------|
| 1 | Is the `AgentApi` SDK (Agent Connect) installable? Which package/version, which `API_ORIGIN` (testnet/staging)? | Everything depends on it |
| 2 | Can `timelock_ms` be shortened on a test environment (e.g. 30s) for the demo? 1h is too long for a 60s demo | Demo pacing |
| 3 | Is there a way to simulate gains (testnet token with mutable price, or mocked pricing layer)? | Equity must double on cue |
| 4 | How is a QUEUED withdrawal cancelled / how does it surface in the API (status, `executes_at`)? | Countdown UI + veto story |
| 5 | Does the safe account on Base need to exist/be funded, or is any address OK? | Setup |
| 6 | What does a refused call look like (error codes for destination / cap / action violations)? | Refusal screens |

Fallback if SDK access is blocked: build against a thin `AgentApi` interface with a local mock
implementing the same policy checks, swap in the real client later (see §5).

## 3. Architecture

```
house-memory/
  README.md
  docs/                   spec, this plan, phase 0 findings, fallback recording
  app/                    the one Next.js project (Tailwind v4, Orca-style UI, orange accent)
    src/app/              routes: landing, and the app (live simulation, policy, safety, events)
    src/components/       sidebar, panels, chart, simulation provider and controls
    src/lib/
      policy/             policy builder and Agent API types
      risk/               fail-closed pricing, principal trigger, idempotency key
      agent-api/          client interfaces + MockAgentApi (same surface as the real SDK)
      runner/             strategy loop: price -> trigger -> withdraw once; state store; events
      simulation/         deterministic strategy, steppable scenario, refusal matrix
    scripts/
      simulate.mts        headless run of the full story (npm run simulate)
```

(Originally planned as `packages/` + `apps/`; consolidated into one Next.js app. `setup.ts` and
`reset.ts` for the live API remain to be written in Phase 0.)


Data flow:
1. `setup.ts` → `policy_update` (signed by owner) → `grant_issue` (credential commitment).
2. Runner holds only the grant token (`api.forGrant(token)`); grants carry no permissions of their
   own, so the policy is the sole authority.
3. Loop every N seconds: `getBalances` → `portfolioValueUsd` (via `GET /v1/tokens`) →
   `shouldBankPrincipal(equity, principal, state)`.
4. On trigger: `withdraw` with `idempotencyKey = principal:<isoDate>`, persist `banked=true`.
5. Web polls runner state + withdrawal status and renders the story.

## 4. Build steps

### Phase 0 — Spike (half day)
- [ ] Install SDK, authenticate with `NAA_KEY`, call `GET /v1/tokens` and `getBalances`
- [ ] Create a test agent, fund with testnet USDC
- [ ] Sign a minimal `policy_update`, issue a grant, perform one tiny withdraw to the safe account
- [ ] Answer §2 questions; record answers in this file

### Phase 1 — Core logic (`app/src/lib/policy`, `app/src/lib/risk`)
- [ ] `buildHouseMoneyPolicy({ agentId, revision, principalAtomic, safeAddress, chain, timelockMs })`
      returning the exact policy from the spec (single destination `mode: "only"`, per-tx cap =
      principal, `actions: ["withdraw"]`, `max_actions_per_hour: 5`, null budgets)
- [ ] `portfolioValueUsd(balances, tokens)`: uses `price_expires_at`; **fails closed** on stale or
      missing price (mirror `spend_price_unavailable`) — never trigger on unpriced equity
- [ ] `shouldBankPrincipal({ equity, principal, banked })` → `equity >= 2 * principal && !banked`
      using bigint/decimal math, no floats
- [ ] `principalKey(isoDate)` idempotency key; decide date vs. fixed key (see Risks)
- [ ] Unit tests: threshold edges (just below / exactly / above 2x), stale price, already banked,
      decimals/atomic conversion

### Phase 2 — Agent client (`app/src/lib/agent-api`)
- [ ] Typed wrapper around `AgentApi`: `applyPolicy`, `issueGrant`, `getEquity`, `withdraw`,
      `getWithdrawalStatus`, `cancelWithdrawal`
- [ ] `MockAgentApi` enforcing the same rules locally: destination allowlist, per-tx cap,
      hourly rate, idempotency replay, timelock queue with a controllable clock
- [ ] Contract tests run against both implementations

### Phase 3 — Runner (`app/src/lib/runner`)
- [ ] Loop with backoff; reads config from env (`NAA_KEY`, `API_ORIGIN`, agent id, grant token)
- [ ] Persist `{ banked, withdrawalId, bankedAt }` to a small local store (JSON/SQLite) so a
      restart can't re-trigger; idempotency key is the second line of defence
- [ ] After banking: keep trading loop alive (simulated trades in demo mode)
- [ ] Structured event log (`equity`, `trigger`, `withdraw_queued`, `withdraw_settled`,
      `refused`) consumed by the web app

### Phase 4 — Demo mode / gain injection
- [ ] `strategy-sim`: deterministic price walk that takes equity from 1.0x → 2.0x in ~20s, then a
      red day (−40%) in ~10s to prove banked principal is untouched
- [ ] Configurable timelock for the demo (e.g. 20–30s) with a note that production uses 1h
- [ ] Clock control in mock mode to fast-forward the countdown

### Phase 5 — Dashboard (`app/src/app`, `app/src/components`)
- [ ] Equity chart with a horizontal **principal line** and a 2x trigger marker
- [ ] Two-bucket bar: **Banked (safe account)** vs. **House money (at risk)**
- [ ] Countdown card for the queued withdrawal (amount, destination, `executes_at`, Cancel button)
- [ ] Policy card showing the three signed numbers: destination, cap, delay
- [ ] Event feed (trigger, queued, settled, refused)
- [ ] "Try to pull money back" and "Withdraw to another address" buttons that visibly fail with
      the policy error
- [ ] Demo controls: Start, Fast-forward, Reset

### Phase 6 — Refusal scenarios
- [ ] Reverse flow: attempt a deposit/transfer *from* the safe account via the agent → refused
      (safe account is only a destination)
- [ ] Withdraw to a non-whitelisted address → refused
- [ ] Withdraw `principal + 1` → refused by per-tx cap
- [ ] Second principal withdrawal same day → idempotent replay, no double spend
- [ ] 6th action within an hour → rate-limited

### Phase 7 — Rehearsal and polish
- [ ] Full `demo.ts` run end to end, timed under 60s
- [ ] Record fallback video in case the live API misbehaves
- [ ] README with one-command setup and the demo script

## 5. Demo script (60s)

| t | What the audience sees | What happens |
|---|------------------------|--------------|
| 0–5s | Policy card: 1 destination, cap = principal, 1h delay (shortened live) | Show the signed policy |
| 5–25s | Equity climbs 1.0x → 2.0x | Runner polls, prices portfolio |
| ~25s | Trigger fires, countdown starts, principal "moves" into the Banked bar | `withdraw` QUEUED |
| 25–40s | Countdown runs; owner could cancel | Veto window |
| 40–50s | Red day: equity drops, Banked bar stays flat | Drawdown burns house money only |
| 50–60s | Click "give me my money back" and "send elsewhere" → both refused | Policy errors shown |

## 6. Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Idempotency key `principal:<isoDate>` allows a second withdrawal on a *different* day | Persist `banked` locally and use a fixed key (`principal:<agentId>`) rather than a date; the per-tx cap still bounds the damage. Confirm with spec author which they intend |
| Per-tx cap = principal stays forever, so repeated withdrawals of up to principal each are policy-legal (rate-limited to 5/hr) | Call out honestly in the demo; stronger option is a cumulative `budget` or policy update lowering the cap to 0 after banking. Decide whether to include a post-bank `policy_update` |
| Equity measured at trigger includes unsettled/unpriced assets | Fail closed on stale prices; only count priced assets |
| Live API/timelock too slow for demo | Mock mode + shortened timelock + recorded fallback |
| Price oscillation around 2x triggers, then equity falls below principal before settle | Timelock gives owner a cancel window; document that banking happens on observed equity |
| Secrets in repo | `NAA_KEY` and grant token only via env; `.env.example` committed, `.env` ignored |

## 7. Definition of done

- [ ] One command sets up agent, policy, and grant on testnet (or mock)
- [ ] Runner banks principal exactly once, survives restart without re-triggering
- [ ] Dashboard shows the full story: double → queued → banked → red day → refusals
- [ ] All six refusal/safety scenarios in Phase 6 pass
- [ ] Unit + contract tests green for core and both client implementations
- [ ] 60s demo rehearsed, with a recorded fallback

## 8. Suggested order and estimate

Phase 0 → 1 → 2 (mock first) → 3 → 4 → 5 → 6 → 7. Roughly 3–4 working days for one person;
the mock client in Phase 2 lets UI work proceed in parallel if SDK access (Phase 0) slips.
