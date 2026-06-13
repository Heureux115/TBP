"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthField, AuthFormCard, AuthNotice, AuthShell } from "@/components/auth/auth-shell";
import { Button, Icon } from "@/components/ui";
import { login } from "@/lib/api";
import { saveTokens } from "@/lib/auth-storage";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await login({ email, password });
      saveTokens(result);
      const next = new URLSearchParams(window.location.search).get("next");

      if (next) {
        router.push(next);
        return;
      }

      if (result.user.role === "ADMIN" || result.user.role === "SUPER_ADMIN") {
        router.push("/admin/dashboard");
        return;
      }

      if (result.user.role === "TUTOR") {
        router.push("/tutor/dashboard");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      asideDescription="Tiếp tục quản lý lịch học, tin nhắn và hồ sơ gia sư trong một không gian rõ ràng cho học viên, phụ huynh và gia sư."
      asideTitle="Chào mừng trở lại TutorConnect"
      headerAction={
        <Link
          className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--outline-variant)] px-4 py-2 text-sm font-bold text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-[var(--surface-container-low)] focus:shadow-[var(--focus-ring)] focus:outline-none"
          href="/register"
        >
          Tạo tài khoản
        </Link>
      }
    >
      <AuthFormCard
        description="Dùng email đã đăng ký để vào khu vực học viên, gia sư hoặc quản trị viên."
        title="Đăng nhập"
      >
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

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-[var(--on-surface)]">Mật khẩu</span>
            <div className="relative">
              <input
                autoComplete="current-password"
                className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 pr-24 text-base text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute top-1/2 right-2 inline-flex min-h-11 -translate-y-1/2 items-center gap-1 rounded-[var(--radius-md)] px-2 text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--surface-container-low)] focus:shadow-[var(--focus-ring)] focus:outline-none"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                <Icon className="text-[18px]" name={showPassword ? "visibility_off" : "visibility"} />
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--on-surface-variant)]">Bảo mật tài khoản sau mỗi buổi học.</span>
            <Link className="shrink-0 font-bold text-[var(--primary)] hover:underline" href="/auth/forgot-password">
              Quên mật khẩu?
            </Link>
          </div>

          <Button
            className="w-full"
            isLoading={isSubmitting}
            rightIcon={<Icon className="text-[18px]" name="arrow_forward" />}
            size="lg"
            type="submit"
          >
            {isSubmitting ? "Đang đăng nhập" : "Đăng nhập"}
          </Button>
        </form>

        {error ? <AuthNotice>{error}</AuthNotice> : null}

        <p className="mt-6 text-center text-sm leading-6 text-[var(--on-surface-variant)]">
          Chưa có tài khoản?{" "}
          <Link className="font-bold text-[var(--primary)] hover:underline" href="/register">
            Đăng ký để tìm gia sư hoặc nhận lớp
          </Link>
        </p>
      </AuthFormCard>
    </AuthShell>
  );
}
