import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "@/components/brand";

const COLS: { title: string; links: [string, string][] }[] = [
  { title: "App", links: [["Live Simulation", "/dashboard"], ["Trading Agent", "/trading"], ["Signed Policy", "/policy"], ["Try to Break It", "/safety"], ["Event Log", "/events"]] },
  { title: "Learn", links: [["How it works", "/#how"], ["The rule", "/#rule"], ["Demo", "/#demo"], ["Safety", "/#safety"], ["FAQ", "/#faq"]] },
  { title: "Build", links: [["Source on GitHub", "https://github.com/ayushsingh82/House-memory"], ["Agent API guide", "https://api.agentsonintents.com/llms.txt"], ["Agent API reference", "https://api.agentsonintents.com/openapi.json"]] },
];

export function Footer() {
  return (
    <footer className="border-t bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div>
            <BrandLogo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Policy-enforced principal protection for autonomous trading agents. The stake banks itself; the agent plays with the rest.
            </p>
            <Link href="/dashboard?auto" className="mt-5 inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted">
              Open the app <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{c.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {c.links.map(([label, href]) => {
                  const external = href.startsWith("http");
                  return (
                    <li key={label}>
                      <Link
                        href={href}
                        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                        className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {label}
                        {external && <ArrowUpRight className="size-3" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="pointer-events-none select-none overflow-hidden border-t text-center font-display text-[18vw] font-semibold pb-6 leading-[0.9] tracking-tighter text-foreground/[0.04] md:text-[13rem]">
        House Money
      </div>
    </footer>
  );
}
