import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  right,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

const TONE = { default: "text-foreground", good: "text-emerald-400", bad: "text-red-400", warn: "text-amber-400" } as const;

export type PulseItem = { label: string; value: string; hint?: string; tone?: keyof typeof TONE };

/** A horizontal strip of headline numbers. */
export function PulseRail({ items }: { items: PulseItem[] }) {
  return (
    <div className="mb-6 grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border bg-card sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
      {items.map((it) => (
        <div key={it.label} className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{it.label}</p>
          <p className={`mt-1.5 font-display text-xl font-semibold ${TONE[it.tone ?? "default"]}`}>{it.value}</p>
          {it.hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{it.hint}</p>}
        </div>
      ))}
    </div>
  );
}
