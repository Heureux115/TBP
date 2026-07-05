"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthField, AuthFormCard, AuthNotice, AuthShell } from "@/components/auth/auth-shell";
import { AUTH_CODE_NOTICE_KEYS, saveAuthCodeNotice } from "@/components/auth/auth-code-notification";
import { Button, Icon } from "@/components/ui";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await forgotPassword({ email });
      const normalizedEmail = email.trim().toLowerCase();
      if (result.resetCode) {
        saveAuthCodeNotice(AUTH_CODE_NOTICE_KEYS.passwordReset, {
          code: result.resetCode,
          email: normalizedEmail,
        });
        router.push(`/auth/reset-password?email=${encodeURIComponent(normalizedEmail)}`);
        return;
      }

      setMessage(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể gửi mã đặt lại mật khẩu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      asideDescription="Chúng tôi chỉ gửi mã đặt lại tới email đã đăng ký, giúp bạn quay lại lịch học và tin nhắn mà không làm lộ thông tin tài khoản."
      asideTitle="Khôi phục tài khoản an toàn"
      headerAction={
        <Link
          className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--outline-variant)] px-4 py-2 text-sm font-bold text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-[var(--surface-container-low)] focus:shadow-[var(--focus-ring)] focus:outline-none"
          href="/auth/login"
        >
          Đăng nhập
        </Link>
      }
    >
      <AuthFormCard
        description="Nhập email tài khoản. Nếu email tồn tại, hệ thống sẽ gửi mã đặt lại mật khẩu."
        title="Quên mật khẩu"
      >
        <Link className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-[var(--primary)] hover:underline" href="/auth/login">
          <Icon className="text-[18px]" name="arrow_back" />
          Quay lại đăng nhập
        </Link>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <AuthField
            autoComplete="email"
            helper="Dùng đúng email đã đăng ký học viên hoặc gia sư."
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ban@example.com"
            required
            type="email"
            value={email}
          />

          <Button
            className="w-full"
            isLoading={isSubmitting}
            rightIcon={<Icon className="text-[18px]" name="mail" />}
            size="lg"
            type="submit"
          >
            {isSubmitting ? "Đang gửi mã" : "Gửi mã đặt lại"}
          </Button>
        </form>

        {message ? (
          <AuthNotice tone="success">
            {message}{" "}
            <Link className="font-black underline" href={`/auth/reset-password?email=${encodeURIComponent(email)}`}>
              Nhập mã đặt lại
            </Link>
          </AuthNotice>
        ) : null}
        {error ? <AuthNotice>{error}</AuthNotice> : null}
      </AuthFormCard>
    </AuthShell>
  );
}
