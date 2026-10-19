import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-7 place-items-center rounded-lg bg-accent font-display text-sm font-bold text-accent-foreground",
        className,
      )}
    >
      H
    </span>
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
