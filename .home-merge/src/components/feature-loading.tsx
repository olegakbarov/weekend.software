interface FeatureLoadingProps {
  title: string;
}

export function FeatureLoading({ title }: FeatureLoadingProps) {
  return (
    <div className="flex h-screen items-center justify-center px-6">
      <div className="rounded-3xl border border-border bg-card px-6 py-5 text-center shadow-[0_24px_80px_-48px_rgba(0,0,0,0.8)]">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Opening
        </p>
        <p className="mt-2 text-lg font-medium text-foreground">{title}</p>
      </div>
    </div>
  );
}
