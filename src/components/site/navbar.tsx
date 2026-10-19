import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#rule", label: "The rule" },
  { href: "/#demo", label: "Demo" },
  { href: "/#safety", label: "Safety" },
  { href: "/#faq", label: "FAQ" },
];

export function Navbar() {
  return (
    <header id="top" className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <BrandLogo />
        <nav aria-label="Main" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/dashboard?auto" className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90">
            Open app <ArrowRight className="size-3.5" />
          </Link>
          <details className="group relative md:hidden">
            <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-lg border [&::-webkit-details-marker]:hidden" aria-label="Menu">
              <Menu className="size-4" />
            </summary>
            <nav aria-label="Mobile" className="absolute right-0 top-11 w-48 rounded-xl border bg-card p-1.5 shadow-xl shadow-black/40">
              {LINKS.map((l) => (
                <a key={l.href} href={l.href} className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  {l.label}
                </a>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
