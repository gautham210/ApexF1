import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  badges,
  actions,
  compact = false,
}: PageHeaderProps) {
  return (
    <header
      className={
        compact
          ? "flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-white/[0.08] pb-5"
          : "flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-white/[0.08] pb-6"
      }
    >
      <div className="space-y-1.5 min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="apex-eyebrow">{eyebrow}</span>
          {badges}
        </div>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight leading-[1.06] text-foreground break-words">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </header>
  );
}
