"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { getAccessToken } from "@/lib/auth-storage";
import { getPayment, Payment } from "@/lib/payment-api";
import { useHasMounted } from "@/lib/use-has-mounted";

function Icon({ name, fill = false, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return <span aria-hidden="true" className={["material-symbols-outlined", fill ? "icon-fill" : "", className].join(" ")}>{name}</span>;
}

export default function PaymentFailedPage() {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (!hasMounted) return;
    const token = getAccessToken();
    const paymentId = new URLSearchParams(window.location.search).get("paymentId");
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    if (paymentId) {
      getPayment(token, paymentId).then(setPayment).catch(() => setPayment(null));
    }
  }, [hasMounted, router]);

  if (!hasMounted) {
    return <main className="min-h-screen bg-[var(--surface)]" />;
  }

  return (
    <main className="min-h-screen bg-[var(--surface)] pt-20 text-[var(--on-surface)]">
      <header className="fixed left-0 top-0 z-50 flex h-20 w-full items-center justify-between border-b border-[var(--outline-variant)] bg-white px-5 shadow-sm md:px-10">
        <BrandLogo className="text-[var(--primary)]" />
        <Link className="rounded-full p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]" href="/messages" aria-label="Hỗ trợ">
          <Icon name="help" />
        </Link>
      </header>

      <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-5 py-12">
        <div className="w-full max-w-[580px] text-center">
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--error-container)] text-[var(--error)]">
            <Icon className="text-5xl" fill name="error" />
            <div className="absolute -z-10 h-48 w-48 rounded-full bg-[var(--error)]/10 blur-3xl" />
          </div>
          <h1 className="text-3xl font-black">Thanh toán thất bại</h1>
          <p className="mx-auto mt-3 max-w-lg text-[var(--on-surface-variant)]">
            Giao dịch chưa hoàn tất. Bạn có thể thử lại từ lịch sử thanh toán hoặc liên hệ hỗ trợ nếu lỗi tiếp tục xảy ra.
          </p>

          <div className="my-8 flex flex-col gap-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-6 text-left">
            <DetailRow label="Mã lỗi" value="ERR_PAY_402" danger />
            <div className="h-px bg-[var(--outline-variant)]" />
            <DetailRow label="Mã giao dịch" value={payment ? `#TC-${payment.id.slice(0, 8).toUpperCase()}` : "Chưa xác định"} />
            <DetailRow label="Mã lịch học" value={payment ? `#${payment.bookingId.slice(0, 8).toUpperCase()}` : "Chưa xác định"} />
          </div>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-4 text-sm font-bold text-white shadow-sm" href="/payments">
              <Icon name="refresh" />
              Thử lại
            </Link>
            <Link className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-lg border border-[var(--primary)] px-5 py-4 text-sm font-bold text-[var(--primary)]" href="/messages">
              <Icon name="support_agent" />
              Liên hệ hỗ trợ
            </Link>
          </div>
          <Link className="mt-8 inline-flex items-center gap-1 text-sm font-bold text-[var(--on-surface-variant)] hover:text-[var(--primary)]" href="/">
            <Icon className="text-base" name="arrow_back" />
            Về trang chủ
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 border-t border-[var(--outline-variant)] px-5 py-12 md:grid-cols-3 md:px-10">
        <InfoCard icon="credit_card" title="Kiểm tra số dư" text="Đảm bảo tài khoản hoặc ví có đủ số tiền trước khi thử lại." />
        <InfoCard icon="security" title="Xác minh thông tin" text="Kiểm tra lại phương thức thanh toán và kết nối ngân hàng." />
        <InfoCard icon="account_balance" title="Liên hệ ngân hàng" text="Một số giao dịch học tập có thể bị ngân hàng chặn tạm thời." />
      </section>
    </main>
  );
}

function DetailRow({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-bold text-[var(--on-surface-variant)]">{label}</span>
      <span className={`rounded px-2 py-1 text-sm font-bold ${danger ? "bg-[var(--error-container)] text-[var(--error)]" : ""}`}>{value}</span>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <article className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <Icon className="mb-3 text-3xl text-[var(--primary)]" name={icon} />
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">{text}</p>
    </article>
  );
}
