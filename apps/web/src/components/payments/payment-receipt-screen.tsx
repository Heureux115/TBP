"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, type PublicUser } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import { getPayment, type Payment, type PaymentStatus } from "@/lib/payment-api";
import { RoleDashboardShell, type DashboardRole } from "@/components/layouts/role-dashboard-shell";
import { useHasMounted } from "@/lib/use-has-mounted";

const statusLabels: Record<PaymentStatus, string> = {
  PENDING: "Đang xử lý",
  PAID: "Thanh toán thành công",
  FAILED: "Thanh toán thất bại",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};

const statusTone: Record<PaymentStatus, string> = {
  PENDING: "bg-[var(--secondary-fixed)] text-[var(--secondary)]",
  PAID: "bg-[var(--tertiary-fixed)] text-[var(--on-tertiary-fixed)]",
  FAILED: "bg-[var(--error-container)] text-[var(--error)]",
  CANCELLED: "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]",
  REFUNDED: "bg-[var(--primary-container)]/15 text-[var(--primary)]",
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
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function dashboardRole(user: PublicUser): DashboardRole {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return "admin";
  if (user.role === "TUTOR") return "tutor";
  return "student";
}

export function PaymentReceiptScreen({ id }: { id: string }) {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasMounted) return;
    const token = getAccessToken();
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    Promise.all([getCurrentUser(token), getPayment(token, id)])
      .then(([current, paymentItem]) => {
        setUser(current.user);
        setPayment(paymentItem);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Không thể tải chi tiết giao dịch.");
      });
  }, [hasMounted, id, router]);

  if (!hasMounted || (!payment && !error)) {
    return <ReceiptSkeleton />;
  }

  if (error || !payment || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-5">
        <div className="max-w-md rounded-xl border border-[var(--outline-variant)] bg-white p-6 text-center shadow-sm">
          <Icon className="text-4xl text-[var(--error)]" fill name="error" />
          <h1 className="mt-3 text-xl font-black">Không thể mở hóa đơn</h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">{error || "Không tìm thấy giao dịch."}</p>
          <Link className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white" href="/payments">
            Quay lại thanh toán
          </Link>
        </div>
      </main>
    );
  }

  const serviceFee = Number(payment.platformFeeAmount);
  const subtotal = Number(payment.tutorPayoutAmount);
  const paidAt = payment.paidAt || payment.createdAt;
  const role = dashboardRole(user);
  const isAdmin = role === "admin";
  const backHref = isAdmin ? "/admin/payments" : "/payments";
  const backLabel = isAdmin ? "Quay lại quản lý thanh toán" : "Lịch sử thanh toán";

  return (
    <RoleDashboardShell active="payments" role={role}>
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 py-8 md:px-10">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link className="inline-flex items-center gap-1 text-sm font-bold text-[var(--primary)] hover:underline" href={backHref}>
              <Icon name="arrow_back" />
              {backLabel}
            </Link>
            <h1 className="mt-3 text-3xl font-black text-[var(--primary)]">Chi tiết giao dịch</h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Xem, kiểm tra và in hóa đơn thanh toán cho lịch học.</p>
          </div>
          <button className="inline-flex w-fit items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--primary)] px-4 py-3 text-sm font-bold text-[var(--primary)]" onClick={() => window.print()} type="button">
            <Icon name="download" />
            Tải PDF
          </button>
        </header>

        <article className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 bg-[var(--surface-container-low)] p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
                <Icon className="text-3xl" name="receipt_long" />
              </div>
              <div>
                <p className="text-xl font-black">TutorConnect</p>
                <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Biên nhận giao dịch chính thức</p>
              </div>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold leading-none ${statusTone[payment.status]}`}>
              <Icon fill name={payment.status === "PAID" ? "check_circle" : payment.status === "REFUNDED" ? "assignment_return" : payment.status === "FAILED" ? "error" : "hourglass_top"} />
              {statusLabels[payment.status]}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 border-b border-[var(--outline-variant)] p-6 md:grid-cols-2 xl:grid-cols-4">
            <ReceiptField label="Mã tham chiếu" value={`#TC-${payment.id.slice(0, 8).toUpperCase()}`} />
            <ReceiptField label="Ngày giờ" value={formatDate(paidAt)} />
            <ReceiptField label="Phương thức" value={`${payment.provider}${payment.providerTxnRef ? ` · ${payment.providerTxnRef.slice(0, 10)}` : ""}`} />
            <div className="md:text-right">
              <p className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">Số tiền</p>
              <p className="mt-1 whitespace-nowrap text-xl font-black text-[var(--primary)]">{formatMoney(payment.amount, payment.currency)}</p>
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
              <Avatar name={payment.tutor.fullName} />
              <div>
                <p className="text-xs font-bold text-[var(--on-surface-variant)]">Gia sư</p>
                <p className="font-black text-[var(--primary)]">{payment.tutor.fullName}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className="whitespace-nowrap rounded-lg border border-[var(--outline)] px-5 py-3 text-center text-sm font-bold text-[var(--on-surface-variant)]" href="/messages">
                Liên hệ hỗ trợ
              </Link>
              <button className="whitespace-nowrap rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white" onClick={() => window.print()} type="button">
                In hóa đơn
              </button>
            </div>
          </div>
        </article>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoCard icon="help_outline" title="Cần hỗ trợ?" text="Mở tin nhắn hoặc trung tâm trợ giúp nếu có vấn đề về giao dịch." />
          <InfoCard icon="security" title="Thanh toán an toàn" text="Thông tin giao dịch được lưu theo tài khoản đăng nhập." />
          <InfoCard icon="history" title="Lịch sử đầy đủ" text="Tất cả hóa đơn có thể xem lại trong mục thanh toán." />
        </div>
      </main>
    </RoleDashboardShell>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "T";

  return <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[var(--primary)] bg-[var(--primary-fixed)] text-xl font-black text-[var(--primary)]">{initial}</div>;
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
      <div className="min-w-0">
        <p className={strong ? "text-xl font-black" : "font-semibold"}>{label}</p>
        {note ? <p className="text-sm text-[var(--on-surface-variant)]">{note}</p> : null}
      </div>
      <p className={strong ? "shrink-0 whitespace-nowrap text-xl font-black text-[var(--primary)]" : "shrink-0 whitespace-nowrap font-bold"}>{value}</p>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <article className="flex gap-4 rounded-xl border border-[var(--outline-variant)] bg-white p-4 shadow-sm">
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
      <section className="mx-auto min-h-[520px] max-w-[960px] rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm" />
    </main>
  );
}
