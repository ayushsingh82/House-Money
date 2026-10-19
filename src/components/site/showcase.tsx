import Link from "next/link";
import { ArrowRight, Bot, Check, FileLock2, Landmark, Rocket, Server, UserRound, Vault, Wallet } from "lucide-react";

const POLICY = `{
  "actions": ["withdraw"],
  "assets": ["nep141:usdc…"],
  "limits": {
    "per_transaction": { "usdc": "1000000000" }
  },
  "destinations": {
    "mode": "only",
    "list": [{ "action": "withdraw", "chain": "base", "address": "0xSAFE…" }]
  },
  "max_actions_per_hour": 5,
  "timelock_ms": 3600000
}`;

const POINTS = [
  ["Withdraw only", "No swap-to-anywhere, no transfer: the only door out is the safe account."],
  ["Cap = principal", "Even the exit is bounded to exactly the stake."],
  ["1 hour timelock", "The owner can cancel the queued exit before it leaves."],
];

/** The one object the whole product rests on, next to what each line buys you. */
export function PolicyShowcase() {
  return (
    <section id="rule" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">The rule</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">One policy. Signed once by the owner.</h2>
        <p className="mt-3 text-muted-foreground">
          The agent never holds authority of its own. Its grant is a revocable key, and every request is checked against this document by the API, not by the agent.
        </p>
        <ul className="mt-6 space-y-4">
          {POINTS.map(([t, d]) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Check className="size-3" /></span>
              <p className="text-sm"><span className="font-medium">{t}.</span> <span className="text-muted-foreground">{d}</span></p>
            </li>
          ))}
        </ul>
        <Link href="/policy" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">
          Inspect the live policy <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_30px_70px_-30px] shadow-black/70 ring-1 ring-white/10">
        <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
          <span>policy_update</span>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">owner-signed</span>
        </div>
        <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-6 text-muted-foreground">{POLICY}</pre>
      </div>
    </section>
  );
}

const TIMELINE = [
  ["0:00", "Policy signed", "One destination, one cap, one delay."],
  ["0:05", "Agent trades", "Equity climbs while the runner prices the portfolio every step."],
  ["0:20", "Gains equal the stake", "Equity hits 2×. The principal is queued under a fixed key."],
  ["0:25", "A red day", "Equity falls 40%. The countdown continues; the owner may veto."],
  ["0:50", "Principal settles", "The banked line never moves again. Only house money is left."],
];

export function Timeline() {
  return (
    <section id="demo" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mb-12 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">The demo</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Fifty-five seconds, start to settled</h2>
      </div>
      <ol className="relative space-y-8 border-l pl-8">
        {TIMELINE.map(([t, title, text], i) => (
          <li key={t} className="relative">
            <span className={`absolute -left-[37px] top-1 size-3 rounded-full ring-4 ring-background ${i === TIMELINE.length - 1 ? "bg-emerald-400" : "bg-accent"}`} />
            <p className="font-mono text-[11px] text-muted-foreground">{t}</p>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const NODES = [
  { icon: UserRound, name: "Owner", text: "Signs the policy once. Can veto or freeze." },
  { icon: FileLock2, name: "Policy", text: "One destination, one cap, one delay." },
  { icon: Server, name: "Agent API", text: "Checks every request against the policy." },
  { icon: Bot, name: "Agent", text: "Trades with a revocable grant. No authority." },
  { icon: Landmark, name: "Safe account", text: "Receives the principal. Nothing returns." },
];

/** Who holds which power, left to right. */
export function Architecture() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Architecture</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Authority flows one way</h2>
        <p className="mt-3 text-muted-foreground">The agent sits at the end of the chain. Everything it asks for passes through the policy first.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {NODES.map(({ icon: Icon, name, text }, i) => (
          <div key={name} className="relative rounded-xl border bg-card p-5 text-center transition-colors hover:border-accent/50">
            {i < NODES.length - 1 && <ArrowRight className="absolute -right-3.5 top-1/2 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-background text-muted-foreground md:block" />}
            <span className="mx-auto grid size-10 place-items-center rounded-xl bg-accent/15 text-accent"><Icon className="size-5" /></span>
            <h3 className="mt-3 font-display text-base font-semibold">{name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const USES = [
  { icon: Vault, title: "Treasury desks", text: "Let an agent run a slice of a treasury while the base amount is guaranteed to leave once it is covered." },
  { icon: Rocket, title: "Strategy vaults", text: "Offer depositors a vault whose stake is returned first, with only profit left in play." },
  { icon: Wallet, title: "Personal agents", text: "Hand an assistant a small budget without trusting its prompt, its tools or its next update." },
];

export function UseCases() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Use cases</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Anywhere an agent holds someone else&apos;s money</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {USES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border bg-card p-6 transition-colors hover:border-accent/50">
            <Icon className="size-6 text-accent" />
            <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
