import { Check, Lock } from "lucide-react";

const STATS = [
  { label: "Equity in agent", value: "$600.00", hint: "after the red day", tone: "text-foreground" },
  { label: "Banked", value: "$1,000.00", hint: "in the safe account", tone: "text-emerald-400" },
  { label: "House money", value: "$600.00", hint: "all that remains at risk", tone: "text-amber-400" },
  { label: "Principal", value: "$1,000", hint: "banked at 2×", tone: "text-foreground" },
];

const FEED: [string, string, string][] = [
  ["0:50", "Principal settled to the safe account.", "text-emerald-400"],
  ["0:25", "Red day: equity −40%. Countdown continues.", "text-red-400"],
  ["0:20", "Gains cover the principal. Exit queued.", "text-amber-400"],
  ["0:00", "Policy signed. Runner granted.", "text-muted-foreground"],
];

// Chart geometry (viewBox 640 x 230). Equity climbs to 2x, then the principal leaves and a red day follows.
const EQUITY_UP = "M0 175 C60 172 110 160 150 148 S230 106 270 80";
const EQUITY_DOWN = "M270 80 C300 76 322 70 340 92 S372 168 400 162 S470 150 520 146 S600 140 640 136";

/** A static, lightly animated picture of the app's central moment. */
export function Preview() {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-8 sm:px-6">
      <div className="relative">
        <div aria-hidden className="absolute inset-x-10 -bottom-6 h-24 rounded-[2rem] bg-accent/10 blur-2xl" />
        <div className="relative overflow-hidden rounded-2xl border bg-card shadow-[0_40px_90px_-30px] shadow-black/70 ring-1 ring-white/10">
          <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2.5">
            <span className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-red-400/70" />
              <span className="size-2.5 rounded-full bg-amber-400/70" />
              <span className="size-2.5 rounded-full bg-emerald-400/70" />
            </span>
            <span className="mx-auto inline-flex items-center gap-1.5 rounded-md border bg-background/60 px-3 py-1 font-mono text-[11px] text-muted-foreground">
              <Lock className="size-3" /> house-money.app/dashboard
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] text-emerald-400">
              <Check className="size-3" /> Settled
            </span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-4 sm:divide-y-0">
            {STATS.map((s) => (
              <div key={s.label} className="p-4 sm:p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.label}</p>
                <p className={`mt-1.5 font-display text-2xl font-semibold sm:text-3xl ${s.tone}`}>{s.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1.7fr_1fr]">
            <div className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-sm font-semibold">Equity vs principal</p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" />Equity</li>
                  <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-400" />Banked</li>
                  <li className="flex items-center gap-1.5"><span className="h-px w-3 border-t border-dashed border-amber-400" />Trigger</li>
                </ul>
              </div>
              <svg viewBox="0 0 640 230" className="h-56 w-full" role="img" aria-label="Equity climbs to twice the principal, the principal is banked, and a red day only burns house money">
                <defs>
                  <linearGradient id="eq" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 1, 2].map((i) => (
                  <line key={i} x1="0" x2="640" y1={40 + i * 60} y2={40 + i * 60} stroke="var(--border)" strokeDasharray="2 5" />
                ))}
                <line x1="0" x2="640" y1="80" y2="80" stroke="#fbbf24" strokeDasharray="4 5" strokeOpacity="0.7" />
                <text x="6" y="72" fontSize="10" fill="#fbbf24" fontFamily="var(--font-mono)">trigger 2×</text>
                <text x="6" y="168" fontSize="10" fill="var(--muted-foreground)" fontFamily="var(--font-mono)">principal</text>
                <rect x="340" y="0" width="100" height="200" fill="var(--accent)" opacity="0.06" />
                <text x="348" y="14" fontSize="10" fill="var(--accent)" fontFamily="var(--font-mono)">veto window</text>
                <path d={`${EQUITY_UP} ${EQUITY_DOWN.replace("M270 80", "")} L640 200 L0 200 Z`} fill="url(#eq)" style={{ animation: "fade-in 1.2s 1.2s both" }} />
                <path d={EQUITY_UP} pathLength={1} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1" style={{ animation: "draw 1.4s ease-out both" }} />
                <path d={EQUITY_DOWN} pathLength={1} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1" style={{ animation: "draw 1.4s 1.2s ease-out both" }} />
                <line x1="440" x2="440" y1="0" y2="200" stroke="#34d399" strokeOpacity="0.6" strokeDasharray="3 4" />
                <path d="M440 148 H640" fill="none" stroke="#34d399" strokeWidth="2.5" pathLength={1} strokeDasharray="1" style={{ animation: "draw 0.8s 2.4s ease-out both" }} />
                <circle cx="270" cy="80" r="4.5" fill="var(--accent)" />
                <circle cx="440" cy="148" r="4.5" fill="#34d399" />
                <text x="450" y="140" fontSize="10" fill="#34d399" fontFamily="var(--font-mono)">principal banked</text>
                {["0s", "15s", "30s", "45s"].map((t, i) => (
                  <text key={t} x={i * 205 + 4} y="222" fontSize="10" fill="var(--muted-foreground)" fontFamily="var(--font-mono)">{t}</text>
                ))}
              </svg>
            </div>

            <div className="border-t p-5 lg:border-l lg:border-t-0">
              <p className="mb-3 font-display text-sm font-semibold">Event feed</p>
              <ul className="space-y-2.5 text-xs">
                {FEED.map(([t, text, tone]) => (
                  <li key={t} className="flex gap-3 border-t pt-2.5 first:border-t-0 first:pt-0">
                    <span className="w-8 shrink-0 font-mono text-muted-foreground">{t}</span>
                    <span className={tone}>{text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-lg border bg-muted/40 p-3">
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  <div className="w-[62.5%] bg-emerald-400" />
                  <div className="w-[37.5%] bg-amber-400" />
                </div>
                <div className="mt-2 flex justify-between text-[11px]">
                  <span className="text-emerald-400">Banked 62.5%</span>
                  <span className="text-amber-400">At risk 37.5%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
