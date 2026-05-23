"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
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
    <main className="relative min-h-screen overflow-hidden bg-[#f9f9ff] text-[#111c2d]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#c1c7d1] bg-white shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link
            className="flex items-center gap-2 text-2xl font-bold text-[#004271]"
            href="/"
          >
            <span aria-hidden="true">🎓</span>
            TutorConnect
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-[#414750] hover:bg-[#dee8ff] hover:text-[#004271]" href="/">
              Find Tutors
            </Link>
            <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-[#414750] hover:bg-[#dee8ff] hover:text-[#004271]" href="/">
              How it Works
            </Link>
            <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-[#414750] hover:bg-[#dee8ff] hover:text-[#004271]" href="/">
              Resources
            </Link>
          </nav>
          <Link
            className="rounded-lg bg-[#004271] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            href="/register"
          >
            Join as Tutor
          </Link>
        </div>
      </header>

      <div className="absolute top-0 right-0 -z-0 h-full w-1/2 rounded-bl-[120px] bg-gradient-to-bl from-[#d1e4ff]/60 to-transparent" />
      <div className="absolute bottom-0 left-0 -z-0 h-1/2 w-1/3 rounded-tr-[100px] bg-gradient-to-tr from-[#dee8ff]/70 to-transparent" />

      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 pt-24 pb-12">
        <div className="w-full max-w-[440px] rounded-xl bg-white p-8 shadow-[0_10px_25px_rgba(30,41,59,0.1)]">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#0d5a94] text-white">
              <span aria-hidden="true" className="text-2xl">
                ↪
              </span>
            </div>
            <h1 className="mb-1 text-2xl font-semibold text-[#111c2d]">
              Welcome Back
            </h1>
            <p className="text-sm text-[#414750]">
              Sign in to continue your learning journey.
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#414750]">
                Email Address
              </span>
              <input
                className="w-full rounded-lg border border-[#c1c7d1] bg-[#f9f9ff] px-4 py-3 text-base outline-none transition focus:border-[#004271] focus:ring-2 focus:ring-[#004271]/20"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="block">
              <span className="mb-1 flex items-center justify-between text-xs font-medium text-[#414750]">
                Password
                <a className="text-[#004271] hover:underline" href="#">
                  Forgot password?
                </a>
              </span>
              <div className="relative">
                <input
                  className="w-full rounded-lg border border-[#c1c7d1] bg-[#f9f9ff] px-4 py-3 pr-12 text-base outline-none transition focus:border-[#004271] focus:ring-2 focus:ring-[#004271]/20"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-[#717781] hover:text-[#111c2d]"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#004271] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              Sign In
              <span aria-hidden="true">→</span>
            </button>
          </form>

          {error ? <p className="mt-4 text-sm text-[#ba1a1a]">{error}</p> : null}

          <div className="my-6 flex items-center gap-2">
            <div className="h-px flex-1 bg-[#c1c7d1]/60" />
            <span className="text-xs text-[#717781]">or continue with</span>
            <div className="h-px flex-1 bg-[#c1c7d1]/60" />
          </div>

          <button
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#c1c7d1] bg-[#f9f9ff] px-4 py-3 text-sm font-semibold text-[#111c2d] transition hover:bg-[#dee8ff] active:scale-95"
            type="button"
          >
            Google
          </button>

          <p className="mt-6 text-center text-sm text-[#414750]">
            Don&apos;t have an account?{" "}
            <Link className="font-semibold text-[#004271] hover:underline" href="/register">
              Sign Up
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
