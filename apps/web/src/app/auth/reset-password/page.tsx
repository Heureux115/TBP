"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FormEvent, useState } from "react";
import { resetPassword } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f9f9ff]" />}>
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
    <main className="flex min-h-screen items-center justify-center bg-[#f9f9ff] px-5 text-[#111c2d]">
      <section className="w-full max-w-md rounded-xl border border-[#c1c7d1] bg-white p-6 shadow-sm">
        <Link className="mb-6 inline-flex text-sm font-semibold text-[#004271]" href="/auth/login">
          Quay lại đăng nhập
        </Link>
        <h1 className="text-3xl font-bold">Đặt lại mật khẩu</h1>
        <p className="mt-2 text-sm leading-6 text-[#414750]">
          Nhập mã từ email và mật khẩu mới của bạn.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Input autoComplete="email" label="Email" onChange={setEmail} type="email" value={email} />
          <Input label="Mã đặt lại" onChange={setToken} type="text" value={token} />
          <Input autoComplete="new-password" label="Mật khẩu mới" onChange={setPassword} type="password" value={password} />
          <button className="w-full rounded-lg bg-[#004271] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
          </button>
        </form>
        {message ? (
          <p className="mt-4 rounded-lg bg-[#eef7ee] p-3 text-sm font-semibold text-[#0f5f2f]">
            {message} <Link className="underline" href="/auth/login">Đăng nhập</Link>
          </p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-[#ba1a1a]">{error}</p> : null}
      </section>
    </main>
  );
}

function Input({
  autoComplete,
  label,
  onChange,
  type,
  value,
}: {
  autoComplete?: string;
  label: string;
  onChange: (value: string) => void;
  type: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#414750]">{label}</span>
      <input
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-[#c1c7d1] bg-[#f9f9ff] px-4 py-3 outline-none focus:border-[#004271] focus:ring-2 focus:ring-[#d1e4ff]"
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
      />
    </label>
  );
}
