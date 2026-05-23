"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { register } from "@/lib/api";

const registerImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDMCVcf2J_CqR-dNOOkE3kyrqPQiKftnK6zsGKlXicNCv2T52oHkg7P_rRvCC_TdrpXdstsFR6-o8PICRYYBUEzOESQZUAUlZx9ivYR0tQDxVOFPxtJCFnWzmfoyPceHdEmu15pWWWbiGKoHdqvbnGlbDZZDMzsuFZ9YLY_bxPl6r8UQZFHT1c3fa3YViC2xAazXRo5qwMsv7VC_7quL9lIoMVDzx6E3LStkGK1rgXBO3h_Oq6wwBB8_MA4H0H8owVEPJWn9-ED5qU";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"STUDENT" | "TUTOR">("STUDENT");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await register({
        email,
        password,
        fullName,
        role,
      });
      const next = role === "TUTOR" ? "/tutor/onboarding" : "/dashboard";
      router.push(
        `/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d]">
      <header className="fixed inset-x-0 top-0 z-50 flex h-20 items-center border-b border-[#c1c7d1] bg-white px-5 shadow-sm sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl items-center">
          <Link
            className="flex items-center gap-2 text-2xl font-bold text-[#004271]"
            href="/"
          >
            <span aria-hidden="true">🎓</span>
            TutorConnect
          </Link>
        </div>
      </header>

      <div className="flex min-h-screen flex-col pt-20 md:flex-row">
        <section className="relative hidden w-1/2 overflow-hidden bg-[#f0f3ff] md:block">
          <img
            alt="Students learning together"
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            src={registerImage}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f9f9ff]/85 to-transparent" />
          <div className="absolute right-10 bottom-12 left-10">
            <div className="rounded-xl border border-[#c1c7d1]/40 bg-white/90 p-6 shadow-sm backdrop-blur">
              <h1 className="mb-2 text-3xl font-bold text-[#00497c]">
                Nâng tầm tri thức
              </h1>
              <p className="text-lg leading-8 text-[#414750]">
                Kết nối với hàng ngàn gia sư chất lượng cao và bắt đầu hành
                trình học tập cá nhân hóa của bạn ngay hôm nay.
              </p>
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center bg-white p-6 md:w-1/2 lg:p-10">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <h2 className="mb-1 text-3xl font-bold text-[#111c2d]">
                Tạo tài khoản mới
              </h2>
              <p className="text-base text-[#414750]">
                Tham gia cộng đồng TutorConnect ngay hôm nay.
              </p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleRegister}>
              <div>
                <p className="mb-2 text-sm font-semibold text-[#111c2d]">
                  Bạn là ai?
                </p>
                <div className="flex gap-4">
                  <label className="flex-1 cursor-pointer">
                    <input
                      checked={role === "STUDENT"}
                      className="peer sr-only"
                      name="role"
                      onChange={() => setRole("STUDENT")}
                      type="radio"
                    />
                    <span className="flex flex-col items-center gap-2 rounded-xl border-2 border-[#c1c7d1] bg-[#f9f9ff] p-4 text-[#414750] transition peer-checked:border-[#004271] peer-checked:bg-[#d1e4ff]/40 peer-checked:text-[#004271]">
                      <span className="text-3xl">👤</span>
                      <span className="text-sm font-semibold">Học sinh</span>
                    </span>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input
                      checked={role === "TUTOR"}
                      className="peer sr-only"
                      name="role"
                      onChange={() => setRole("TUTOR")}
                      type="radio"
                    />
                    <span className="flex flex-col items-center gap-2 rounded-xl border-2 border-[#c1c7d1] bg-[#f9f9ff] p-4 text-[#414750] transition peer-checked:border-[#004271] peer-checked:bg-[#d1e4ff]/40 peer-checked:text-[#004271]">
                      <span className="text-3xl">🏅</span>
                      <span className="text-sm font-semibold">Gia sư</span>
                    </span>
                  </label>
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#414750]">
                  Họ và tên
                </span>
                <input
                  className="w-full rounded-lg border border-[#c1c7d1] bg-[#f9f9ff] px-4 py-3 text-base outline-none transition focus:border-[#004271] focus:ring-2 focus:ring-[#d1e4ff]"
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nguyễn Văn A"
                  required
                  value={fullName}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#414750]">
                  Email
                </span>
                <input
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
                <input
                  className="w-full rounded-lg border border-[#c1c7d1] bg-[#f9f9ff] px-4 py-3 text-base outline-none transition focus:border-[#004271] focus:ring-2 focus:ring-[#d1e4ff]"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password@123"
                  required
                  type="password"
                  value={password}
                />
                <span className="mt-1 block text-xs text-[#717781]">
                  Ít nhất 8 ký tự, có chữ hoa, số và ký tự đặc biệt.
                </span>
              </label>

              <label className="mt-1 flex items-start gap-2 text-sm leading-6 text-[#414750]">
                <input
                  checked={acceptedTerms}
                  className="mt-1 h-4 w-4 rounded border-[#c1c7d1] text-[#004271]"
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  required
                  type="checkbox"
                />
                <span>
                  Tôi đồng ý với các{" "}
                  <a className="font-medium text-[#004271] hover:underline" href="#">
                    Điều khoản dịch vụ
                  </a>{" "}
                  và{" "}
                  <a className="font-medium text-[#004271] hover:underline" href="#">
                    Chính sách bảo mật
                  </a>
                  .
                </span>
              </label>

              <button
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#004271] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#001d35] disabled:opacity-60"
                disabled={isSubmitting || !acceptedTerms}
                type="submit"
              >
                Đăng ký ngay
                <span aria-hidden="true">→</span>
              </button>
            </form>

            {error ? <p className="mt-4 text-sm text-[#ba1a1a]">{error}</p> : null}

            <p className="mt-6 text-center text-base text-[#414750]">
              Đã có tài khoản?{" "}
              <Link
                className="font-medium text-[#004271] transition hover:underline"
                href="/login"
              >
                Đăng nhập
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
