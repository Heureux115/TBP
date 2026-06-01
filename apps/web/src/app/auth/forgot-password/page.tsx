"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
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
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể gửi mã đặt lại mật khẩu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9f9ff] px-5 text-[#111c2d]">
      <section className="w-full max-w-md rounded-xl border border-[#c1c7d1] bg-white p-6 shadow-sm">
        <Link className="mb-6 inline-flex text-sm font-semibold text-[#004271]" href="/auth/login">
          Quay lại đăng nhập
        </Link>
        <h1 className="text-3xl font-bold">Quên mật khẩu</h1>
        <p className="mt-2 text-sm leading-6 text-[#414750]">
          Nhập email tài khoản để nhận mã đặt lại mật khẩu.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#414750]">Email</span>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-[#c1c7d1] bg-[#f9f9ff] px-4 py-3 outline-none focus:border-[#004271] focus:ring-2 focus:ring-[#d1e4ff]"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <button className="w-full rounded-lg bg-[#004271] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Đang gửi..." : "Gửi mã đặt lại"}
          </button>
        </form>
        {message ? (
          <div className="mt-4 rounded-lg bg-[#eef7ee] p-3 text-sm font-semibold text-[#0f5f2f]">
            {message}{" "}
            <Link className="underline" href={`/auth/reset-password?email=${encodeURIComponent(email)}`}>
              Nhập mã
            </Link>
          </div>
        ) : null}
        {error ? <p className="mt-4 text-sm text-[#ba1a1a]">{error}</p> : null}
      </section>
    </main>
  );
}
