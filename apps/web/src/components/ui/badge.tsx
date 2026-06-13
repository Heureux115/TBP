import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

export type StatusTone = "danger" | "info" | "neutral" | "success" | "warning";

const toneClasses: Record<StatusTone, string> = {
  danger: "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  info: "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  neutral: "border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
  success: "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  warning: "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
};

export function Badge({
  children,
  className = "",
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-[var(--radius-full)] border px-3 py-1 text-xs font-bold leading-none",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  children,
  dot = true,
  tone = "neutral",
}: {
  children: ReactNode;
  dot?: boolean;
  tone?: StatusTone;
}) {
  return (
    <Badge tone={tone}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      <span className="truncate">{children}</span>
    </Badge>
  );
}
