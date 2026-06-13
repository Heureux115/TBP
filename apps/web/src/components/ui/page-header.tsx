import type { ReactNode } from "react";
import { cn } from "./utils";

export function PageHeader({
  actions,
  className = "",
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
}) {
  return (
    <header className={cn("tc-flow-safe flex flex-col justify-between gap-4 md:flex-row md:items-end", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">{eyebrow}</p> : null}
        <h1 className="tc-text-safe text-2xl font-black leading-tight text-[var(--primary)] sm:text-3xl">{title}</h1>
        {description ? <p className="tc-text-safe mt-2 max-w-2xl text-sm leading-6 text-[var(--on-surface-variant)]">{description}</p> : null}
      </div>
      {actions ? <div className="tc-actions-wrap min-w-0 md:justify-end">{actions}</div> : null}
    </header>
  );
}
