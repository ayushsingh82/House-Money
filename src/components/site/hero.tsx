import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Hourglass, Landmark, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

const card = "rounded-2xl border bg-card p-4 shadow-[0_24px_60px_-15px] shadow-black/50 ring-1 ring-white/10";

function Float({ className, duration = 8, delay = 0, children }: { className?: string; duration?: number; delay?: number; children: ReactNode }) {
  return (
    <div className={cn("absolute hidden lg:block", className)}>
      <div className="animate-[float_var(--d)_ease-in-out_infinite]" style={{ "--d": `${duration}s`, animationDelay: `${delay}s` } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <Float className="left-[4%] top-[20%] -rotate-[6deg]" duration={7}>
          <div className={cn(card, "w-56")}>
            <Landmark className="size-5 text-accent" />
            <p className="mt-3 text-sm font-medium">One destination</p>
            <p className="mt-1 text-xs text-muted-foreground">The safe account receives. Nothing comes back.</p>
          </div>
        </Float>
        <Float className="right-[4%] top-[16%] rotate-[5deg]" duration={9} delay={1}>
          <div className={cn(card, "w-56")}>
            <Scale className="size-5 text-accent" />
            <p className="mt-3 text-sm font-medium">One cap</p>
            <p className="mt-1 text-xs text-muted-foreground">Exactly the stake. The exit is bounded too.</p>
          </div>
        </Float>
        <Float className="right-[8%] bottom-[14%] -rotate-[4deg]" duration={8} delay={2}>
          <div className={cn(card, "w-56")}>
            <Hourglass className="size-5 text-accent" />
            <p className="mt-3 text-sm font-medium">One delay</p>
            <p className="mt-1 text-xs text-muted-foreground">A veto window before the principal leaves.</p>
          </div>
        </Float>
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pb-32 pt-24 text-center sm:px-6 sm:pt-32 sm:pb-44">
        <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-accent" />
          Experiment 18 · simulated on a mock Agent API
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
          Bank the principal. Trade the house&apos;s money.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          The moment an agent&apos;s gains equal the stake, the stake withdraws itself to a safe account, once. After that the worst case is already banked.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/dashboard?auto" className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
            Watch it run <ArrowRight className="size-4" />
          </Link>
          <a href="#how" className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted">
            How it works
          </a>
        </div>
      </div>
    </section>
  );
}
