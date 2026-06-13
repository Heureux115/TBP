import type { ReactNode } from "react";
import { Card } from "./card";
import { Icon } from "./icon";
import type { StatusTone } from "./badge";

const toneClasses: Record<StatusTone, string> = {
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
  success: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
};

export function MetricCard({
  icon,
  label,
  note,
  tone = "info",
  value,
}: {
  icon: string;
  label: string;
  note?: ReactNode;
  tone?: StatusTone;
  value: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <span className={`flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] ${toneClasses[tone]}`}>
          <Icon name={icon} />
        </span>
        {note ? <span className="text-right text-xs font-bold leading-5 text-[var(--on-surface-variant)]">{note}</span> : null}
      </div>
      <p className="text-sm font-bold text-[var(--on-surface-variant)]">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-[var(--on-surface)]">{value}</p>
    </Card>
  );
}
