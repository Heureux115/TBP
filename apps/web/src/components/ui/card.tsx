import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

type CardTone = "default" | "info" | "plain" | "subtle" | "warning";

const toneClasses: Record<CardTone, string> = {
  default: "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[var(--shadow-panel)]",
  info: "border-[var(--status-info-border)] bg-[var(--status-info-bg)]/45 shadow-[var(--shadow-panel)]",
  plain: "border-transparent bg-transparent shadow-none",
  subtle: "border-[var(--outline-variant)] bg-[var(--surface-container-low)] shadow-none",
  warning: "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]/55 shadow-[var(--shadow-panel)]",
};

export function Card({
  children,
  className = "",
  tone = "default",
  ...props
}: HTMLAttributes<HTMLElement> & { tone?: CardTone }) {
  return (
    <section
      className={cn("min-w-0 max-w-full rounded-[var(--radius-lg)] border p-5 text-[var(--on-surface)] sm:p-6", toneClasses[tone], className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  action,
  children,
  className = "",
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-start", className)}>
      <div className="min-w-0">{children}</div>
      {action ? <div className="tc-actions-wrap min-w-0 sm:justify-end">{action}</div> : null}
    </div>
  );
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("tc-text-safe text-xl font-black leading-tight text-[var(--on-surface)]", className)}>{children}</h2>;
}

export function CardDescription({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={cn("tc-text-safe mt-1 text-sm leading-6 text-[var(--on-surface-variant)]", className)}>{children}</p>;
}
