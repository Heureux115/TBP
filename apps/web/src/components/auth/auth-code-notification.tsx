"use client";

import { Button, Icon } from "@/components/ui";

export const AUTH_CODE_NOTICE_KEYS = {
  passwordReset: "tc_password_reset_code_notice",
  verification: "tc_email_verification_code_notice",
} as const;

export type AuthCodeNotice = {
  code: string;
  email: string;
};

export function readAuthCodeNotice(key: string, email: string) {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as AuthCodeNotice;
    if (payload.email !== email || !/^\d{6}$/.test(payload.code)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function saveAuthCodeNotice(key: string, payload: AuthCodeNotice) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify(payload));
}

export function AuthCodeNotification({
  code,
  email,
  kind,
  onClose,
}: AuthCodeNotice & {
  kind: "password-reset" | "verification";
  onClose: () => void;
}) {
  const title = kind === "verification" ? "Mã xác nhận email" : "Mã đặt lại mật khẩu";
  const description = kind === "verification" ? "Dùng mã này để hoàn tất đăng ký." : "Dùng mã này để tạo mật khẩu mới.";

  async function copyCode() {
    await navigator.clipboard.writeText(code).catch(() => undefined);
  }

  return (
    <aside
      className="fixed right-4 top-4 z-[var(--z-toast)] w-[min(calc(100vw-2rem),360px)] overflow-hidden rounded-[18px] border border-white/70 bg-white/95 text-[var(--on-surface)] shadow-[0_18px_50px_rgb(17_28_45_/_0.22)] backdrop-blur sm:right-6 sm:top-6"
      role="status"
    >
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--primary-fixed)] text-[var(--primary)]">
          <Icon fill className="text-[20px]" name={kind === "verification" ? "mark_email_read" : "lock_reset"} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-normal text-[var(--on-surface-variant)]">TutorConnect</p>
              <h2 className="mt-0.5 text-sm font-black text-[var(--on-surface)]">{title}</h2>
            </div>
            <button
              aria-label="Đóng thông báo mã"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-full)] text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)] focus:shadow-[var(--focus-ring)] focus:outline-none"
              onClick={onClose}
              type="button"
            >
              <Icon className="text-[18px]" name="close" />
            </button>
          </div>

          <p className="mt-1 truncate text-xs font-semibold text-[var(--on-surface-variant)]">{email}</p>
          <p className="mt-2 text-xs leading-5 text-[var(--on-surface-variant)]">{description}</p>

          <div className="mt-3 rounded-[12px] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-center text-xl font-black tracking-[0.28em] text-[var(--primary)]">
            {code}
          </div>

          <Button className="mt-3 w-full" onClick={copyCode} size="sm" variant="outline">
            Copy mã
          </Button>
        </div>
      </div>
    </aside>
  );
}
