"use client";

import type { ReactNode } from "react";
import { Button, Card, Dialog, FeedbackState, Icon, MetricCard, PageContainer, Skeleton, StatusBadge, type StatusTone } from "@/components/ui";

export function AdminPage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <PageContainer className={`max-w-none ${className}`}>{children}</PageContainer>;
}

export function AdminPageHeader({
  actions,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <header className="tc-flow-safe flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="max-w-3xl min-w-0">
        {eyebrow ? <p className="mb-1 text-xs font-black uppercase tracking-wide text-[var(--secondary)]">{eyebrow}</p> : null}
        <h1 className="tc-text-safe text-2xl font-black leading-tight text-[var(--primary)] md:text-3xl">{title}</h1>
        <p className="tc-text-safe mt-2 max-w-[72ch] text-sm leading-6 text-[var(--on-surface-variant)]">{description}</p>
      </div>
      {actions ? <div className="tc-actions-wrap min-w-0 md:justify-end">{actions}</div> : null}
    </header>
  );
}

export function AdminAlert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success";
}) {
  const classes =
    tone === "success"
      ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
      : "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]";

  return (
    <div className={`tc-text-safe flex min-w-0 items-start gap-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm font-semibold ${classes}`} role={tone === "error" ? "alert" : "status"}>
      <Icon className="mt-0.5 text-[20px]" name={tone === "success" ? "check_circle" : "error"} fill />
      <span>{children}</span>
    </div>
  );
}

export function AdminMetricGrid({ children }: { children: ReactNode }) {
  return <section className="tc-fluid-grid gap-4">{children}</section>;
}

export function AdminMetric({
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
  return <MetricCard icon={icon} label={label} note={note} tone={tone} value={value} />;
}

export function AdminToolbar({
  children,
  resultLabel,
}: {
  children: ReactNode;
  resultLabel?: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,max-content)] md:items-end">{children}</div>
        {resultLabel ? <p className="tc-text-safe text-xs font-bold text-[var(--on-surface-variant)]">{resultLabel}</p> : null}
      </div>
    </Card>
  );
}

export function AdminSearchField({
  label = "Tìm kiếm",
  onChange,
  placeholder,
  value,
}: {
  label?: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-[var(--on-surface-variant)]">{label}</span>
      <span className="relative block">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--on-surface-variant)]" name="search" />
        <input
          className="w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-2.5 pl-10 pr-3 text-sm font-semibold text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="search"
          value={value}
        />
      </span>
    </label>
  );
}

export function AdminSelectField<TValue extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: TValue) => void;
  options: Array<{ label: string; value: TValue }>;
  value: TValue;
}) {
  return (
    <label className="block min-w-0 md:w-56">
      <span className="mb-1.5 block text-xs font-bold text-[var(--on-surface-variant)]">{label}</span>
      <select
        className="w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm font-semibold text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
        onChange={(event) => onChange(event.target.value as TValue)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminClearFiltersButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button className="w-full sm:w-auto" disabled={disabled} onClick={onClick} size="md" variant="outline">
      Xóa lọc
    </Button>
  );
}

export function AdminTableLoading({
  colSpan,
  rows = 6,
}: {
  colSpan: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index}>
          <td className="px-5 py-4" colSpan={colSpan}>
            <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_1fr_.8fr_.8fr]">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function AdminEmptyState({
  actionLabel = "Xóa bộ lọc",
  colSpan,
  description,
  onAction,
  title,
}: {
  actionLabel?: string;
  colSpan: number;
  description: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <tr>
      <td className="px-5 py-8" colSpan={colSpan}>
        <FeedbackState
          actionLabel={onAction ? actionLabel : undefined}
          className="min-h-[220px]"
          description={description}
          onAction={onAction}
          title={title}
          tone={onAction ? "not-found" : "empty"}
        />
      </td>
    </tr>
  );
}

export function AdminUserCell({
  avatar,
  email,
  name,
}: {
  avatar?: ReactNode;
  email: string;
  name: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {avatar}
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-[var(--on-surface)]">{name}</p>
        <p className="truncate text-xs font-medium text-[var(--on-surface-variant)]">{email}</p>
      </div>
    </div>
  );
}

