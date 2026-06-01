"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RoleDashboardShell } from "@/components/layouts/role-dashboard-shell";
import { getCurrentUser, type PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { getMyPayments, mockConfirmPayment, Payment, PaymentStatus } from "@/lib/payment-api";
import { useHasMounted } from "@/lib/use-has-mounted";

const statusLabels: Record<PaymentStatus, string> = {
  PENDING: "Đang xử lý",
  PAID: "Hoàn tất",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};

const statusClasses: Record<PaymentStatus, string> = {
  PENDING: "bg-[var(--secondary-fixed)]/40 text-[var(--secondary)]",
  PAID: "bg-[var(--tertiary-fixed)]/30 text-[var(--tertiary)]",
  FAILED: "bg-[var(--error-container)] text-[var(--error)]",
  CANCELLED: "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]",
  REFUNDED: "bg-[var(--primary-container)]/15 text-[var(--primary)]",
};

function Icon({ name, fill = false, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return <span className={["material-symbols-outlined", fill ? "icon-fill" : "", className].join(" ")}>{name}</span>;
}

function formatMoney(value: string, currency = "VND") {
  const amount = Number(value);
  const suffix = currency === "VND" ? "đ" : ` ${currency}`;
  return `${new Intl.NumberFormat("vi-VN").format(amount)}${suffix}`;
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

export default function PaymentsPage() {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState<"ALL" | PaymentStatus>("ALL");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [payingId, setPayingId] = useState("");

  useEffect(() => {
    if (!hasMounted) return;

    const token = getAccessToken();
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    Promise.all([getCurrentUser(token), getMyPayments(token)])
      .then(([current, items]) => {
        setUser(current.user);
        setPayments(items);
      })
      .catch((requestError) => {
        clearTokens();
        setError(requestError instanceof Error ? requestError.message : "Không thể tải lịch sử thanh toán.");
      })
      .finally(() => setIsLoading(false));
  }, [hasMounted, router]);

  const filteredPayments = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesStatus = status === "ALL" || payment.status === status;
      const matchesQuery =
        !keyword ||
        payment.id.toLowerCase().includes(keyword) ||
        payment.tutor.fullName.toLowerCase().includes(keyword) ||
        payment.provider.toLowerCase().includes(keyword);
      return matchesStatus && matchesQuery;
    });
  }, [payments, query, status]);

  const totalSpent = payments
    .filter((payment) => payment.status === "PAID")
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const completedCount = payments.filter((payment) => payment.status === "PAID").length;
  const pendingCount = payments.filter((payment) => payment.status === "PENDING").length;

  function downloadStatement() {
    const rows = [
      ["payment_id", "created_at", "tutor", "booking_id", "amount", "platform_fee", "tutor_payout", "currency", "status", "payout_status"],
      ...filteredPayments.map((payment) => [
        payment.id,
        payment.createdAt,
        payment.tutor.fullName,
        payment.bookingId,
        payment.amount,
        payment.platformFeeAmount,
        payment.tutorPayoutAmount,
        payment.currency,
        payment.status,
        payment.payoutStatus,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tutorconnect-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function confirmPayment(paymentId: string) {
    const token = getAccessToken();
    if (!token) return;

    setPayingId(paymentId);
    setError("");
    try {
      const paid = await mockConfirmPayment(token, paymentId);
      router.push(`/payments/success?paymentId=${paid.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể xác nhận thanh toán.");
      router.push(`/payments/failed?paymentId=${paymentId}`);
    } finally {
      setPayingId("");
    }
  }

  if (!hasMounted || (isLoading && !user)) {
    return <PaymentsSkeleton />;
  }

  return (
    <RoleDashboardShell active="payments" role={user?.role === "TUTOR" ? "tutor" : "student"}>
      <main className="min-h-screen px-5 py-8 md:px-10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8">
          <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-black text-[var(--primary)]">Lịch sử thanh toán</h1>
              <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                Theo dõi các giao dịch đặt lịch, trạng thái thanh toán và hóa đơn.
              </p>
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--secondary)] px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60" type="button" onClick={downloadStatement} disabled={!filteredPayments.length}>
              <Icon name="download" />
              Tải sao kê
            </button>
          </header>

          {error ? <p className="rounded-lg bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--on-error-container)]">{error}</p> : null}

          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard icon="account_balance_wallet" label="Tổng đã thanh toán" value={formatMoney(String(totalSpent))} note="+12% so với tháng trước" />
            <MetricCard icon="history_edu" label="Buổi đã thanh toán" value={String(completedCount)} note="Gắn với lịch học đã đặt" accent="secondary" />
            <MetricCard icon="pending_actions" label="Chờ thanh toán" value={String(pendingCount)} note="Cần xử lý để xác nhận lịch" accent="error" />
          </section>

          <section className="flex flex-col gap-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row">
              <label className="flex min-w-[220px] flex-col gap-1 text-xs font-bold uppercase text-[var(--on-surface-variant)]">
                Trạng thái
                <select className="rounded-lg border border-[var(--outline)] bg-white px-3 py-2.5 text-sm font-semibold normal-case text-[var(--on-surface)] focus:border-[var(--primary)] focus:outline-none" value={status} onChange={(event) => setStatus(event.target.value as "ALL" | PaymentStatus)}>
                  <option value="ALL">Tất cả giao dịch</option>
                  <option value="PAID">Hoàn tất</option>
                  <option value="PENDING">Đang xử lý</option>
                  <option value="FAILED">Thất bại</option>
                  <option value="CANCELLED">Đã hủy</option>
                  <option value="REFUNDED">Đã hoàn tiền</option>
                </select>
              </label>
              <label className="flex min-w-[260px] flex-col gap-1 text-xs font-bold uppercase text-[var(--on-surface-variant)]">
                Khoảng thời gian
                <input className="rounded-lg border border-[var(--outline)] bg-white px-3 py-2.5 text-sm font-semibold normal-case text-[var(--on-surface)] focus:border-[var(--primary)] focus:outline-none" placeholder="VD: 05/2026" type="text" />
              </label>
            </div>
            <label className="relative flex w-full max-w-[360px] flex-col gap-1 text-xs font-bold uppercase text-[var(--on-surface-variant)]">
              Tìm kiếm
              <Icon className="absolute bottom-2.5 left-3 text-[20px] text-[var(--on-surface-variant)]" name="search" />
              <input className="rounded-lg border border-[var(--outline)] bg-white py-2.5 pl-10 pr-4 text-sm font-semibold normal-case text-[var(--on-surface)] focus:border-[var(--primary)] focus:outline-none" placeholder="Mã giao dịch, gia sư..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </section>

          <section className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-high)]/60 text-xs uppercase text-[var(--on-surface-variant)]">
                  <tr>
                    <th className="px-6 py-4">Ngày</th>
                    <th className="px-6 py-4">Mã giao dịch</th>
                    <th className="px-6 py-4">Chi tiết đặt lịch</th>
                    <th className="px-6 py-4">Số tiền</th>
                    <th className="px-6 py-4">Cổng thanh toán</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--outline-variant)]/50">
                  {isLoading ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={7}>
                        Đang tải giao dịch...
                      </td>
                    </tr>
                  ) : filteredPayments.length ? (
                    filteredPayments.map((payment) => (
                      <tr className="transition hover:bg-[var(--surface-container-low)]" key={payment.id}>
                        <td className="px-6 py-5 text-sm">{formatDate(payment.createdAt)}</td>
                        <td className="px-6 py-5 text-sm font-bold text-[var(--primary)]">#{payment.id.slice(0, 8).toUpperCase()}</td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <Avatar name={payment.tutor.fullName} />
                            <div>
                              <p className="font-bold">{payment.tutor.fullName}</p>
                              <p className="text-xs text-[var(--on-surface-variant)]">{formatDate(payment.booking.startsAt)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-lg font-black text-[var(--primary)]">{formatMoney(payment.amount, payment.currency)}</td>
                        <td className="px-6 py-5 text-sm font-semibold">{payment.provider}</td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${statusClasses[payment.status]}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {statusLabels[payment.status]}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          {payment.status === "PENDING" ? (
                            <button className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={payingId === payment.id} onClick={() => confirmPayment(payment.id)} type="button">
                              {payingId === payment.id ? "Đang xử lý" : "Thanh toán"}
                            </button>
                          ) : payment.status === "PAID" || payment.status === "REFUNDED" ? (
                            <Link className="inline-flex rounded-lg p-2 text-[var(--primary)] hover:bg-[var(--primary)]/10" href={`/payments/${payment.id}`} aria-label="Xem hóa đơn">
                              <Icon name="receipt_long" />
                            </Link>
                          ) : (
                            <Link className="inline-flex rounded-lg p-2 text-[var(--primary)] hover:bg-[var(--primary)]/10" href={`/payments/failed?paymentId=${payment.id}`} aria-label="Xem lỗi thanh toán">
                              <Icon name="error" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={7}>
                        Chưa có giao dịch phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col justify-between gap-4 border-t border-[var(--outline-variant)] bg-[var(--surface-container-high)]/30 px-6 py-4 text-sm text-[var(--on-surface-variant)] sm:flex-row sm:items-center">
              <span>Hiển thị {filteredPayments.length} / {payments.length} giao dịch</span>
              <div className="flex gap-2">
                <button className="rounded-lg border border-[var(--outline)] px-3 py-2 opacity-40" disabled type="button">‹</button>
                <button className="rounded-lg bg-[var(--primary)] px-4 py-2 font-bold text-white" type="button">1</button>
                <button className="rounded-lg border border-[var(--outline)] px-3 py-2 opacity-40" disabled type="button">›</button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </RoleDashboardShell>
  );
}

function MetricCard({ icon, label, value, note, accent = "primary" }: { icon: string; label: string; value: string; note: string; accent?: "primary" | "secondary" | "error" }) {
  const colors = {
    primary: "text-[var(--primary)] bg-[var(--primary-container)]/10",
    secondary: "text-[var(--secondary)] bg-[var(--secondary-container)]/20",
    error: "text-[var(--error)] bg-[var(--error-container)]/40",
  };
  return (
    <article className="rounded-xl border border-[var(--outline-variant)]/50 bg-white p-6 shadow-sm transition hover:-translate-y-1">
      <div className="mb-3 flex items-start justify-between">
        <span className={`rounded-lg p-2 ${colors[accent]}`}><Icon name={icon} /></span>
        <span className="rounded-full bg-[var(--tertiary-fixed)]/20 px-2 py-1 text-xs font-bold text-[var(--tertiary)]">{note}</span>
      </div>
      <p className="text-sm font-bold text-[var(--on-surface-variant)]">{label}</p>
      <h2 className="mt-1 text-3xl font-black text-[var(--primary)]">{value}</h2>
    </article>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-fixed)] font-black text-[var(--primary)]">{initial}</div>;
}

function PaymentsSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--surface)] px-5 py-8 text-[var(--on-surface)] md:px-10">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
        <h1 className="text-3xl font-black text-[var(--primary)]">Lịch sử thanh toán</h1>
        <section className="min-h-[420px] rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm" />
      </div>
    </main>
  );
}
