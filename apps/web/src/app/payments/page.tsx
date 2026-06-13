"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RoleDashboardShell } from "@/components/layouts/role-dashboard-shell";
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DataTableBody,
  DataTableHead,
  FeedbackState,
  Icon,
  MetricCard,
  Skeleton,
  StatusBadge,
  type StatusTone,
} from "@/components/ui";
import { getCurrentUser, type PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { getMyPayments, mockConfirmPayment, type Payment, type PaymentStatus, type PayoutStatus } from "@/lib/payment-api";
import { createSearchMatcher } from "@/lib/search-text";
import { useHasMounted } from "@/lib/use-has-mounted";

type StatusFilter = "ALL" | PaymentStatus;

const statusMeta: Record<PaymentStatus, { description: string; label: string; tone: StatusTone }> = {
  CANCELLED: { description: "Giao dịch đã bị hủy, không cần thanh toán thêm.", label: "Đã hủy", tone: "danger" },
  FAILED: { description: "Thanh toán thất bại. Kiểm tra lại phương thức hoặc thử lại từ booking.", label: "Thất bại", tone: "danger" },
  PAID: { description: "Tiền đã được ghi nhận cho lịch học.", label: "Đã thanh toán", tone: "success" },
  PENDING: { description: "Giao dịch đang chờ xác nhận thanh toán.", label: "Chờ thanh toán", tone: "warning" },
  REFUNDED: { description: "Tiền đã được hoàn lại theo xử lý hiện tại.", label: "Đã hoàn tiền", tone: "info" },
};

const payoutMeta: Record<PayoutStatus, { label: string; tone: StatusTone }> = {
  CANCELLED: { label: "Payout hủy", tone: "danger" },
  HELD: { label: "Đang giữ", tone: "warning" },
  REFUNDED: { label: "Đã hoàn", tone: "info" },
  RELEASED: { label: "Đã mở khóa", tone: "success" },
};

function formatMoney(value: string | number, currency = "VND") {
  const amount = Number(value || 0);
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

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function PaymentsPage() {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [payingId, setPayingId] = useState("");
  const [pendingPayment, setPendingPayment] = useState<Payment | null>(null);

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
    const matchesQuery = createSearchMatcher(query);
    return payments.filter((payment) => {
      const matchesStatus = status === "ALL" || payment.status === status;
      const haystack = `${payment.id} ${payment.bookingId} ${payment.tutor.fullName} ${payment.provider}`;
      return matchesStatus && matchesQuery(haystack);
    });
  }, [payments, query, status]);

  const totalSpent = payments
    .filter((payment) => payment.status === "PAID")
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const completedCount = payments.filter((payment) => payment.status === "PAID").length;
  const pendingCount = payments.filter((payment) => payment.status === "PENDING").length;
  const refundedTotal = payments
    .filter((payment) => payment.status === "REFUNDED")
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const hasFilters = Boolean(query.trim()) || status !== "ALL";

  function clearFilters() {
    setQuery("");
    setStatus("ALL");
  }

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
      setPendingPayment(null);
      router.push(`/payments/success?paymentId=${paid.id}`);
    } catch (requestError) {
      setPendingPayment(null);
      setError(requestError instanceof Error ? requestError.message : "Không thể xác nhận thanh toán.");
      router.push(`/payments/failed?paymentId=${paymentId}`);
    } finally {
      setPayingId("");
    }
  }

  if (!hasMounted || (isLoading && !user)) {
    return <PaymentsSkeleton />;
  }

  if (error && !user && !payments.length) {
    return (
      <main className="min-h-screen bg-[var(--surface)] px-5 py-8 text-[var(--on-surface)] md:px-10">
        <div className="mx-auto max-w-[720px] pt-12">
          <FeedbackState
            actionLabel="Quay lại dashboard"
            description={error}
            onAction={() => router.push("/dashboard")}
            title="Không thể tải thanh toán"
            tone="error"
          />
        </div>
      </main>
    );
  }

  return (
    <RoleDashboardShell active="payments" role={user?.role === "TUTOR" ? "tutor" : "student"}>
      <main className="flex w-full flex-col gap-6 text-[var(--on-surface)]">
        <div className="flex w-full flex-col gap-6">
          <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-black leading-tight text-[var(--primary)] md:text-3xl">Lịch sử thanh toán</h1>
              <p className="mt-2 max-w-[72ch] text-sm leading-6 text-[var(--on-surface-variant)]">
                Theo dõi trạng thái thanh toán, tiền đang giữ cho gia sư và các giao dịch đã hoàn tiền trong TutorConnect.
              </p>
            </div>
            <Button
              disabled={!filteredPayments.length}
              leftIcon={<Icon name="download" />}
              onClick={downloadStatement}
              variant="payment"
            >
              Tải sao kê
            </Button>
          </header>

          {error ? (
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--status-danger-text)]" role="alert">
              <Icon className="mt-0.5 text-[20px]" fill name="error" />
              <span>{error}</span>
            </div>
          ) : null}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon="account_balance_wallet" label="Tổng đã thanh toán" note={`${completedCount} giao dịch`} tone="success" value={formatMoney(totalSpent)} />
            <MetricCard icon="pending_actions" label="Chờ thanh toán" note="Cần xử lý" tone="warning" value={pendingCount} />
            <MetricCard icon="assignment_return" label="Đã hoàn tiền" note="Theo xử lý hiện tại" tone="info" value={formatMoney(refundedTotal)} />
            <MetricCard icon="receipt_long" label="Tổng giao dịch" note={`${filteredPayments.length} đang hiển thị`} tone="neutral" value={payments.length} />
          </section>

          <Card className="p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-bold text-[var(--on-surface-variant)]">Tìm kiếm</span>
                <span className="relative block">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--on-surface-variant)]" name="search" />
                  <input
                    className="w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-2.5 pl-10 pr-3 text-sm font-semibold text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Mã giao dịch, booking, gia sư, cổng thanh toán..."
                    type="search"
                    value={query}
                  />
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[var(--on-surface-variant)]">Trạng thái</span>
                <select
                  className="w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm font-semibold text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
                  onChange={(event) => setStatus(event.target.value as StatusFilter)}
                  value={status}
                >
                  <option value="ALL">Tất cả giao dịch</option>
                  <option value="PENDING">Chờ thanh toán</option>
                  <option value="PAID">Đã thanh toán</option>
                  <option value="FAILED">Thất bại</option>
                  <option value="CANCELLED">Đã hủy</option>
                  <option value="REFUNDED">Đã hoàn tiền</option>
                </select>
              </label>
              <Button disabled={!hasFilters} onClick={clearFilters} variant="outline">
                Xóa lọc
              </Button>
            </div>
            <p className="mt-4 text-xs font-bold text-[var(--on-surface-variant)]">
              Hiển thị {filteredPayments.length}/{payments.length} giao dịch
            </p>
          </Card>

          <DataTable tableClassName="min-w-[1040px]">
            <DataTableHead>
              <tr>
                <th className="px-5 py-4" scope="col">Giao dịch</th>
                <th className="px-5 py-4" scope="col">Gia sư / booking</th>
                <th className="px-5 py-4" scope="col">Số tiền</th>
                <th className="px-5 py-4" scope="col">Cổng</th>
                <th className="px-5 py-4" scope="col">Trạng thái</th>
                <th className="px-5 py-4" scope="col">Payout</th>
                <th className="px-5 py-4 text-right" scope="col">Thao tác</th>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {isLoading ? (
                <PaymentRowsSkeleton />
              ) : filteredPayments.length ? (
                filteredPayments.map((payment) => (
                  <tr className="transition hover:bg-[var(--surface-container-low)]" key={payment.id}>
                    <td className="px-5 py-4">
                      <p className="font-black text-[var(--primary)]">#{payment.id.slice(0, 8).toUpperCase()}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--on-surface-variant)]">{formatDate(payment.createdAt)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={payment.tutor.fullName} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">{payment.tutor.fullName}</p>
                          <p className="truncate text-xs font-semibold text-[var(--on-surface-variant)]">
                            Booking #{payment.bookingId.slice(0, 8).toUpperCase()} · {formatShortDate(payment.booking.startsAt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-base font-black tabular-nums text-[var(--on-surface)]">{formatMoney(payment.amount, payment.currency)}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--on-surface-variant)]">Phí nền tảng {formatMoney(payment.platformFeeAmount, payment.currency)}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-black">{payment.provider}</td>
                    <td className="px-5 py-4">
                      <PaymentStatus payment={payment} />
                    </td>
                    <td className="px-5 py-4">
                      <PayoutStatusChip status={payment.payoutStatus} />
                    </td>
                    <td className="w-32 px-5 py-4 text-right">
                      {payment.status === "PENDING" ? (
                        <Button className="w-28 whitespace-nowrap" isLoading={payingId === payment.id} onClick={() => setPendingPayment(payment)} size="sm">
                          Thanh toán
                        </Button>
                      ) : payment.status === "PAID" || payment.status === "REFUNDED" ? (
                        <Link className="inline-flex min-h-11 w-28 items-center justify-center gap-1 whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary)] hover:bg-[var(--surface-container-low)]" href={`/payments/${payment.id}`}>
                          <Icon className="text-[18px]" name="receipt_long" />
                          Hóa đơn
                        </Link>
                      ) : (
                        <Link className="inline-flex min-h-11 w-28 items-center justify-center gap-1 whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold text-[var(--primary)] hover:bg-[var(--surface-container-low)]" href={`/payments/failed?paymentId=${payment.id}`}>
                          <Icon className="text-[18px]" name="error" />
                          Xem lỗi
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-8" colSpan={7}>
                    <FeedbackState
                      actionLabel={hasFilters ? "Xóa bộ lọc" : "Tìm gia sư"}
                      className="min-h-[260px]"
                      description={hasFilters ? "Không có giao dịch nào khớp với bộ lọc hiện tại." : "Khi bạn đặt lịch học và phát sinh thanh toán, giao dịch sẽ xuất hiện tại đây."}
                      onAction={hasFilters ? clearFilters : () => router.push("/tutors")}
                      title={hasFilters ? "Không tìm thấy giao dịch" : "Chưa có thanh toán"}
                      tone={hasFilters ? "not-found" : "empty"}
                    />
                  </td>
                </tr>
              )}
            </DataTableBody>
          </DataTable>

          <Card tone="subtle" className="p-4">
            <div className="grid gap-3 text-sm text-[var(--on-surface-variant)] md:grid-cols-3">
              <PolicyLine icon="lock" title="Giữ tiền an toàn" text="Giao dịch paid có thể được giữ cho đến khi buổi học hoàn tất." />
              <PolicyLine icon="assignment_return" title="Hoàn tiền minh bạch" text="Giao dịch refunded sẽ hiển thị rõ trạng thái và thời điểm hoàn nếu API có dữ liệu." />
              <PolicyLine icon="support_agent" title="Cần hỗ trợ?" text="Các tranh chấp và hủy lịch được xử lý từ chi tiết booking liên quan." />
            </div>
          </Card>
        </div>

        <ConfirmDialog
          confirmLabel="Xác nhận thanh toán"
          description={pendingPayment ? `Bạn sẽ xác nhận giao dịch ${formatMoney(pendingPayment.amount, pendingPayment.currency)} cho lịch học với ${pendingPayment.tutor.fullName}.` : ""}
          isBusy={Boolean(payingId)}
          onCancel={() => setPendingPayment(null)}
          onConfirm={() => pendingPayment ? confirmPayment(pendingPayment.id) : undefined}
          open={Boolean(pendingPayment)}
          title="Xác nhận thanh toán?"
          tone="primary"
        />
      </main>
    </RoleDashboardShell>
  );
}

function PaymentStatus({ payment }: { payment: Payment }) {
  const meta = statusMeta[payment.status];
  return (
    <div className="space-y-1.5">
      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      <p className="max-w-[220px] text-xs font-semibold leading-5 text-[var(--on-surface-variant)]">
        {payment.status === "REFUNDED" && payment.refundReason ? payment.refundReason : meta.description}
      </p>
    </div>
  );
}

function PayoutStatusChip({ status }: { status: PayoutStatus }) {
  const meta = payoutMeta[status];
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
}

function PolicyLine({ icon, text, title }: { icon: string; text: string; title: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-container-high)] text-[var(--primary)]">
        <Icon name={icon} />
      </span>
      <div>
        <p className="font-black text-[var(--on-surface)]">{title}</p>
        <p className="mt-1 leading-6">{text}</p>
      </div>
    </div>
  );
}

function PaymentRowsSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index}>
          <td className="px-5 py-4" colSpan={7}>
            <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_1fr_.7fr_1fr_.8fr_.8fr]">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function PaymentsSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--surface)] px-4 py-6 text-[var(--on-surface)] sm:px-6 md:px-10 md:py-8">
      <div className="flex w-full flex-col gap-6">
        <div className="space-y-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <Skeleton className="h-36 rounded-[var(--radius-lg)]" key={item} />)}
        </section>
        <Skeleton className="h-24 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-[420px] rounded-[var(--radius-lg)]" />
      </div>
    </main>
  );
}
