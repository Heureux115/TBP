"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FormEvent, useState } from "react";
import { AuthField, AuthFormCard, AuthNotice, AuthShell } from "@/components/auth/auth-shell";
import { Button, Icon } from "@/components/ui";
import { resetPassword } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--surface)]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await resetPassword({ email, token, password });
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể đặt lại mật khẩu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      asideDescription="Sau khi đổi mật khẩu, bạn có thể đăng nhập lại để tiếp tục quản lý lịch học, thanh toán và tin nhắn."
      asideTitle="Đặt lại mật khẩu trong vài bước"
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
        description="Nhập mã trong email và tạo mật khẩu mới đủ mạnh cho tài khoản của bạn."
        title="Đặt lại mật khẩu"
      >
        <Link className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-[var(--primary)] hover:underline" href="/auth/login">
          <Icon className="text-[18px]" name="arrow_back" />
          Quay lại đăng nhập
        </Link>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <AuthField
            autoComplete="email"
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ban@example.com"
            required
            type="email"
            value={email}
          />
          <AuthField
            autoComplete="one-time-code"
            helper="Mã được gửi tới email khi bạn yêu cầu đặt lại mật khẩu."
            label="Mã đặt lại"
            onChange={(event) => setToken(event.target.value)}
            placeholder="Nhập mã trong email"
            required
            type="text"
            value={token}
          />
          <AuthField
            autoComplete="new-password"
            helper="Ít nhất 8 ký tự, có chữ hoa, số và ký tự đặc biệt."
            label="Mật khẩu mới"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password@123"
            required
            type="password"
            value={password}
          />

          <Button
            className="w-full"
            isLoading={isSubmitting}
            rightIcon={<Icon className="text-[18px]" name="lock_reset" />}
            size="lg"
            type="submit"
          >
            {isSubmitting ? "Đang cập nhật" : "Đặt lại mật khẩu"}
          </Button>
        </form>

        {message ? (
          <AuthNotice tone="success">
            {message}{" "}
            <Link className="font-black underline" href="/auth/login">
              Đăng nhập
            </Link>
          </AuthNotice>
        ) : null}
        {error ? <AuthNotice>{error}</AuthNotice> : null}
      </AuthFormCard>
    </AuthShell>
  );
}
