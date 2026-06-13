import type { ReactNode } from "react";
import { Button } from "./button";
import { Icon } from "./icon";
import { cn } from "./utils";

type FeedbackTone = "empty" | "error" | "loading" | "not-found" | "success";

const toneMeta: Record<FeedbackTone, { icon: string; toneClass: string }> = {
  empty: { icon: "inbox", toneClass: "bg-[var(--surface-container-low)] text-[var(--primary)]" },
  error: { icon: "error", toneClass: "bg-[var(--error-container)] text-[var(--error)]" },
  loading: { icon: "progress_activity", toneClass: "bg-[var(--surface-container-low)] text-[var(--primary)]" },
  "not-found": { icon: "search_off", toneClass: "bg-[var(--surface-container-low)] text-[var(--primary)]" },
  success: { icon: "check_circle", toneClass: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]" },
};

export function FeedbackState({
  action,
  actionLabel,
  className = "",
  description,
  icon,
  onAction,
  title,
  tone = "empty",
}: {
  action?: ReactNode;
  actionLabel?: string;
  className?: string;
  description: string;
  icon?: string;
  onAction?: () => void;
  title: string;
  tone?: FeedbackTone;
}) {
  const meta = toneMeta[tone];

  return (
    <section
      className={cn(
        "flex min-h-[280px] items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-8 text-center",
        className,
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="max-w-md">
        <div className={cn("mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full", meta.toneClass)}>
          <Icon className={tone === "loading" ? "animate-spin" : ""} fill={tone !== "loading"} name={icon || meta.icon} />
        </div>
        <h2 className="text-xl font-black text-[var(--on-surface)]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
        {actionLabel && onAction ? (
          <Button className="mt-5" onClick={onAction} variant={tone === "error" ? "outline" : "primary"}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
