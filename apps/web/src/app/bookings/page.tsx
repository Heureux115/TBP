"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RoleDashboardShell } from "@/components/layouts/role-dashboard-shell";
import { Avatar, Button, Card, CardDescription, CardHeader, CardTitle, ConfirmDialog, FeedbackState, Icon, PageHeader, Skeleton, StatusBadge, type StatusTone } from "@/components/ui";
import { getCurrentUser, type PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { Booking, BookingStatus, cancelBooking, getMyBookings } from "@/lib/booking-api";
import { ensureConversation } from "@/lib/message-api";
import { createPayment, getMyPayments, mockConfirmPayment, Payment } from "@/lib/payment-api";
import { useHasMounted } from "@/lib/use-has-mounted";

type Filter = "ALL" | "UPCOMING" | "PAST" | BookingStatus;

const statusMeta: Record<BookingStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: "Chờ gia sư xác nhận", tone: "warning" },
  CONFIRMED: { label: "Đã xác nhận", tone: "info" },
  CANCELLED: { label: "Đã hủy", tone: "danger" },
  COMPLETED: { label: "Đã hoàn thành", tone: "success" },
};

const filters: Array<{ label: string; value: Filter }> = [
  { label: "Tất cả", value: "ALL" },
  { label: "Sắp tới", value: "UPCOMING" },
  { label: "Đã qua", value: "PAST" },
  { label: "Chờ xử lý", value: "PENDING" },
];

