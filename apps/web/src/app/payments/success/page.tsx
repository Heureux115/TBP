"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth-storage";
import { getPayment, Payment } from "@/lib/payment-api";
import { useHasMounted } from "@/lib/use-has-mounted";

function Icon({ name, fill = false, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return <span className={["material-symbols-outlined", fill ? "icon-fill" : "", className].join(" ")}>{name}</span>;
}

function formatMoney(value: string, currency = "VND") {
  const suffix = currency === "VND" ? "đ" : ` ${currency}`;
  return `${new Intl.NumberFormat("vi-VN").format(Number(value))}${suffix}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PaymentSuccessPage() {
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
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--surface)] text-[var(--on-surface)]">
      <header className="z-10 flex h-20 items-center px-5 md:px-10">
        <Link className="text-2xl font-black text-[var(--primary)]" href="/">TutorConnect</Link>
      </header>
      <section className="z-10 flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[620px] rounded-xl border border-[var(--outline-variant)] bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--tertiary-fixed-dim)] text-[var(--tertiary)]">
            <Icon className="text-5xl" fill name="check_circle" />
          </div>
          <h1 className="text-3xl font-black text-[var(--primary)]">Thanh toán thành công</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--on-surface-variant)]">
            Lịch học đã được xác nhận. Thông tin giao dịch được lưu trong lịch sử thanh toán.
          </p>

          <div className="my-8 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-5">
            <p className="text-xs font-bold uppercase text-[var(--outline)]">Số tiền đã thanh toán</p>
            <p className="mt-1 text-3xl font-black text-[var(--secondary)]">
              {payment ? formatMoney(payment.amount, payment.currency) : "Đã ghi nhận"}
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 text-left md:grid-cols-2">
            <SummaryCard icon="person" label="Gia sư" value={payment?.tutor.fullName || "Gia sư TutorConnect"} />
            <SummaryCard icon="calendar_today" label="Thời gian học" value={payment ? formatDate(payment.booking.startsAt) : "Đã xác nhận"} />
            <SummaryCard icon="school" label="Mã lịch học" value={payment ? `#${payment.bookingId.slice(0, 8).toUpperCase()}` : "Lịch học mới"} wide />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="flex-1 rounded-lg bg-[var(--primary)] px-5 py-4 text-sm font-bold text-white shadow-sm" href="/dashboard">
              Xem lịch học
            </Link>
            <Link className="flex-1 rounded-lg border border-[var(--primary)] px-5 py-4 text-sm font-bold text-[var(--primary)]" href="/payments">
              Quay lại thanh toán
            </Link>
          </div>
          {payment ? (
            <Link className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[var(--primary)] hover:underline" href={`/payments/${payment.id}`}>
              <Icon className="text-base" name="receipt_long" />
              Xem hóa đơn
            </Link>
          ) : null}
        </div>
      </section>
      <div className="pointer-events-none absolute left-[5%] top-[12%] h-64 w-64 rounded-full bg-[var(--primary-fixed)] opacity-20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[15%] right-[5%] h-80 w-80 rounded-full bg-[var(--secondary-fixed)] opacity-20 blur-3xl" />
    </main>
  );
}

function SummaryCard({ icon, label, value, wide = false }: { icon: string; label: string; value: string; wide?: boolean }) {
  return (
    <article className={`flex items-center gap-4 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-bright)] p-4 ${wide ? "md:col-span-2" : ""}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-[var(--primary)]">
        <Icon name={icon} />
      </div>
      <div>
        <p className="text-xs font-bold text-[var(--outline)]">{label}</p>
        <p className="font-black">{value}</p>
      </div>
    </article>
  );
}
