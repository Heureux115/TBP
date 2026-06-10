"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthLogo } from "@/components/auth-logo";
import { login } from "@/lib/api";
import { saveTokens } from "@/lib/auth-storage";

const loginImage =
  "/login.png";

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
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d]">
      <header className="fixed inset-x-0 top-0 z-50 flex h-20 items-center border-b border-[#c1c7d1] bg-white px-5 shadow-sm sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <AuthLogo />
          <Link
            className="rounded-lg border border-[#004271] px-4 py-2 text-sm font-semibold text-[#004271] transition hover:bg-[#d1e4ff]"
            href="/register"
          >
            Đăng ký
          </Link>
        </div>
      </header>

      <div className="flex min-h-screen flex-col pt-20 md:flex-row">
        <section className="relative hidden w-1/2 overflow-hidden bg-[#f0f3ff] md:block">
          <img
            alt="Học viên và gia sư học tập cùng nhau"
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            src={loginImage}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f9f9ff]/85 to-transparent" />
          <div className="absolute right-10 bottom-12 left-10">
            <div className="rounded-xl border border-[#c1c7d1]/40 bg-white/90 p-6 shadow-sm backdrop-blur">
              <h1 className="mb-2 text-3xl font-bold text-[#00497c]">
                Chào mừng trở lại
              </h1>
              <p className="text-lg leading-8 text-[#414750]">
                Tiếp tục quản lý lịch học, hồ sơ gia sư và các kết nối học tập
                của bạn trên TutorConnect.
              </p>
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center bg-white p-6 md:w-1/2 lg:p-10">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <h2 className="mb-1 text-3xl font-bold text-[#111c2d]">
                Đăng nhập
              </h2>
              <p className="text-base text-[#414750]">
                Sử dụng tài khoản học sinh, gia sư hoặc quản trị viên.
              </p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#414750]">
                  Email
                </span>
                <input
                  autoComplete="email"
                  className="w-full rounded-lg border border-[#c1c7d1] bg-[#f9f9ff] px-4 py-3 text-base outline-none transition focus:border-[#004271] focus:ring-2 focus:ring-[#d1e4ff]"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="example@email.com"
                  required
                  type="email"
                  value={email}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#414750]">
                  Mật khẩu
                </span>
                <div className="relative">
                  <input
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-[#c1c7d1] bg-[#f9f9ff] px-4 py-3 pr-20 text-base outline-none transition focus:border-[#004271] focus:ring-2 focus:ring-[#d1e4ff]"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Nhập mật khẩu"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-sm font-semibold text-[#004271]"
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                  >
                    {showPassword ? "Ẩn" : "Hiện"}
                  </button>
                </div>
              </label>

              <div className="text-right">
                <Link className="text-sm font-semibold text-[#004271] transition hover:underline" href="/auth/forgot-password">
                  Quên mật khẩu?
                </Link>
              </div>

              <button
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#004271] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#001d35] disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            {error ? <p className="mt-4 text-sm text-[#ba1a1a]">{error}</p> : null}

            <p className="mt-6 text-center text-base text-[#414750]">
              Chưa có tài khoản?{" "}
              <Link
                className="font-medium text-[#004271] transition hover:underline"
                href="/register"
              >
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
