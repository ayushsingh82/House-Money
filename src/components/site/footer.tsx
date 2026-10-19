import { BrandLogo } from "@/components/brand";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <BrandLogo />
          <p className="mt-2 max-w-sm text-xs text-muted-foreground">
            A simulation on a mock Agent API. Not financial advice. No real funds are used.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Experiment 18 — House Money</p>
      </div>
    </footer>
  );
}
