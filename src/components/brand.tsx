import Link from "next/link";
import { cn } from "@/lib/utils";

/** House Money mark: a house with a coin in the doorway, on the accent tile. Colours follow the theme tokens. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="House Money" className={cn("size-7", className)}>
      <rect width="64" height="64" rx="16" className="fill-accent" />
      <path
        className="fill-accent-foreground"
        d="M32 10 7 31.5c-1.4 1.2-.6 3.5 1.3 3.5H13v19a3 3 0 0 0 3 3h32a3 3 0 0 0 3-3V35h4.7c1.9 0 2.7-2.3 1.3-3.5Z"
      />
      <circle cx="32" cy="43" r="10" className="fill-accent" />
      <path
        className="fill-accent-foreground"
        d="M33.6 37.5v1.3c1.5.2 2.6 1 2.7 2.4h-1.9c-.1-.6-.8-1-1.8-1-1.100 0-1.800.5-1.800 1.200 0 .7.5 1 2.100 1.400 2.300.5 3.600 1.200 3.600 3 0 1.400-1.100 2.400-2.900 2.700v1.300h-1.700v-1.300c-1.700-.2-2.900-1.200-3-2.700h1.900c.1.700.9 1.200 2 1.200s1.700-.5 1.700-1.100c0-.7-.5-1-2.200-1.400-2.200-.5-3.500-1.300-3.500-3 0-1.300 1-2.300 2.700-2.600v-1.400Z"
      />
    </svg>
  );
}

export function BrandLogo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <BrandMark />
      <span className="font-display text-lg font-semibold tracking-tight">House Money</span>
    </Link>
  );
}
