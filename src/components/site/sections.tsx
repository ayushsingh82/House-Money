import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Gauge, KeyRound, LogOut, ShieldCheck, X } from "lucide-react";

const section = "mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6";

function Heading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-3 text-muted-foreground">{body}</p>}
    </div>
  );
}

export function Stats() {
  const items = [
    ["1", "destination: the safe account"],
    ["2×", "equity triggers the exit"],
    ["1×", "the principal leaves, exactly once"],
    ["9", "refusals checked by the matrix"],
  ];
  return (
    <section className="mt-16 border-y bg-card/40">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
        {items.map(([n, label]) => (
          <div key={label} className="text-center">
            <dt className="font-display text-4xl font-semibold text-accent">{n}</dt>
            <dd className="mt-1 text-xs text-muted-foreground">{label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const STEPS = [
  { icon: ShieldCheck, name: "Sign the rule", text: "The owner signs one policy: one destination, one cap, one delay." },
  { icon: KeyRound, name: "Grant the runner", text: "A revocable grant lets the strategy act. Grants carry no permissions of their own." },
  { icon: Gauge, name: "Price the portfolio", text: "Each step the runner prices equity. A stale price means it does nothing." },
  { icon: LogOut, name: "Bank the stake", text: "At 2× equity the exact principal is queued to the safe account, exactly once." },
];

export function Pipeline() {
  return (
    <section id="how" className={section}>
      <Heading eyebrow="How it works" title="The agent trades. The policy decides where money can go." body="Nothing the strategy does can change the destination, the size or the delay." />
      <div className="grid gap-4 md:grid-cols-4">
        {STEPS.map(({ icon: Icon, name, text }, i) => (
          <div key={name} className="group relative rounded-xl border bg-card p-5 transition-colors hover:border-accent/50">
            {i < STEPS.length - 1 && <ArrowRight className="absolute -right-3.5 top-1/2 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-background text-muted-foreground md:block" />}
            <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
            <Icon className="mt-3 size-6 text-accent" />
            <h3 className="mt-3 font-display text-lg font-semibold">{name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const COMPARE: [string, string, string][] = [
  ["A prompt says \"send it all to me\"", "Agent obeys if its tools can", "Refused: policy_action_denied"],
  ["Compromised strategy picks a new address", "Funds can leave", "Refused: policy_destination_denied"],
  ["Gains reach the stake", "Hope the agent banks it", "Principal queued automatically, once"],
  ["Retry after a crash", "Possible double withdrawal", "Same key replays; no second payout"],
  ["Market feed goes stale", "Acts on the last number", "Fails closed; does nothing"],
];

export function Compare() {
  return (
    <section className={section}>
      <Heading eyebrow="Why a policy" title="The same agent, with and without the rule" />
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-3 border-b bg-muted/40 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>Situation</span>
          <span>Unprotected agent</span>
          <span className="text-accent">House Money</span>
        </div>
        {COMPARE.map(([a, b, c]) => (
          <div key={a} className="grid grid-cols-3 gap-3 border-b px-4 py-3.5 text-sm last:border-0">
            <span>{a}</span>
            <span className="flex items-start gap-2 text-muted-foreground"><X className="mt-0.5 size-4 shrink-0 text-red-400" />{b}</span>
            <span className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />{c}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const SAFETY = [
  "The safe account is the only destination. It is a one-way door: it receives and nothing returns.",
  "The per-transaction cap equals the principal, so even the exit is bounded.",
  "A timelock gives the owner a veto window before the principal leaves.",
  "A replayed exit under the same key returns the original operation, never a second withdrawal.",
  "Stale or missing prices fail closed. The runner never acts on a guessed number.",
  "Gains are simulated on a mock Agent API. No real funds are touched.",
];

export function Safety() {
  return (
    <section id="safety" className={section}>
      <Heading eyebrow="Safety" title="Limits that are enforced, not promised" />
      <ul className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2">
        {SAFETY.map((s) => (
          <li key={s} className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm transition-colors hover:border-accent/50">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}

const FAQ: { group: string; items: [string, string][] }[] = [
  {
    group: "The idea",
    items: [
      ["What does house money mean here?", "Once the principal is banked, everything left in the agent is gains. A bad day can only burn that, never the stake."],
      ["Why not just tell the agent to take profit?", "A prompt is not a control. The policy is checked by the API on every request, so a confused, hijacked or buggy agent still cannot send funds anywhere but the safe account."],
      ["Who can change the rule?", "Only the owner, with a signature. The agent holds a revocable grant that carries no permissions of its own, and ordinary policy edits have a 10-minute cooldown on the API."],
    ],
  },
  {
    group: "Safety",
    items: [
      ["Can the principal be taken out twice?", "The runner never does. At the policy level the cap stays at the principal, so a second exit under a different key would be allowed, to the safe account only. The opt-in seal removes withdraw after the exit settles and closes that gap."],
      ["What if the market crashes during the veto window?", "The principal leaves when the timelock releases and needs the balance then. A crash deeper than about half the position can make the exit fail. The simulation tests this case."],
      ["What happens if the price feed is stale?", "Nothing. The runner prices the portfolio from the token catalog and refuses to act on a missing or expired price, so it never triggers on a guessed number."],
      ["What if the runner crashes mid-exit?", "The withdrawal uses the fixed key principal:<agentId>. Restarting replays the same request and returns the original operation, so it cannot pay twice."],
    ],
  },
  {
    group: "Using it",
    items: [
      ["Is this running on real funds?", "No. The app runs on a mock that enforces the same policy layers. A live client and a guarded script exist, but the hosted API is mainnet-only, so a live run needs an API key, an owner account and a small stake."],
      ["Does the agent actually trade?", "Yes, in the Trading Agent page: a trend follower swaps through the policy, raises cash at the trigger and keeps the principal reserved while the exit is queued. Swaps are delayed by the same timelock, so fills happen at the later price."],
      ["Can I veto the exit?", "Yes. During the timelock the owner can cancel the queued withdrawal. The Live Simulation page has a button for it."],
    ],
  },
];

export function Faq() {
  return (
    <section id="faq" className={`${section} max-w-3xl`}>
      <Heading eyebrow="FAQ" title="Questions, answered" body="Short answers about how the rule works and where it stops." />
      <div className="space-y-8">
        {FAQ.map(({ group, items }) => (
          <div key={group}>
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{group}</p>
            <div className="divide-y overflow-hidden rounded-2xl border bg-card">
              {items.map(([q, a]) => (
                <details key={q} className="group px-5 py-4 open:bg-muted/30">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 group-open:text-accent" />
                  </summary>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border bg-card px-6 py-16 text-center">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
        <p className="relative font-mono text-xs uppercase tracking-[0.25em] text-accent">See it for yourself</p>
        <h2 className="relative mx-auto mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">Watch the principal bank itself in under a minute</h2>
        <p className="relative mx-auto mt-3 max-w-lg text-sm text-muted-foreground">No wallet, no funds. Then try to break the rule yourself.</p>
        <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/dashboard?auto" className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
            Open the app <ArrowRight className="size-4" />
          </Link>
          <Link href="/safety" className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted">
            Try to break it
          </Link>
        </div>
      </div>
    </section>
  );
}
