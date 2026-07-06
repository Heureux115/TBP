"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleDashboardShell } from "@/components/layouts/role-dashboard-shell";
import { Avatar, Badge, Button, Card, CardDescription, CardHeader, CardTitle, FeedbackState, Icon, PageHeader, Skeleton, StatusBadge } from "@/components/ui";
import { getAccessToken } from "@/lib/auth-storage";
import { Booking, confirmBooking, getMyBookings } from "@/lib/booking-api";
import { ensureConversation } from "@/lib/message-api";
import { getMyPayments, Payment } from "@/lib/payment-api";
import { getMyTutorAvailability, TutorAvailabilitySlot } from "@/lib/tutor-api";
import { useHasMounted } from "@/lib/use-has-mounted";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekStartsForScheduleWindow() {
  const weeks: string[] = [];
  const cursor = startOfWeek(new Date());

  for (let index = 0; index < 6; index += 1) {
    weeks.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

async function fetchAvailabilityWindow(token: string) {
  const availabilityItems = await Promise.all(weekStartsForScheduleWindow().map((weekStart) => getMyTutorAvailability(token, weekStart)));
  const slotMap = new Map<string, TutorAvailabilitySlot>();

  for (const availability of availabilityItems) {
    for (const slot of availability.slots) slotMap.set(slot.id, slot);
  }

  return Array.from(slotMap.values());
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatSlotTimeRange(slot: TutorAvailabilitySlot) {
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  return `${start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatTimeRange(booking: Booking) {
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  return `${start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return amount ? `${new Intl.NumberFormat("vi-VN").format(amount)}đ` : "0đ";
}

function bookingSubject(booking: Booking) {
  return booking.tutor.headline?.split("-")[0]?.trim() || "Buổi học TutorConnect";
}

function modeLabel(mode: Booking["teachingMode"]) {
  return mode === "OFFLINE" ? "Offline" : mode === "ONLINE" ? "Online" : "Online/Offline";
}

function toPaymentMap(items: Payment[]) {
  return items.reduce<Record<string, Payment>>((acc, payment) => {
    acc[payment.bookingId] = payment;
    return acc;
  }, {});
}

export function TutorBookingRequestsScreen() {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [availabilitySlots, setAvailabilitySlots] = useState<TutorAvailabilitySlot[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const requests = useMemo(
    () => bookings.filter((booking) => booking.status === "PENDING").sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [bookings],
  );
  const selected = requests.find((booking) => booking.id === selectedId) || requests[0] || null;
  const upcomingBookings = bookings
    .filter((booking) => booking.status !== "CANCELLED" && new Date(booking.endsAt) >= new Date())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const upcomingSlots = availabilitySlots
    .filter((slot) => !slot.isBooked && new Date(slot.endsAt) >= new Date())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const paidTotal = Object.values(payments)
    .filter((payment) => payment.status === "PAID")
    .reduce((total, payment) => total + Number(payment.amount), 0);

  async function reload(token: string) {
    const [bookingItems, paymentItems, slots] = await Promise.all([getMyBookings(token), getMyPayments(token), fetchAvailabilityWindow(token)]);
    setBookings(bookingItems);
    setPayments(toPaymentMap(paymentItems));
    setAvailabilitySlots(slots);
  }

  useEffect(() => {
    if (!hasMounted) return;
    const token = getAccessToken();
    if (!token) {
      return;
    }

    Promise.all([getMyBookings(token), getMyPayments(token), fetchAvailabilityWindow(token)])
      .then(([bookingItems, paymentItems, slots]) => {
        setBookings(bookingItems);
        setPayments(toPaymentMap(paymentItems));
        setAvailabilitySlots(slots);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Không thể tải dữ liệu quản lý lịch."))
      .finally(() => setLoading(false));
  }, [hasMounted]);

  async function handleConfirm(bookingId: string) {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(bookingId);
    setError("");
    try {
      await confirmBooking(token, bookingId);
      await reload(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể xác nhận đặt lịch.");
    } finally {
      setBusyId("");
    }
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

  return (
    <RoleDashboardShell active="bookingRequests" role="tutor">
      <PageHeader
        actions={
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-container-high)] px-4 py-2.5 text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--primary-fixed)] focus-visible:shadow-[var(--focus-ring)]" href="/tutor/schedule">
            <Icon name="calendar_month" />
            Mở lịch dạy
          </Link>
        }
        description="Duyệt yêu cầu đặt lịch, theo dõi booking cần xử lý và tổng quan các buổi dạy sắp tới."
        title="Yêu cầu đặt lịch"
      />

      {error ? (
        <div className="rounded-[var(--radius-md)] bg-[var(--error-container)] p-3 text-sm font-bold text-[var(--error)]" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <RequestsSkeleton />
      ) : (
        <div className="min-w-0 space-y-6">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
            <MiniMetric icon="pending_actions" label="Yêu cầu chờ duyệt" value={`${requests.length}`} tone="warning" />
            <MiniMetric icon="event_available" label="Khung giờ trống" value={`${upcomingSlots.length}`} />
            <MiniMetric icon="payments" label="Đã thanh toán" value={formatMoney(paidTotal)} tone="success" />
          </div>
          <main className="min-w-0 space-y-6">
            <RequestsPanel busyId={busyId} onConfirm={handleConfirm} onMessage={handleMessage} onSelect={setSelectedId} payments={payments} requests={requests} selected={selected} />
            <UpcomingPanel bookings={upcomingBookings.slice(0, 6)} payments={payments} />
            <OpenSlotsPanel slots={upcomingSlots.slice(0, 8)} />
          </main>
        </div>
      )}
    </RoleDashboardShell>
  );
}

function RequestsPanel({
  busyId,
  onConfirm,
  onMessage,
  onSelect,
  payments,
  requests,
  selected,
}: {
  busyId: string;
  onConfirm: (bookingId: string) => void;
  onMessage: (bookingId: string) => void;
  onSelect: (bookingId: string) => void;
  payments: Record<string, Payment>;
  requests: Booking[];
  selected: Booking | null;
}) {
  if (!requests.length) {
    return (
      <FeedbackState
        className="min-h-[300px]"
        description="Hiện không có booking nào đang chờ bạn xác nhận. Khi học viên đặt lịch mới, yêu cầu sẽ xuất hiện ở đây."
        icon="task_alt"
        title="Không có yêu cầu mới"
      />
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
      <Card className="min-w-0">
        <CardHeader action={<Badge tone="warning">{requests.length} cần xác nhận</Badge>}>
          <CardTitle>Yêu cầu đặt lịch</CardTitle>
          <CardDescription>Ưu tiên những buổi học sắp diễn ra trước.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          {requests.map((booking) => (
            <RequestButton active={selected?.id === booking.id} booking={booking} key={booking.id} onClick={() => onSelect(booking.id)} payment={payments[booking.id]} />
          ))}
        </div>
      </Card>
      {selected ? <RequestDetail booking={selected} busy={busyId === selected.id} onConfirm={() => onConfirm(selected.id)} onMessage={() => onMessage(selected.id)} payment={payments[selected.id]} /> : null}
    </div>
  );
}

function RequestButton({ active, booking, onClick, payment }: { active: boolean; booking: Booking; onClick: () => void; payment?: Payment }) {
  return (
    <button
      aria-pressed={active}
      className={[
        "flex min-w-0 w-full flex-col gap-3 rounded-[var(--radius-md)] border p-4 text-left transition focus-visible:shadow-[var(--focus-ring)]",
        active ? "border-[var(--primary)] bg-[var(--primary-fixed)]/55" : "border-[var(--outline-variant)] bg-white hover:bg-[var(--surface-container-low)]",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={booking.student.fullName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="tc-text-safe font-black text-[var(--on-surface)]">{booking.student.fullName}</p>
          <p className="tc-text-safe mt-1 text-sm text-[var(--on-surface-variant)]">{bookingSubject(booking)}</p>
        </div>
        <StatusBadge tone="warning">Cần xác nhận</StatusBadge>
      </div>
      <div className="grid gap-2 text-xs font-bold text-[var(--on-surface-variant)] sm:grid-cols-2">
        <span className="flex min-w-0 items-center gap-1"><Icon className="text-base" name="event" />{formatDate(booking.startsAt)}</span>
        <span className="flex min-w-0 items-center gap-1"><Icon className="text-base" name="schedule" />{formatTimeRange(booking)}</span>
      </div>
      {payment ? <p className="text-xs font-bold text-[var(--secondary)]">Thanh toán: {payment.status}</p> : null}
    </button>
  );
}

function RequestDetail({ booking, busy, onConfirm, onMessage, payment }: { booking: Booking; busy: boolean; onConfirm: () => void; onMessage: () => void; payment?: Payment }) {
  return (
    <Card className="min-w-0 2xl:sticky 2xl:top-24 2xl:self-start">
      <CardHeader>
        <CardTitle>Chi tiết yêu cầu</CardTitle>
        <CardDescription>Kiểm tra thời gian, học phí và ghi chú trước khi xác nhận.</CardDescription>
      </CardHeader>
      <div className="flex min-w-0 items-start gap-4 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-4">
        <Avatar name={booking.student.fullName} size="lg" />
        <div className="min-w-0">
          <h2 className="tc-text-safe text-xl font-black text-[var(--on-surface)]">{booking.student.fullName}</h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{booking.student.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge tone="warning">Cần xác nhận</StatusBadge>
            <StatusBadge tone={payment?.status === "PAID" ? "success" : "neutral"}>{payment?.status || "Chưa thanh toán"}</StatusBadge>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <DetailItem icon="menu_book" label="Môn học" value={bookingSubject(booking)} />
        <DetailItem icon="payments" label="Học phí" value={formatMoney(booking.grossAmountSnapshot || booking.hourlyRateSnapshot)} />
        <DetailItem icon="event" label="Ngày học" value={formatDate(booking.startsAt)} />
        <DetailItem icon="schedule" label="Thời gian" value={formatTimeRange(booking)} />
        <DetailItem icon={booking.teachingMode === "OFFLINE" ? "location_on" : "video_call"} label="Hình thức" value={modeLabel(booking.teachingMode)} />
        <DetailItem icon="tag" label="Mã lịch" value={`#${booking.id.slice(0, 8).toUpperCase()}`} />
      </div>
      {booking.studentNote ? (
        <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-[var(--on-surface-variant)]">Ghi chú học viên</p>
          <p className="tc-text-safe mt-2 text-sm leading-6 text-[var(--on-surface)]">{booking.studentNote}</p>
        </div>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button isLoading={busy} leftIcon={<Icon name="check_circle" />} onClick={onConfirm}>
          Xác nhận đặt lịch
        </Button>
        <Button disabled={busy} leftIcon={<Icon name="chat" />} onClick={onMessage} variant="outline">
          Nhắn học viên
        </Button>
        <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-container-high)] px-4 py-2.5 text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--primary-fixed)] focus-visible:shadow-[var(--focus-ring)]" href={`/bookings/${booking.id}`}>
          Chi tiết
          <Icon name="arrow_forward" />
        </Link>
      </div>
    </Card>
  );
}

function OpenSlotsPanel({ slots }: { slots: TutorAvailabilitySlot[] }) {
  return (
    <Card>
      <CardHeader
        action={
          <Link className="text-sm font-bold text-[var(--primary)] hover:underline" href="/tutor/schedule">
            Mở lịch dạy
          </Link>
        }
      >
        <CardTitle>Khung giờ trống sắp tới</CardTitle>
        <CardDescription>Các khung giờ học viên có thể đặt trong 6 tuần tới.</CardDescription>
      </CardHeader>
      {slots.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {slots.map((slot) => (
            <article className="rounded-[var(--radius-md)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4 text-[var(--status-success-text)]" key={slot.id}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="tc-text-safe font-black">Lịch trống</h3>
                  <p className="mt-2 text-sm font-bold">{formatDate(slot.startsAt)}</p>
                  <p className="mt-1 text-sm font-semibold">{formatSlotTimeRange(slot)}</p>
                </div>
                <StatusBadge tone="success">Có thể đặt</StatusBadge>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <FeedbackState className="min-h-[220px]" description="Chưa có khung giờ trống nào trong 6 tuần tới. Mở thêm lịch để học viên có thể đặt." icon="event_available" title="Chưa có lịch trống sắp tới" />
      )}
    </Card>
  );
}

function UpcomingPanel({ bookings, payments }: { bookings: Booking[]; payments: Record<string, Payment> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Buổi dạy sắp tới</CardTitle>
        <CardDescription>Các lịch đã đặt hoặc đã xác nhận, xem đầy đủ trong trang lịch.</CardDescription>
      </CardHeader>
      {bookings.length ? (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <article className="grid min-w-0 gap-4 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white p-4 md:grid-cols-[1fr_auto] md:items-center" key={booking.id}>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="tc-text-safe font-black text-[var(--on-surface)]">{bookingSubject(booking)}</h3>
                  <StatusBadge tone={payments[booking.id]?.status === "PAID" ? "success" : booking.status === "PENDING" ? "warning" : "info"}>{booking.status === "PENDING" ? "Cần xác nhận" : payments[booking.id]?.status === "PAID" ? "Đã thanh toán" : "Đã xác nhận"}</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-[var(--on-surface-variant)]">Học viên: {booking.student.fullName}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-[var(--on-surface-variant)]">
                  <span>{formatDate(booking.startsAt)}</span>
                  <span>{formatTimeRange(booking)}</span>
                  <span>{modeLabel(booking.teachingMode)}</span>
                </div>
              </div>
              <Link className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--primary)] hover:bg-[var(--surface-container-low)]" href={`/bookings/${booking.id}`}>
                Chi tiết
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <FeedbackState className="min-h-[220px]" description="Khi học viên đặt lịch, buổi dạy sẽ xuất hiện ở đây để bạn theo dõi." icon="school" title="Chưa có buổi dạy sắp tới" />
      )}
    </Card>
  );
}

function MiniMetric({ icon, label, tone = "info", value }: { icon: string; label: string; tone?: "info" | "success" | "warning"; value: string }) {
  return (
    <Card className="p-4" tone={tone === "warning" ? "warning" : tone === "info" ? "info" : "default"}>
      <div className="flex items-center gap-2 text-[var(--primary)]">
        <Icon name={icon} />
        <span className="text-xs font-black uppercase tracking-wide text-[var(--on-surface-variant)]">{label}</span>
      </div>
      <p className="tc-text-safe mt-2 text-2xl font-black text-[var(--on-surface)]">{value}</p>
    </Card>
  );
}

function DetailItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white p-4">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--on-surface-variant)]">
        <Icon className="text-base" name={icon} />
        {label}
      </p>
      <p className="tc-text-safe mt-2 text-sm font-black text-[var(--on-surface)]">{value}</p>
    </div>
  );
}

function RequestsSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]" role="status" aria-label="Đang tải quản lý lịch">
      <Card tone="subtle">
        <Skeleton className="h-8 w-40" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-11" key={index} />)}
        </div>
      </Card>
      <Card>
        <Skeleton className="h-8 w-48" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-28" key={index} />)}
        </div>
      </Card>
    </div>
  );
}