export function AdminActionDialog({
  busy,
  confirmLabel,
  description,
  note,
  noteLabel = "Ghi chú xử lý",
  notePlaceholder,
  noteRequired = false,
  onCancel,
  onConfirm,
  onNoteChange,
  open,
  title,
  tone = "danger",
}: {
  busy: boolean;
  confirmLabel: string;
  description: string;
  note: string;
  noteLabel?: string;
  notePlaceholder?: string;
  noteRequired?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onNoteChange: (value: string) => void;
  open: boolean;
  title: string;
  tone?: "danger" | "primary";
}) {
  const confirmDisabled = busy || (noteRequired && !note.trim());

  return (
    <Dialog
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      description={description}
      onClose={onCancel}
      open={open}
      role={tone === "danger" ? "alertdialog" : "dialog"}
      title={title}
    >
      <div className="p-6">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[var(--on-surface)]">{noteLabel}</span>
          <textarea
            className="min-h-28 w-full resize-y rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
            data-dialog-initial-focus
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={notePlaceholder}
            value={note}
          />
        </label>
        {noteRequired && !note.trim() ? <p className="mt-2 text-xs font-semibold text-[var(--error)]">Vui lòng nhập lý do trước khi xác nhận.</p> : null}
      </div>
      <footer className="grid grid-cols-2 gap-3 bg-[var(--surface-container-low)] p-4">
        <Button disabled={busy} onClick={onCancel} variant="outline">
          Giữ lại
        </Button>
        <Button disabled={confirmDisabled} isLoading={busy} onClick={onConfirm} variant={tone === "danger" ? "danger" : "primary"}>
          {confirmLabel}
        </Button>
      </footer>
    </Dialog>
  );
}

export function TutorStatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; tone: StatusTone }> = {
    APPROVED: { label: "Đã duyệt", tone: "success" },
    DRAFT: { label: "Bản nháp", tone: "neutral" },
    PENDING_REVIEW: { label: "Chờ duyệt", tone: "warning" },
    REJECTED: { label: "Từ chối", tone: "danger" },
  };
  const item = meta[status] || { label: status, tone: "neutral" as StatusTone };
  return <StatusBadge tone={item.tone}>{item.label}</StatusBadge>;
}

export function UserStatusBadge({ status, verified }: { status: string; verified?: boolean }) {
  const meta: Record<string, { label: string; tone: StatusTone }> = {
    ACTIVE: { label: verified ? "Đang hoạt động · đã xác minh" : "Đang hoạt động", tone: verified ? "success" : "info" },
    PENDING_EMAIL_VERIFICATION: { label: "Chờ xác minh email", tone: "warning" },
    SUSPENDED: { label: "Tạm khóa", tone: "danger" },
  };
  const item = meta[status] || { label: status, tone: "neutral" as StatusTone };
  return <StatusBadge tone={item.tone}>{item.label}</StatusBadge>;
}

export function BookingStatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; tone: StatusTone }> = {
    CANCELLED: { label: "Đã hủy", tone: "danger" },
    COMPLETED: { label: "Hoàn thành", tone: "success" },
    CONFIRMED: { label: "Đã xác nhận", tone: "info" },
    PENDING: { label: "Chờ xác nhận", tone: "warning" },
  };
  const item = meta[status] || { label: status, tone: "neutral" as StatusTone };
  return <StatusBadge tone={item.tone}>{item.label}</StatusBadge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; tone: StatusTone }> = {
    CANCELLED: { label: "Đã hủy", tone: "danger" },
    FAILED: { label: "Thất bại", tone: "danger" },
    PAID: { label: "Đã thanh toán", tone: "success" },
    PENDING: { label: "Đang chờ", tone: "warning" },
    REFUNDED: { label: "Đã hoàn tiền", tone: "info" },
  };
  const item = meta[status] || { label: status, tone: "neutral" as StatusTone };
  return <StatusBadge tone={item.tone}>{item.label}</StatusBadge>;
}

export function PayoutStatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; tone: StatusTone }> = {
    CANCELLED: { label: "Đã hủy", tone: "danger" },
    HELD: { label: "Đang giữ", tone: "warning" },
    REFUNDED: { label: "Đã hoàn", tone: "info" },
    RELEASED: { label: "Đã mở khóa", tone: "success" },
  };
  const item = meta[status] || { label: status, tone: "neutral" as StatusTone };
  return <StatusBadge tone={item.tone}>{item.label}</StatusBadge>;
}

export function WithdrawalStatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; tone: StatusTone }> = {
    CANCELLED: { label: "Đã hủy", tone: "danger" },
    PAID: { label: "Đã chuyển", tone: "success" },
    PENDING: { label: "Chờ xử lý", tone: "warning" },
    PROCESSING: { label: "Đang xử lý", tone: "info" },
    REJECTED: { label: "Từ chối", tone: "danger" },
  };
  const item = meta[status] || { label: status, tone: "neutral" as StatusTone };
  return <StatusBadge tone={item.tone}>{item.label}</StatusBadge>;
}
