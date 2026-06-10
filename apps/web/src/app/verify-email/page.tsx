"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, ClipboardEvent, FormEvent, Suspense, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { resendVerification, verifyEmail } from "@/lib/api";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const next = searchParams.get("next") || "/dashboard";
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const code = useMemo(() => digits.join(""), [digits]);

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

  return (
    <main className="flex min-h-screen flex-col bg-[#f9f9ff] text-[#111c2d]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#c1c7d1] bg-white shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <BrandLogo />
          <div className="flex items-center gap-3">
            <Link className="rounded-lg px-4 py-2 text-sm font-semibold text-[#004271] hover:bg-[#dee8ff]" href="/auth/login">
              Đăng nhập
            </Link>
            <Link className="rounded-lg bg-[#004271] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d5a94]" href="/register">
              Đăng ký làm gia sư
            </Link>
          </div>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 pt-28 pb-12">
        <div className="flex w-full max-w-[480px] flex-col items-center rounded-xl border border-[#c1c7d1] bg-white p-8 text-center shadow-[0_4px_12px_rgba(30,41,59,0.05)]">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#e7eeff] text-4xl text-[#004271]">
            <span className="material-symbols-outlined">mail</span>
          </div>
          <h1 className="mb-1 text-3xl font-bold text-[#111c2d]">Xác thực email</h1>
          <p className="mb-8 text-base leading-7 text-[#414750]">
            Chúng tôi đã gửi mã xác thực 6 chữ số tới <br />
            <strong className="font-semibold text-[#111c2d]">{email || "email của bạn"}</strong>.
          </p>

          <form className="w-full" onSubmit={handleVerify}>
            <div className="mb-8 flex w-full justify-between gap-2 sm:gap-3">
              {digits.map((digit, index) => (
                <input
                  autoFocus={index === 0}
                  className="h-14 w-12 rounded-lg border border-[#c1c7d1] bg-[#f9f9ff] text-center text-2xl font-semibold text-[#111c2d] shadow-sm outline-none transition focus:border-[#004271] focus:ring-2 focus:ring-[#004271]/20 sm:h-16 sm:w-14"
                  inputMode="numeric"
                  key={index}
                  maxLength={1}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateDigit(index, event.target.value)
                  }
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

            <button
              className="mb-4 w-full rounded-lg bg-[#004271] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d5a94] disabled:opacity-60"
              disabled={isSubmitting || code.length !== 6 || !email}
              type="submit"
            >
              Xác thực mã
            </button>
          </form>

          <p className="text-sm text-[#414750]">
            Chưa nhận được mã?{" "}
            <button
              className="font-semibold text-[#004271] hover:underline disabled:opacity-60"
              disabled={isSubmitting || !email}
              onClick={handleResend}
              type="button"
            >
              Gửi lại mã
            </button>
          </p>

          {message ? <p className="mt-4 text-sm text-[#006444]">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-[#ba1a1a]">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
