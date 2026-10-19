import Link from "next/link";
import { ArrowRight, Check, Gauge, KeyRound, LogOut, ShieldCheck } from "lucide-react";

const section = "mx-auto max-w-6xl px-4 py-20 sm:px-6";

function Heading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-3 text-muted-foreground">{body}</p>}
    </div>
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
          <div key={name} className="relative rounded-xl border bg-card p-5">
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
      <ul className="mx-auto grid max-w-3xl gap-3">
        {SAFETY.map((s) => (
          <li key={s} className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" />
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}

const FAQ = [
  ["What does house money mean here?", "Once the principal is banked, everything left in the agent is gains. A bad day can only burn that, never the stake."],
  ["Can the principal be taken out twice?", "The runner never does. At the policy level the cap stays at the principal, so a second exit under a different key would be allowed to the safe account only. Closing that needs a post-bank policy update."],
  ["What if the market crashes during the veto window?", "The principal leaves when the timelock releases and needs the balance then. A crash deeper than about half the position can make the exit fail. The simulation tests this case."],
  ["Is this running on real funds?", "No. It runs on a mock that enforces the same policy layers. Going live needs an API key, an owner account and a small stake."],
];

export function Faq() {
  return (
    <section id="faq" className={`${section} max-w-3xl`}>
      <Heading eyebrow="FAQ" title="Questions" />
      <div className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-xl border bg-card p-4">
            <summary className="cursor-pointer list-none text-sm font-medium">{q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Cta() {
  return (
    <section className={`${section} text-center`}>
      <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">See the whole story in under a minute</h2>
      <Link href="/dashboard?auto" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
        Watch it run <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}
