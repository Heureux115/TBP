"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthField, AuthFormCard, AuthNotice, AuthShell } from "@/components/auth/auth-shell";
import { AUTH_CODE_NOTICE_KEYS, saveAuthCodeNotice } from "@/components/auth/auth-code-notification";
import { Button, Icon, StatusBadge } from "@/components/ui";
import { register } from "@/lib/api";

const roleOptions: Array<{
  description: string;
  icon: string;
  label: string;
  value: "STUDENT" | "TUTOR";
}> = [
  {
    description: "Tìm gia sư, đặt lịch học và theo dõi tiến độ.",
    icon: "school",
    label: "Học viên / phụ huynh",
    value: "STUDENT",
  },
  {
    description: "Tạo hồ sơ, nhận lớp và quản lý lịch dạy.",
    icon: "workspace_premium",
    label: "Gia sư",
    value: "TUTOR",
  },
];

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
      const result = await register({
        email,
        password,
        fullName,
        role,
      });
      const normalizedEmail = email.trim().toLowerCase();
      const next = role === "TUTOR" ? "/tutor/onboarding" : "/dashboard";
      saveAuthCodeNotice(AUTH_CODE_NOTICE_KEYS.verification, {
        code: result.verificationCode,
        email: normalizedEmail,
      });
      router.push(
        `/verify-email?email=${encodeURIComponent(normalizedEmail)}&next=${encodeURIComponent(next)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      asideDescription="Tạo tài khoản phù hợp với nhu cầu của bạn: tìm gia sư tin cậy cho việc học, hoặc xây dựng hồ sơ gia sư để nhận lớp minh bạch."
      asideTitle="Bắt đầu đúng vai trò của bạn"
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
        description="Sau khi tạo tài khoản, TutorConnect sẽ gửi mã xác thực email trước khi bạn vào không gian làm việc."
        title="Tạo tài khoản"
      >
        <form className="space-y-4" onSubmit={handleRegister}>
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-[var(--on-surface)]">Bạn dùng TutorConnect với vai trò nào?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {roleOptions.map((option) => {
                const selected = role === option.value;

                return (
                  <label className="cursor-pointer" key={option.value}>
                    <input
                      checked={selected}
                      className="peer sr-only"
                      name="role"
                      onChange={() => setRole(option.value)}
                      type="radio"
                    />
                    <span className="flex h-full flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 text-left transition peer-checked:border-[var(--primary)] peer-checked:bg-[var(--primary-fixed)] peer-focus-visible:shadow-[var(--focus-ring)]">
                      <span className="flex items-center justify-between gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-full)] bg-[var(--surface-container-low)] text-[var(--primary)]">
                          <Icon name={option.icon} />
                        </span>
                        {selected ? <StatusBadge tone="info">Đang chọn</StatusBadge> : null}
                      </span>
                      <span>
                        <span className="block text-sm font-black text-[var(--on-surface)]">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--on-surface-variant)]">{option.description}</span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <AuthField
            autoComplete="name"
            label="Họ và tên"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nguyễn Minh Anh"
            required
            value={fullName}
          />

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
            autoComplete="new-password"
            helper="Ít nhất 8 ký tự, có chữ hoa, số và ký tự đặc biệt."
            label="Mật khẩu"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password@123"
            required
            type="password"
            value={password}
          />

          <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3 text-sm leading-6 text-[var(--on-surface-variant)]">
            <input
              checked={acceptedTerms}
              className="mt-1 h-4 w-4 rounded border-[var(--outline-variant)] text-[var(--primary)] focus:shadow-[var(--focus-ring)]"
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              required
              type="checkbox"
            />
            <span>
              Tôi đồng ý với{" "}
              <a className="font-bold text-[var(--primary)] hover:underline" href="#">
                Điều khoản dịch vụ
              </a>{" "}
              và{" "}
              <a className="font-bold text-[var(--primary)] hover:underline" href="#">
                Chính sách bảo mật
              </a>
              .
            </span>
          </label>

          <Button
            className="w-full"
            disabled={!acceptedTerms}
            isLoading={isSubmitting}
            rightIcon={<Icon className="text-[18px]" name="arrow_forward" />}
            size="lg"
            type="submit"
          >
            {isSubmitting ? "Đang tạo tài khoản" : "Tạo tài khoản"}
          </Button>
        </form>

        {error ? <AuthNotice>{error}</AuthNotice> : null}

        <p className="mt-6 text-center text-sm leading-6 text-[var(--on-surface-variant)]">
          Đã có tài khoản?{" "}
          <Link className="font-bold text-[var(--primary)] hover:underline" href="/auth/login">
            Đăng nhập
          </Link>
        </p>
      </AuthFormCard>

    </AuthShell>
  );
}
