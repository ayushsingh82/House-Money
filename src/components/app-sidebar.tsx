"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand";
import { cn } from "@/lib/utils";

const SECTIONS: { label: string; items: { href: string; label: string; tag: string }[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Live Simulation", tag: "00" },
      { href: "/trading", label: "Trading Agent", tag: "01" },
      { href: "/policy", label: "Signed Policy", tag: "02" },
    ],
  },
  {
    label: "Safety",
    items: [
      { href: "/safety", label: "Try to Break It", tag: "10" },
      { href: "/events", label: "Event Log", tag: "11" },
    ],
  },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r bg-background p-4 md:flex">
        <BrandLogo />
        <nav className="flex flex-col gap-5">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {section.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map(({ href, label, tag }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        active && "bg-muted text-foreground",
                      )}
                    >
                      {label}
                      <span className={cn("font-mono text-[10px]", active ? "text-accent" : "text-muted-foreground/60")}>{tag}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <p className="mt-auto rounded-lg border bg-card p-3 text-xs text-muted-foreground">
          Simulated on a mock Agent API. No real funds.
        </p>
      </aside>

      <div className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <BrandLogo />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {SECTIONS.flatMap((s) => s.items).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm text-muted-foreground",
                isActive(pathname, href) && "bg-muted text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
