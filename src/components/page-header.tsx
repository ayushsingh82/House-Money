export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </header>
  );
}