function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return amount ? `${new Intl.NumberFormat("vi-VN").format(amount)}đ` : "0đ";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTimeRange(booking: Booking) {
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  return `${start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

function isFutureBooking(booking: Booking) {
  return new Date(booking.endsAt) >= new Date();
}

function bookingSubject(booking: Booking) {
  return booking.tutor.headline?.split("-")[0]?.trim() || "Buổi học TutorConnect";
}

function modeLabel(mode: Booking["teachingMode"]) {
  if (mode === "OFFLINE") return "Offline";
  if (mode === "ONLINE") return "Online";
  return "Online/Offline";
}

function paymentLabel(payment?: Payment | Booking["payment"]) {
  if (!payment) return "Chưa thanh toán";
  if (payment.status === "PAID") return "Đã thanh toán";
  if (payment.status === "REFUNDED") return "Đã hoàn tiền";
  if (payment.status === "FAILED") return "Thanh toán lỗi";
  if (payment.status === "CANCELLED") return "Đã hủy thanh toán";
  return "Chờ thanh toán";
}

function paymentTone(payment?: Payment | Booking["payment"]): StatusTone {
  if (!payment) return "neutral";
  if (payment.status === "PAID" || payment.status === "REFUNDED") return "success";
  if (payment.status === "FAILED" || payment.status === "CANCELLED") return "danger";
  return "warning";
}

function toPaymentMap(items: Payment[]) {
  return items.reduce<Record<string, Payment>>((acc, payment) => {
    acc[payment.bookingId] = payment;
    return acc;
  }, {});
}

export default function BookingsPage() {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  useEffect(() => {
    if (!hasMounted) return;
    const token = getAccessToken();

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    getCurrentUser(token)
      .then((current) => {
        if (current.user.role === "TUTOR") {
          router.replace("/tutor/schedule");
          return;
        }

        if (current.user.role === "ADMIN" || current.user.role === "SUPER_ADMIN") {
          router.replace("/admin/bookings");
          return;
        }

        setUser(current.user);
        return Promise.all([getMyBookings(token), getMyPayments(token)]).then(([bookingItems, paymentItems]) => {
          setBookings(bookingItems);
          setPayments(toPaymentMap(paymentItems));
        });
      })
      .catch((requestError) => {
        clearTokens();
        setError(requestError instanceof Error ? requestError.message : "Không thể tải lịch học.");
      })
      .finally(() => setIsLoading(false));
  }, [hasMounted, router]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      if (filter === "ALL") return true;
      if (filter === "UPCOMING") return isFutureBooking(booking) && booking.status !== "CANCELLED";
      if (filter === "PAST") return !isFutureBooking(booking) || booking.status === "COMPLETED";
      return booking.status === filter;
    });
  }, [bookings, filter]);

  const upcomingCount = bookings.filter((booking) => isFutureBooking(booking) && booking.status !== "CANCELLED").length;
  const completedCount = bookings.filter((booking) => booking.status === "COMPLETED").length;
  const pendingCount = bookings.filter((booking) => booking.status === "PENDING").length;
  const paidTotal = Object.values(payments)
    .filter((payment) => payment.status === "PAID")
    .reduce((total, payment) => total + Number(payment.amount), 0);

  async function reload(token: string) {
    const [bookingItems, paymentItems] = await Promise.all([getMyBookings(token), getMyPayments(token)]);
    setBookings(bookingItems);
    setPayments(toPaymentMap(paymentItems));
  }

  async function handleMessage(bookingId: string) {
    const token = getAccessToken();
    if (!token) return;

    setBusyId(bookingId);
    setError("");
    try {
      const conversation = await ensureConversation(token, bookingId);
      router.push(`/messages?conversationId=${conversation.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể mở tin nhắn.");
    } finally {
      setBusyId("");
    }
  }

  async function handlePay(bookingId: string) {
    const token = getAccessToken();
    if (!token) return;

    setBusyId(bookingId);
    setError("");
    try {
      const payment = await createPayment(token, bookingId, "MOCK");
      const paid = await mockConfirmPayment(token, payment.id);
      router.push(`/payments/success?paymentId=${paid.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể thanh toán lịch học.");
    } finally {
      setBusyId("");
    }
  }

  async function confirmCancelBooking() {
    const token = getAccessToken();
    if (!token || !cancelTarget) return;

    setBusyId(cancelTarget.id);
    setError("");
    try {
      await cancelBooking(token, cancelTarget.id, "Học viên yêu cầu hủy từ trang lịch học.");
      await reload(token);
      setCancelTarget(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể hủy lịch học.");
    } finally {
      setBusyId("");
    }
  }

  if (!hasMounted || isLoading || !user) {
    return <BookingsSkeleton />;
  }

  return (
    <RoleDashboardShell active="bookings" role="student">
      <div className="min-w-0 space-y-6">
        <PageHeader
          actions={
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--secondary-container)] px-4 py-2.5 text-sm font-bold text-[var(--on-secondary-container)] shadow-[var(--shadow-panel)] transition hover:bg-[var(--secondary)] hover:text-[var(--on-secondary)] focus-visible:shadow-[var(--focus-ring)]" href="/tutors">
              <Icon name="event_available" />
              Đặt lịch học
            </Link>
          }
          description="Theo dõi các buổi học của bạn, trạng thái xác nhận và thanh toán."
          title="Lịch học của tôi"
        />

        {error ? (
          <div className="rounded-[var(--radius-md)] bg-[var(--error-container)] p-3 text-sm font-bold text-[var(--error)]" role="alert">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StudentMetric icon="calendar_today" label="Sắp tới" value={String(upcomingCount)} />
          <StudentMetric icon="check_circle" label="Đã hoàn thành" tone="success" value={String(completedCount)} />
          <StudentMetric icon="pending_actions" label="Chờ xử lý" tone="warning" value={String(pendingCount)} />
          <StudentMetric icon="payments" label="Đã thanh toán" tone="info" value={formatMoney(paidTotal)} />
        </section>

        <Card>
          <CardHeader
            action={
              <div className="flex flex-wrap gap-2 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-1">
                {filters.map((item) => (
                  <button
                    className={`min-h-10 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-bold transition ${filter === item.value ? "bg-white text-[var(--primary)] shadow-[var(--shadow-panel)]" : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"}`}
                    key={item.value}
                    onClick={() => setFilter(item.value)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            }
          >
            <CardTitle>Danh sách lịch học</CardTitle>
            <CardDescription>{filteredBookings.length}/{bookings.length} booking đang hiển thị</CardDescription>
          </CardHeader>

          <StudentBookingsList
            bookings={filteredBookings}
            busyId={busyId}
            onCancel={setCancelTarget}
            onMessage={handleMessage}
            onPay={handlePay}
            payments={payments}
          />
        </Card>
      </div>

      <ConfirmDialog
        confirmLabel="Hủy lịch học"
        description={
          cancelTarget && (payments[cancelTarget.id] || cancelTarget.payment)?.status === "PAID"
            ? "Lịch này đã thanh toán. Hủy lịch có thể cập nhật hoàn tiền và trạng thái thanh toán liên quan."
            : "Lịch học sẽ bị hủy và không còn hiển thị như một buổi học sắp tới."
        }
        isBusy={Boolean(cancelTarget && busyId === cancelTarget.id)}
        onCancel={() => setCancelTarget(null)}
        onConfirm={confirmCancelBooking}
        open={Boolean(cancelTarget)}
        title="Hủy lịch học này?"
      />
    </RoleDashboardShell>
  );
}

function StudentBookingsList({
  bookings,
  busyId,
  onCancel,
  onMessage,
  onPay,
  payments,
}: {
  bookings: Booking[];
  busyId: string;
  onCancel: (booking: Booking) => void;
  onMessage: (bookingId: string) => void;
  onPay: (bookingId: string) => void;
  payments: Record<string, Payment>;
}) {
  if (!bookings.length) {
    return (
      <FeedbackState
        action={
          <Link className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white" href="/tutors">
            Tìm gia sư
          </Link>
        }
        description="Các booking của bạn sẽ xuất hiện tại đây sau khi đặt lịch với gia sư."
        icon="calendar_month"
        title="Chưa có lịch học phù hợp"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {bookings.map((booking) => (
        <StudentBookingCard
          booking={booking}
          busy={busyId === booking.id}
          key={booking.id}
          onCancel={() => onCancel(booking)}
          onMessage={() => onMessage(booking.id)}
          onPay={() => onPay(booking.id)}
          payment={payments[booking.id] || booking.payment}
        />
      ))}
    </div>
  );
}

function StudentBookingCard({
  booking,
  busy,
  onCancel,
  onMessage,
  onPay,
  payment,
}: {
  booking: Booking;
  busy: boolean;
  onCancel: () => void;
  onMessage: () => void;
  onPay: () => void;
  payment?: Payment | Booking["payment"];
}) {
  const paid = payment?.status === "PAID";
  const cancellable = booking.status !== "CANCELLED" && booking.status !== "COMPLETED";

  return (
    <article className={`relative flex min-w-0 flex-col gap-5 overflow-hidden rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white p-5 shadow-[var(--shadow-panel)] ${booking.status === "CANCELLED" ? "opacity-70" : ""}`}>
      <div className={`absolute right-0 top-0 h-full w-1.5 ${paid ? "bg-[var(--tertiary)]" : "bg-[var(--secondary)]"}`} />
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={booking.tutor.fullName} size="lg" src={booking.tutor.avatarUrl} />
          <div className="min-w-0">
            <h3 className="tc-text-safe text-lg font-black text-[var(--on-surface)]">{booking.tutor.fullName}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge dot={false} tone="info">{bookingSubject(booking)}</StatusBadge>
              <StatusBadge dot={false} tone="neutral">{modeLabel(booking.teachingMode)}</StatusBadge>
            </div>
          </div>
        </div>
        <StatusBadge tone={statusMeta[booking.status].tone}>{statusMeta[booking.status].label}</StatusBadge>
      </div>

      <div className="grid grid-cols-1 gap-3 border-y border-[var(--outline-variant)]/60 py-4 sm:grid-cols-2">
        <InfoLine icon="calendar_month" label="Ngày giờ" value={`${formatDate(booking.startsAt)} · ${formatTimeRange(booking)}`} />
        <InfoLine icon={paid ? "verified" : "pending"} label="Thanh toán" tone={paymentTone(payment)} value={paymentLabel(payment)} />
      </div>

      <div className="mt-auto flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} leftIcon={<Icon name="chat" />} onClick={onMessage}>
            Nhắn tin
          </Button>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-[var(--surface-container-low)] focus-visible:shadow-[var(--focus-ring)]" href={`/bookings/${booking.id}`}>
            Chi tiết
          </Link>
          {!paid && booking.status === "CONFIRMED" ? (
            <Button disabled={busy} onClick={onPay} variant="payment">
              Thanh toán
            </Button>
          ) : null}
        </div>
        {cancellable ? (
          <Button disabled={busy} onClick={onCancel} variant="danger">
            Hủy lịch
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function InfoLine({ icon, label, tone = "info", value }: { icon: string; label: string; tone?: StatusTone; value: string }) {
  const toneClass = tone === "success" ? "text-[var(--status-success-text)]" : tone === "warning" ? "text-[var(--status-warning-text)]" : tone === "danger" ? "text-[var(--status-danger-text)]" : "text-[var(--primary)]";

  return (
    <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-wide text-[var(--on-surface-variant)]">{label}</p>
      <p className={`tc-text-safe mt-1 flex items-center gap-2 text-sm font-bold ${toneClass}`}>
        <Icon className="text-base" name={icon} />
        {value}
      </p>
    </div>
  );
}

function StudentMetric({ icon, label, tone = "info", value }: { icon: string; label: string; tone?: "info" | "success" | "warning"; value: string }) {
  const iconClass = tone === "success" ? "text-[var(--tertiary)]" : tone === "warning" ? "text-[var(--secondary)]" : "text-[var(--primary)]";

  return (
    <Card className="p-4">
      <div className={`flex items-center gap-2 ${iconClass}`}>
        <Icon name={icon} />
        <span className="text-xs font-black uppercase tracking-wide text-[var(--on-surface-variant)]">{label}</span>
      </div>
      <p className="tc-text-safe mt-2 text-2xl font-black text-[var(--on-surface)]">{value}</p>
    </Card>
  );
}

function BookingsSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--surface)] px-5 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-5">
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-28" key={index} />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    </main>
  );
}
