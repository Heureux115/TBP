"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, ClipboardEvent, FormEvent, Suspense, useMemo, useRef, useState } from "react";
import { AuthFormCard, AuthNotice, AuthShell } from "@/components/auth/auth-shell";
import { AUTH_CODE_NOTICE_KEYS, AuthCodeNotification, readAuthCodeNotice } from "@/components/auth/auth-code-notification";
import { Button, Icon, StatusBadge } from "@/components/ui";
import { resendVerification, verifyEmail } from "@/lib/api";
import { useHasMounted } from "@/lib/use-has-mounted";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasMounted = useHasMounted();
  const email = searchParams.get("email") || "";
  const next = searchParams.get("next") || "/dashboard";
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCodeNoticeClosed, setIsCodeNoticeClosed] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const code = useMemo(() => digits.join(""), [digits]);
  const codeNotice =
    hasMounted && !isCodeNoticeClosed && email
      ? readAuthCodeNotice(AUTH_CODE_NOTICE_KEYS.verification, email)
      : null;

  function closeCodeNotice() {
    window.sessionStorage.removeItem(AUTH_CODE_NOTICE_KEYS.verification);
    setIsCodeNoticeClosed(true);
  }

  function updateDigit(index: number, value: string) {
    const nextValue = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = nextValue;
      return next;
    });

    if (nextValue && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

    if (!pasted) {
      return;
    }

    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((digit, index) => {
      next[index] = digit;
    });
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, 6) - 1]?.focus();
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      await verifyEmail({ email, token: code });
      setMessage("Email đã được xác thực. Đang chuyển tới đăng nhập...");
      setTimeout(() => router.push(`/auth/login?next=${encodeURIComponent(next)}`), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mã xác thực không hợp lệ.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await resendVerification({ email });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi lại mã.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!hasMounted) {
    return null;
  }

  return (
    <AuthShell
      asideDescription="Mã xác thực giúp bảo vệ tài khoản trước khi bạn đặt lịch, nhắn tin hoặc nhận lớp trên TutorConnect."
      asideTitle="Xác nhận email để bắt đầu an toàn"
      headerAction={
        <div className="flex items-center gap-2">
          <Link
            className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] px-3 py-2 text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--surface-container-low)] focus:shadow-[var(--focus-ring)] focus:outline-none"
            href="/auth/login"
          >
            Đăng nhập
          </Link>
          <Link
            className="hidden min-h-11 items-center rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--on-primary)] transition hover:bg-[var(--primary-container)] focus:shadow-[var(--focus-ring)] focus:outline-none sm:inline-flex"
            href="/register"
          >
            Tạo tài khoản
          </Link>
        </div>
      }
    >
      <AuthFormCard
        description="Nhập mã 6 chữ số trong email để hoàn tất bước bảo mật tài khoản."
        title="Xác thực email"
      >
        <div className="mb-5 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--status-info-border)] bg-[var(--status-info-bg)]/50 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-full)] bg-[var(--surface-container-lowest)] text-[var(--primary)]">
            <Icon name="mail" />
          </span>
          <div className="min-w-0">
            <StatusBadge tone={email ? "info" : "warning"}>{email ? "Đã gửi mã" : "Thiếu email"}</StatusBadge>
            <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
              Chúng tôi đã gửi mã tới{" "}
              <strong className="font-black text-[var(--on-surface)]">{email || "email của bạn"}</strong>.
            </p>
          </div>
        </div>

        <form onSubmit={handleVerify}>
          <fieldset disabled={isSubmitting}>
            <legend className="mb-3 text-sm font-bold text-[var(--on-surface)]">Mã xác thực</legend>
            <div className="grid grid-cols-6 gap-2 sm:gap-3">
              {digits.map((digit, index) => (
                <input
                  aria-label={`Chữ số ${index + 1}`}
                  autoFocus={index === 0}
                  className="h-12 min-w-0 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-center text-xl font-black text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)] sm:h-14 sm:text-2xl"
                  inputMode="numeric"
                  key={index}
                  maxLength={1}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => updateDigit(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace" && !digits[index] && index > 0) {
                      inputsRef.current[index - 1]?.focus();
                    }
                  }}
                  onPaste={handlePaste}
                  ref={(element) => {
                    inputsRef.current[index] = element;
                  }}
                  value={digit}
                />
              ))}
            </div>
          </fieldset>

          <Button
            className="mt-5 w-full"
            disabled={code.length !== 6 || !email}
            isLoading={isSubmitting}
            rightIcon={<Icon className="text-[18px]" name="verified" />}
            size="lg"
            type="submit"
          >
            {isSubmitting ? "Đang xác thực" : "Xác thực email"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm leading-6 text-[var(--on-surface-variant)]">
          Chưa nhận được mã?{" "}
          <button
            className="font-bold text-[var(--primary)] hover:underline disabled:opacity-60"
            disabled={isSubmitting || !email}
            onClick={handleResend}
            type="button"
          >
            Gửi lại mã
          </button>
        </p>

        {message ? <AuthNotice tone="success">{message}</AuthNotice> : null}
        {error ? <AuthNotice>{error}</AuthNotice> : null}
      </AuthFormCard>

      {codeNotice ? (
        <AuthCodeNotification
          code={codeNotice.code}
          email={codeNotice.email}
          kind="verification"
          onClose={closeCodeNotice}
        />
      ) : null}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
