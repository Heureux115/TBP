"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth-storage";
import { getPayment, Payment, PaymentStatus } from "@/lib/payment-api";
import { useHasMounted } from "@/lib/use-has-mounted";

const statusLabels: Record<PaymentStatus, string> = {
  PENDING: "Đang xử lý",
  PAID: "Thanh toán thành công",
  FAILED: "Thanh toán thất bại",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};

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

export function PaymentReceiptScreen({ id }: { id: string }) {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasMounted) return;
    const token = getAccessToken();
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    getPayment(token, id)
      .then(setPayment)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Không thể tải chi tiết giao dịch.");
      });
  }, [hasMounted, id, router]);

  if (!hasMounted) {
    return <ReceiptSkeleton />;
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-5">
        <div className="max-w-md rounded-xl border border-[var(--outline-variant)] bg-white p-6 text-center shadow-sm">
          <Icon className="text-4xl text-[var(--error)]" fill name="error" />
          <h1 className="mt-3 text-xl font-black">Không thể mở hóa đơn</h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">{error}</p>
          <Link className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white" href="/payments">
            Quay lại thanh toán
          </Link>
        </div>
      </main>
    );
  }

  if (!payment) {
    return <ReceiptSkeleton />;
  }

  const serviceFee = Number(payment.platformFeeAmount);
  const subtotal = Number(payment.tutorPayoutAmount);
  const paidAt = payment.paidAt || payment.createdAt;
  const isPaid = payment.status === "PAID";

  return (
    <main className="min-h-screen bg-[var(--surface)] px-5 py-8 text-[var(--on-surface)] md:px-10">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:flex lg:flex-col lg:gap-4">
          <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
            <Link className="mb-6 block text-2xl font-black text-[var(--primary)]" href="/">TutorConnect</Link>
            <nav className="flex flex-col gap-1">
              <SideLink href="/dashboard" icon="dashboard" label="Tổng quan" active={false} />
              <SideLink href="/bookings" icon="event_available" label="Lịch học" active={false} />
              <SideLink href="/messages" icon="mail" label="Tin nhắn" active={false} />
              <SideLink href="/payments" icon="payments" label="Thanh toán" active />
            </nav>
          </div>
          <Link className="rounded-xl bg-[var(--secondary)] py-4 text-center text-sm font-bold text-white shadow-sm" href="/tutors">
            Đặt lịch học mới
          </Link>
        </aside>

        <section className="lg:col-span-9">
          <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <Link className="text-sm font-bold text-[var(--primary)] hover:underline" href="/payments">← Lịch sử thanh toán</Link>
              <h1 className="mt-3 text-3xl font-black text-[var(--primary)]">Chi tiết giao dịch</h1>
              <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Xem và in hóa đơn thanh toán cho lịch học.</p>
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--primary)] px-4 py-3 text-sm font-bold text-[var(--primary)]" onClick={() => window.print()} type="button">
              <Icon name="download" />
              Tải PDF
            </button>
          </header>

          <article className="overflow-hidden rounded-2xl border border-[var(--outline-variant)] bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 bg-[var(--surface-container-low)] p-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
                  <Icon className="text-3xl" name="school" />
                </div>
                <div>
                  <p className="text-xl font-black">TutorConnect</p>
                  <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Biên nhận giao dịch chính thức</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${isPaid ? "bg-[var(--tertiary-fixed)] text-[var(--on-tertiary-fixed)]" : "bg-[var(--secondary-fixed)] text-[var(--secondary)]"}`}>
                <Icon fill name={isPaid ? "check_circle" : "hourglass_top"} />
                {statusLabels[payment.status]}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 border-b border-[var(--outline-variant)] p-6 md:grid-cols-2 xl:grid-cols-4">
              <ReceiptField label="Mã tham chiếu" value={`#TC-${payment.id.slice(0, 8).toUpperCase()}`} />
              <ReceiptField label="Ngày giờ" value={formatDate(paidAt)} />
              <ReceiptField label="Phương thức" value={`${payment.provider}${payment.providerTxnRef ? ` · ${payment.providerTxnRef.slice(0, 10)}` : ""}`} />
              <div className="md:text-right">
                <p className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">Số tiền</p>
                <p className="mt-1 text-xl font-black text-[var(--primary)]">{formatMoney(payment.amount, payment.currency)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-6">
              <h2 className="text-sm font-black uppercase tracking-wide">Chi tiết thanh toán</h2>
              <LineItem label={`Buổi học với ${payment.tutor.fullName}`} note={formatDate(payment.booking.startsAt)} value={formatMoney(String(subtotal), payment.currency)} />
              <LineItem label="Phí nền tảng" value={formatMoney(String(serviceFee), payment.currency)} muted />
              <div className="border-t-2 border-dashed border-[var(--outline-variant)] pt-4">
                <LineItem label="Tổng cộng" value={formatMoney(payment.amount, payment.currency)} strong />
              </div>
            </div>

            <div className="flex flex-col justify-between gap-5 border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-6 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--primary)] bg-[var(--primary-fixed)] text-xl font-black text-[var(--primary)]">
                  {payment.tutor.fullName.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--on-surface-variant)]">Gia sư</p>
                  <p className="font-black text-[var(--primary)]">{payment.tutor.fullName}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link className="rounded-xl border border-[var(--outline)] px-5 py-3 text-center text-sm font-bold text-[var(--on-surface-variant)]" href="/messages">Liên hệ hỗ trợ</Link>
                <button className="rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white" onClick={() => window.print()} type="button">In hóa đơn</button>
              </div>
            </div>
          </article>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <InfoCard icon="help_outline" title="Cần hỗ trợ?" text="Mở tin nhắn hoặc trung tâm trợ giúp nếu có vấn đề về giao dịch." />
            <InfoCard icon="security" title="Thanh toán an toàn" text="Thông tin giao dịch được lưu theo tài khoản đăng nhập." />
            <InfoCard icon="history" title="Lịch sử đầy đủ" text="Tất cả hóa đơn có thể xem lại trong mục thanh toán." />
          </div>
        </section>
      </div>
    </main>
  );
}

function SideLink({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold ${active ? "bg-[var(--primary)] text-white" : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"}`} href={href}>
      <Icon fill={active} name={icon} />
      {label}
    </Link>
  );
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function LineItem({ label, note, value, muted = false, strong = false }: { label: string; note?: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${muted ? "text-[var(--on-surface-variant)]" : ""}`}>
      <div>
        <p className={strong ? "text-xl font-black" : "font-semibold"}>{label}</p>
        {note ? <p className="text-sm text-[var(--on-surface-variant)]">{note}</p> : null}
      </div>
      <p className={strong ? "text-xl font-black text-[var(--primary)]" : "font-bold"}>{value}</p>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <article className="flex gap-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <Icon className="rounded-lg bg-[var(--primary-container)]/15 p-2 text-[var(--primary)]" name={icon} />
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{text}</p>
      </div>
    </article>
  );
}

function ReceiptSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--surface)] px-5 py-8 md:px-10">
      <section className="mx-auto min-h-[520px] max-w-[960px] rounded-2xl border border-[var(--outline-variant)] bg-white shadow-sm" />
    </main>
  );
}
