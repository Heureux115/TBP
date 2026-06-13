import Image from "next/image";
import type { InputHTMLAttributes, ReactNode } from "react";
import { AuthLogo } from "@/components/auth-logo";
import { Card, Icon, StatusBadge } from "@/components/ui";

type TrustPoint = {
  icon: string;
  text: string;
};

const defaultTrustPoints: TrustPoint[] = [
  { icon: "verified_user", text: "Hồ sơ gia sư và lịch học được kiểm tra rõ ràng" },
  { icon: "event_available", text: "Đặt lịch, trao đổi và theo dõi buổi học trong một nơi" },
  { icon: "payments", text: "Thông tin học phí minh bạch trước khi xác nhận" },
];

export function AuthShell({
  asideDescription,
  asideTitle,
  children,
  headerAction,
  trustPoints = defaultTrustPoints,
}: {
  asideDescription: string;
  asideTitle: string;
  children: ReactNode;
  headerAction?: ReactNode;
  trustPoints?: TrustPoint[];
}) {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <header className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
        <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <AuthLogo />
          {headerAction}
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.8fr)] lg:px-10 lg:py-10">
        <section className="hidden min-h-[640px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] lg:block">
          <div className="relative h-full">
            <Image
              alt="Học viên và gia sư cùng trao đổi trong buổi học"
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 52vw, 100vw"
              src="/login.png"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[rgb(17_28_45_/_0.04)] via-[rgb(17_28_45_/_0.18)] to-[rgb(17_28_45_/_0.72)]" />
            <div className="absolute inset-x-6 bottom-6">
              <Card className="border-white/45 bg-white/95 p-6 shadow-[var(--shadow-raised)]" tone="default">
                <StatusBadge tone="info">Nền tảng gia sư Việt Nam</StatusBadge>
                <h1 className="mt-4 text-3xl font-black leading-tight text-[var(--primary)]">{asideTitle}</h1>
                <p className="mt-3 max-w-xl text-base leading-7 text-[var(--on-surface-variant)]">{asideDescription}</p>
                <div className="mt-5 grid gap-3">
                  {trustPoints.map((point) => (
                    <div className="flex items-start gap-3 text-sm font-semibold text-[var(--on-surface)]" key={point.text}>
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-full)] bg-[var(--primary-fixed)] text-[var(--primary)]">
                        <Icon className="text-[20px]" name={point.icon} />
                      </span>
                      <span className="leading-6">{point.text}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="flex min-w-0 items-center justify-center">{children}</section>
      </div>
    </main>
  );
}

export function AuthFormCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="w-full max-w-[480px] p-5 sm:p-7" tone="default">
      <div className="mb-6">
        <h1 className="text-2xl font-black leading-tight text-[var(--on-surface)] sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">{description}</p>
      </div>
      {children}
    </Card>
  );
}

export function AuthField({
  className = "",
  helper,
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  helper?: string;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-[var(--on-surface)]">{label}</span>
      <input
        className={`min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)] disabled:opacity-60 ${className}`}
        {...props}
      />
      {helper ? <span className="mt-1.5 block text-xs leading-5 text-[var(--on-surface-variant)]">{helper}</span> : null}
    </label>
  );
}

export function AuthNotice({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success";
}) {
  const isError = tone === "error";

  return (
    <div
      className={`mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm font-semibold leading-6 ${
        isError
          ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
          : "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
      }`}
      role={isError ? "alert" : "status"}
    >
      <Icon className="mt-0.5 text-[20px]" fill name={isError ? "error" : "check_circle"} />
      <span>{children}</span>
    </div>
  );
}
