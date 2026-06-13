"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { RoleDashboardShell } from "@/components/layouts/role-dashboard-shell";
import { ConfirmDialog } from "@/components/ui";
import { getCurrentUser, PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { Booking, BookingStatus, cancelBooking, confirmBooking, getMyBookings } from "@/lib/booking-api";
import { ensureConversation } from "@/lib/message-api";
import { createPayment, getMyPayments, mockConfirmPayment, Payment } from "@/lib/payment-api";
import {
  createTutorAvailabilitySlot,
  deleteTutorAvailabilitySlot,
  AvailabilityRepeat,
  getMyTutorAvailability,
  TutorAvailabilitySlot,
} from "@/lib/tutor-api";
import { useHasMounted } from "@/lib/use-has-mounted";

type Filter = "ALL" | "UPCOMING" | "PAST" | BookingStatus;

const statusLabels: Record<BookingStatus, string> = {
  PENDING: "Chờ gia sư xác nhận",
  CONFIRMED: "Đã xác nhận",
  CANCELLED: "Đã hủy",
  COMPLETED: "Đã hoàn thành",
};

const statusClasses: Record<BookingStatus, string> = {
  PENDING: "bg-[var(--secondary-fixed)] text-[var(--secondary)]",
  CONFIRMED: "bg-[var(--tertiary-fixed)] text-[var(--on-tertiary-fixed)]",
  CANCELLED: "bg-[var(--error-container)] text-[var(--error)]",
  COMPLETED: "bg-[var(--tertiary)]/10 text-[var(--tertiary)]",
};

function Icon({ name, fill = false, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return <span aria-hidden="true" className={["material-symbols-outlined", fill ? "icon-fill" : "", className].join(" ")}>{name}</span>;
}

function formatMoney(value: string | null | undefined) {
  const amount = Number(value || 0);
  return amount ? `${new Intl.NumberFormat("vi-VN").format(amount)}đ` : "Chưa có phí";
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
  return mode === "OFFLINE" ? "Offline" : mode === "ONLINE" ? "Online" : "Online/Offline";
}

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getDefaultAvailabilityRange() {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 2);

  if (start.getHours() >= 22) {
    start.setDate(start.getDate() + 1);
    start.setHours(18, 0, 0, 0);
  }

  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  return {
    date: toLocalDateInputValue(start),
    start: toTimeInputValue(start),
    end: toTimeInputValue(end),
  };
}

export default function BookingsPage() {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const defaultAvailability = useMemo(() => getDefaultAvailabilityRange(), []);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [filter, setFilter] = useState<Filter>("ALL");
  const [availabilitySlots, setAvailabilitySlots] = useState<TutorAvailabilitySlot[]>([]);
  const [slotDate, setSlotDate] = useState(defaultAvailability.date);
  const [slotStart, setSlotStart] = useState(defaultAvailability.start);
  const [slotEnd, setSlotEnd] = useState(defaultAvailability.end);
  const [slotRepeat, setSlotRepeat] = useState<AvailabilityRepeat>("NONE");
  const [slotOccurrences, setSlotOccurrences] = useState(4);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [deleteSlotTarget, setDeleteSlotTarget] = useState<TutorAvailabilitySlot | null>(null);

  useEffect(() => {
    if (!hasMounted) return;
    const token = getAccessToken();

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    Promise.all([getCurrentUser(token), getMyBookings(token), getMyPayments(token)])
      .then(([current, bookingItems, paymentItems]) => {
        setUser(current.user);
        setBookings(bookingItems);
        setPayments(toPaymentMap(paymentItems));
        if (current.user.role === "TUTOR") {
          return getMyTutorAvailability(token, slotDate).then((availability) => {
            setAvailabilitySlots(availability.slots);
          });
        }
        return undefined;
      })
      .catch((requestError) => {
        clearTokens();
        setError(requestError instanceof Error ? requestError.message : "Không thể tải lịch học.");
      })
      .finally(() => setIsLoading(false));
  }, [hasMounted, router, slotDate]);

  const role = user?.role;
  const isTutor = role === "TUTOR";
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

  function handleCancel(booking: Booking) {
    setCancelTarget(booking);
  }

  async function confirmCancelBooking() {
    const token = getAccessToken();
    if (!token || !cancelTarget) return;

    setBusyId(cancelTarget.id);
    setError("");
    try {
      await cancelBooking(token, cancelTarget.id, "Người dùng yêu cầu hủy từ trang quản lý lịch học.");
      await reload(token);
      setCancelTarget(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể hủy lịch học.");
    } finally {
      setBusyId("");
    }
  }

  async function reloadAvailability(token: string, weekStart = slotDate) {
    const availability = await getMyTutorAvailability(token, weekStart);
    setAvailabilitySlots(availability.slots);
  }

  async function handleCreateAvailability() {
    const token = getAccessToken();
    if (!token) return;

    const startsAt = new Date(`${slotDate}T${slotStart}:00`);
    const endsAt = new Date(`${slotDate}T${slotEnd}:00`);

    setAvailabilityBusy(true);
    setError("");
    try {
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        throw new Error("Ngày giờ lịch dạy không hợp lệ.");
      }

      if (startsAt <= new Date()) {
        throw new Error("Vui lòng chọn khung giờ trong tương lai.");
      }

      if (endsAt <= startsAt) {
        throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
      }

      await createTutorAvailabilitySlot(token, {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        repeat: slotRepeat,
        occurrences: slotRepeat === "NONE" ? 1 : slotOccurrences,
      });
      await reloadAvailability(token, slotDate);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể thêm lịch trống.");
    } finally {
      setAvailabilityBusy(false);
    }
  }

  async function handleDeleteAvailability(slotId: string) {
    const token = getAccessToken();
    if (!token) return false;

    setAvailabilityBusy(true);
    setError("");
    try {
      await deleteTutorAvailabilitySlot(token, slotId);
      await Promise.all([reload(token), reloadAvailability(token, slotDate)]);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể xóa lịch dạy.");
      return false;
    } finally {
      setAvailabilityBusy(false);
    }
  }

  async function confirmDeleteAvailability() {
    if (!deleteSlotTarget) return;
    const deleted = await handleDeleteAvailability(deleteSlotTarget.id);
    if (deleted) setDeleteSlotTarget(null);
  }

  if (!hasMounted || (isLoading && !user)) {
    return <BookingsSkeleton />;
  }

  return (
    <RoleDashboardShell active="bookings" role={isTutor ? "tutor" : "student"}>
      <main className="min-h-screen">
        <div className="flex w-full flex-col gap-8">
          <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-black text-[var(--primary)]">{isTutor ? "Tổng quan lịch dạy" : "Lịch học của tôi"}</h1>
              <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                {isTutor ? "Quản lý lịch dạy, học viên và thu nhập từ các buổi học." : "Quản lý lịch học sắp tới và các buổi học đã hoàn thành."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 rounded-xl bg-[var(--surface-container-high)] p-1">
              <FilterButton active={filter === "ALL"} label="Tất cả" onClick={() => setFilter("ALL")} />
              <FilterButton active={filter === "UPCOMING"} label="Sắp tới" onClick={() => setFilter("UPCOMING")} />
              <FilterButton active={filter === "PAST"} label="Đã qua" onClick={() => setFilter("PAST")} />
              <FilterButton active={filter === "PENDING"} label="Chờ xử lý" onClick={() => setFilter("PENDING")} />
            </div>
          </header>

          {error ? <p className="rounded-lg bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--on-error-container)]">{error}</p> : null}

          {isTutor ? (
            <AvailabilityManager
              busy={availabilityBusy}
              date={slotDate}
              end={slotEnd}
              occurrences={slotOccurrences}
              onCreate={handleCreateAvailability}
              onDateChange={setSlotDate}
              onDelete={(slot) => setDeleteSlotTarget(slot)}
              onEndChange={setSlotEnd}
              onOccurrencesChange={setSlotOccurrences}
              onRepeatChange={setSlotRepeat}
              onStartChange={setSlotStart}
              repeat={slotRepeat}
              slots={availabilitySlots}
              start={slotStart}
            />
          ) : null}

          <section className={`grid grid-cols-1 gap-6 ${isTutor ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
            <Metric icon="calendar_today" label={isTutor ? "Lịch hôm nay" : "Sắp tới"} value={String(upcomingCount)} note="Buổi học chưa bị hủy" />
            <Metric icon="check_circle" label="Đã hoàn thành" value={String(completedCount)} note="Tổng buổi học" accent="tertiary" />
            <Metric icon="payments" label={isTutor ? "Doanh thu đã nhận" : "Đã thanh toán"} value={formatMoney(String(paidTotal))} note="Từ thanh toán thành công" accent="secondary" />
            {isTutor ? <Metric icon="notification_important" label="Yêu cầu chờ" value={String(pendingCount)} note="Cần gia sư xác nhận" accent="error" /> : null}
          </section>

          {isTutor ? (
            <TutorBookingsView bookings={filteredBookings} payments={payments} busyId={busyId} isLoading={isLoading} onConfirm={handleConfirm} onMessage={handleMessage} />
          ) : (
            <StudentBookingsView bookings={filteredBookings} payments={payments} busyId={busyId} isLoading={isLoading} onCancel={handleCancel} onMessage={handleMessage} onPay={handlePay} />
          )}
        </div>
        <ConfirmDialog
          confirmLabel="Hủy lịch học"
          description={
            cancelTarget && (payments[cancelTarget.id] || cancelTarget.payment)?.status === "PAID"
              ? "Lịch này đã thanh toán. Hủy lịch có thể hoàn tiền cho học viên và cập nhật thanh toán liên quan."
              : "Lịch học sẽ bị hủy và không còn hiển thị như một buổi học sắp tới."
          }
          isBusy={Boolean(cancelTarget && busyId === cancelTarget.id)}
          onCancel={() => setCancelTarget(null)}
          onConfirm={confirmCancelBooking}
          open={Boolean(cancelTarget)}
          title="Hủy lịch học này?"
        />
        <ConfirmDialog
          confirmLabel={deleteSlotTarget?.isBooked ? "Hủy khung giờ" : "Xóa khung giờ"}
          description={
            deleteSlotTarget?.isBooked
              ? "Khung giờ này đã có học viên đặt. Xóa lịch sẽ hủy booking và cập nhật thanh toán liên quan theo logic hiện tại."
              : "Khung giờ trống này sẽ không còn xuất hiện cho học viên đặt lịch."
          }
          isBusy={availabilityBusy}
          onCancel={() => setDeleteSlotTarget(null)}
          onConfirm={confirmDeleteAvailability}
          open={Boolean(deleteSlotTarget)}
          title={deleteSlotTarget?.isBooked ? "Hủy khung giờ đã có booking?" : "Xóa khung giờ trống?"}
        />
      </main>
    </RoleDashboardShell>
  );
}

function AvailabilityManager({
  busy,
  date,
  end,
  occurrences,
  onCreate,
  onDateChange,
  onDelete,
  onEndChange,
  onOccurrencesChange,
  onRepeatChange,
  onStartChange,
  repeat,
  slots,
  start,
}: {
  busy: boolean;
  date: string;
  end: string;
  occurrences: number;
  onCreate: () => void;
  onDateChange: (value: string) => void;
  onDelete: (slot: TutorAvailabilitySlot) => void;
  onEndChange: (value: string) => void;
  onOccurrencesChange: (value: number) => void;
  onRepeatChange: (value: AvailabilityRepeat) => void;
  onStartChange: (value: string) => void;
  repeat: AvailabilityRepeat;
  slots: TutorAvailabilitySlot[];
  start: string;
}) {
  const visibleSlots = slots
    .filter((slot) => new Date(slot.endsAt) >= new Date())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-black text-[var(--primary)]">Lịch trống của gia sư</h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            Thêm một lần hoặc lặp cố định theo tuần/tháng để học viên chọn và đặt lịch.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-fixed)] px-3 py-1 text-xs font-black text-[var(--primary)]">
          <Icon name="event_available" className="text-base" />
          {visibleSlots.length} khung giờ mở
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_.8fr_.8fr_1fr_.8fr_auto]">
        <label className="flex flex-col gap-1 text-xs font-bold uppercase text-[var(--on-surface-variant)]">
          Ngày dạy
          <input className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold normal-case text-[var(--on-surface)]" min={toLocalDateInputValue(new Date())} onChange={(event) => onDateChange(event.target.value)} type="date" value={date} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold uppercase text-[var(--on-surface-variant)]">
          Bắt đầu
          <TimeSelect onChange={onStartChange} value={start} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold uppercase text-[var(--on-surface-variant)]">
          Kết thúc
          <TimeSelect onChange={onEndChange} value={end} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold uppercase text-[var(--on-surface-variant)]">
          Lặp lại
          <select className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold normal-case text-[var(--on-surface)]" onChange={(event) => onRepeatChange(event.target.value as AvailabilityRepeat)} value={repeat}>
            <option value="NONE">Không lặp</option>
            <option value="WEEKLY">Hàng tuần</option>
            <option value="MONTHLY">Hàng tháng</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold uppercase text-[var(--on-surface-variant)]">
          Số lần
          <input className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold normal-case text-[var(--on-surface)]" disabled={repeat === "NONE"} max={24} min={1} onChange={(event) => onOccurrencesChange(Number(event.target.value) || 1)} type="number" value={repeat === "NONE" ? 1 : occurrences} />
        </label>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60 md:self-end" disabled={busy} onClick={onCreate} type="button">
          <Icon name="add" />
          {repeat === "NONE" ? "Thêm lịch trống" : "Tạo lịch cố định"}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleSlots.length ? (
          visibleSlots.map((slot) => <AvailabilitySlotCard busy={busy} key={slot.id} onDelete={() => onDelete(slot)} slot={slot} />)
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-5 text-sm font-semibold text-[var(--on-surface-variant)] md:col-span-2 xl:col-span-3">
            Chưa có khung giờ trống. Hãy thêm lịch dạy để học viên có thể đặt lớp.
          </p>
        )}
      </div>
    </section>
  );
}

function AvailabilitySlotCard({ busy, onDelete, slot }: { busy: boolean; onDelete: () => void; slot: TutorAvailabilitySlot }) {
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  const booked = slot.isBooked;

  return (
    <article className="flex items-center justify-between gap-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
      <div>
        <p className="text-sm font-black text-[var(--primary)]">{formatDate(slot.startsAt)}</p>
        <p className="mt-1 text-sm font-semibold text-[var(--on-surface)]">
          {start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - {end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <span className={`mt-2 inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-black leading-none ${booked ? "bg-[var(--secondary-fixed)] text-[var(--secondary)]" : "bg-[var(--tertiary-fixed)] text-[var(--on-tertiary-fixed)]"}`}>
          {booked ? "Đã có học viên đặt" : "Đang mở"}
        </span>
      </div>
      <button
        className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--error)]/30 px-3 py-2 text-sm font-black text-[var(--error)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy}
        onClick={onDelete}
        type="button"
      >
        {booked ? "Hủy lịch" : "Xóa"}
      </button>
    </article>
  );
}

function TutorBookingsView({ bookings, busyId, isLoading, onConfirm, onMessage, payments }: { bookings: Booking[]; busyId: string; isLoading: boolean; payments: Record<string, Payment>; onConfirm: (bookingId: string) => void; onMessage: (bookingId: string) => void }) {
  const upcoming = bookings.filter((booking) => booking.status !== "CANCELLED");
  const pending = bookings.filter((booking) => booking.status === "PENDING");

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <section className="space-y-4 xl:col-span-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">Buổi dạy sắp tới</h2>
          <Link className="inline-flex items-center gap-1 text-sm font-bold text-[var(--primary)] hover:underline" href="/bookings">
            Xem lịch <Icon className="text-sm" name="arrow_forward" />
          </Link>
        </div>
        {isLoading ? <EmptyState text="Đang tải lịch dạy..." /> : upcoming.length ? upcoming.map((booking) => <TutorSessionCard booking={booking} busy={busyId === booking.id} key={booking.id} onMessage={() => onMessage(booking.id)} payment={payments[booking.id]} />) : <EmptyState text="Chưa có lịch dạy." />}
      </section>
      <aside className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-6 shadow-sm xl:col-span-4">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-black">Yêu cầu đặt lịch</h2>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--error)] text-xs font-black text-white">{pending.length}</span>
        </div>
        <div className="max-h-[620px] space-y-4 overflow-y-auto pr-1">
          {pending.length ? pending.map((booking) => <RequestCard booking={booking} busy={busyId === booking.id} key={booking.id} onConfirm={() => onConfirm(booking.id)} />) : <p className="text-sm text-[var(--on-surface-variant)]">Không có yêu cầu mới.</p>}
        </div>
      </aside>
    </div>
  );
}

function StudentBookingsView({ bookings, busyId, isLoading, onCancel, onMessage, onPay, payments }: { bookings: Booking[]; busyId: string; isLoading: boolean; payments: Record<string, Payment>; onCancel: (booking: Booking) => void; onMessage: (bookingId: string) => void; onPay: (bookingId: string) => void; }) {
  if (isLoading) return <EmptyState text="Đang tải lịch học..." />;
  if (!bookings.length) return <EmptyState text="Bạn chưa có lịch học phù hợp." />;

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {bookings.map((booking) => (
        <StudentBookingCard
          booking={booking}
          busy={busyId === booking.id}
          key={booking.id}
          onCancel={() => onCancel(booking)}
          onMessage={() => onMessage(booking.id)}
          onPay={() => onPay(booking.id)}
          payment={payments[booking.id]}
        />
      ))}
    </section>
  );
}

function TutorSessionCard({ booking, busy, onMessage, payment }: { booking: Booking; busy: boolean; onMessage: () => void; payment?: Payment }) {
  return (
    <article className="flex flex-col gap-5 rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm transition hover:shadow-md lg:flex-row lg:items-center">
      <DateBlock value={booking.startsAt} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h3 className="text-xl font-black">{bookingSubject(booking)}</h3>
            <p className="mt-1 flex items-center gap-1 text-sm text-[var(--on-surface-variant)]">
              <Icon className="text-sm" name="person" />
              Học viên: {booking.student.fullName}
            </p>
          </div>
          <StatusBadge status={booking.status} payment={payment} />
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm text-[var(--on-surface-variant)]">
          <span className="flex items-center gap-1"><Icon className="text-sm" name="alarm" />{formatTimeRange(booking)}</span>
          <span className="flex items-center gap-1"><Icon className="text-sm" name={booking.teachingMode === "OFFLINE" ? "location_on" : "video_call"} />{modeLabel(booking.teachingMode)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Link className="rounded-lg bg-[var(--primary)] px-4 py-2 text-center text-sm font-bold text-white" href={`/bookings/${booking.id}`}>Chi tiết</Link>
        <button className="rounded-lg border border-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--primary)] disabled:opacity-60" disabled={busy} onClick={onMessage} type="button">Nhắn học viên</button>
      </div>
    </article>
  );
}

function StudentBookingCard({ booking, busy, onCancel, onMessage, onPay, payment }: { booking: Booking; busy: boolean; onCancel: () => void; onMessage: () => void; onPay: () => void; payment?: Payment }) {
  const paid = payment?.status === "PAID";
  const cancellable = booking.status !== "CANCELLED" && booking.status !== "COMPLETED";

  return (
    <article className={`relative flex flex-col gap-5 overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm transition-colors hover:bg-[var(--surface-container-lowest)] ${booking.status === "CANCELLED" ? "opacity-60 grayscale" : ""}`}>
      <div className={`absolute right-0 top-0 h-full w-2 ${paid ? "bg-[var(--primary-container)]" : "bg-[var(--secondary-container)]"}`} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={booking.tutor.fullName} src={booking.tutor.avatarUrl} />
          <div className="min-w-0">
            <h3 className="truncate text-xl font-black">{booking.tutor.fullName}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-black uppercase leading-none text-[var(--primary)]">{bookingSubject(booking)}</span>
              <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[var(--surface-container-high)] px-2 py-1 text-xs font-black uppercase leading-none text-[var(--on-surface-variant)]">{modeLabel(booking.teachingMode)}</span>
              <span className="flex items-center text-sm font-bold text-[var(--secondary)]"><Icon className="text-sm" fill name="star" /> Tutor</span>
            </div>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-black leading-none ${statusClasses[booking.status]}`}>{statusLabels[booking.status]}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 border-y border-[var(--outline-variant)]/50 py-4 sm:grid-cols-2">
        <InfoLine icon="calendar_month" label="Ngày giờ" value={`${formatDate(booking.startsAt)} · ${formatTimeRange(booking)}`} />
        <InfoLine icon={paid ? "verified" : "pending"} label="Thanh toán" value={paid ? "Đã thanh toán" : payment?.status || "Chưa thanh toán"} tone={paid ? "tertiary" : "secondary"} />
      </div>
      <div className="mt-auto flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={busy} onClick={onMessage} type="button"><Icon className="text-sm" name="chat" />Nhắn tin</button>
          <Link className="inline-flex min-h-11 items-center rounded-lg border border-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--primary)]" href={`/bookings/${booking.id}`}>Chi tiết</Link>
          {!paid && booking.status === "CONFIRMED" ? <button className="inline-flex min-h-11 items-center rounded-lg bg-[var(--secondary-container)] px-4 py-2 text-sm font-bold text-[var(--on-secondary-container)] disabled:opacity-60" disabled={busy} onClick={onPay} type="button">Thanh toán</button> : null}
        </div>
        {cancellable ? <button className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--error)] hover:underline disabled:opacity-60" disabled={busy} onClick={onCancel} type="button">Hủy lịch</button> : null}
      </div>
    </article>
  );
}

function RequestCard({ booking, busy, onConfirm }: { booking: Booking; busy: boolean; onConfirm: () => void }) {
  return (
    <article className="rounded-xl border border-[var(--outline-variant)] bg-white p-4 shadow-sm">
      <div className="mb-3 flex gap-3">
        <Avatar name={booking.student.fullName} small />
        <div>
          <p className="font-black">{booking.student.fullName}</p>
          <p className="text-sm text-[var(--on-surface-variant)]">đã yêu cầu {bookingSubject(booking)}</p>
        </div>
      </div>
      <div className="mb-4 space-y-1 text-sm text-[var(--on-surface-variant)]">
        <p className="flex items-center gap-2"><Icon className="text-base" name="event" />{formatDate(booking.startsAt)}</p>
        <p className="flex items-center gap-2"><Icon className="text-base" name="schedule" />{formatTimeRange(booking)}</p>
      </div>
      <button className="min-h-11 w-full rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={busy} onClick={onConfirm} type="button">
        {busy ? "Đang xác nhận..." : "Xác nhận đặt lịch"}
      </button>
    </article>
  );
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={`min-h-11 rounded-lg px-4 py-2 text-sm font-bold ${active ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-highest)]"}`} onClick={onClick} type="button">{label}</button>;
}

function Metric({ accent = "primary", icon, label, note, value }: { accent?: "primary" | "tertiary" | "secondary" | "error"; icon: string; label: string; note: string; value: string }) {
  const color = accent === "tertiary" ? "text-[var(--tertiary)]" : accent === "secondary" ? "text-[var(--secondary)]" : accent === "error" ? "text-[var(--error)]" : "text-[var(--primary)]";
  return (
    <article className="rounded-xl border border-[var(--outline-variant)]/50 bg-white p-6 shadow-sm">
      <div className={`mb-2 flex items-center gap-2 ${color}`}><Icon name={icon} /><span className="text-sm font-bold">{label}</span></div>
      <p className="text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{note}</p>
    </article>
  );
}

function DateBlock({ value }: { value: string }) {
  const date = new Date(value);
  return (
    <div className="flex min-w-[96px] flex-col items-center justify-center rounded-lg bg-[var(--surface-container-high)] p-4">
      <span className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">{date.toLocaleString("vi-VN", { month: "short" })}</span>
      <span className="text-2xl font-black text-[var(--primary)]">{date.getDate()}</span>
      <span className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">{date.toLocaleString("vi-VN", { weekday: "short" })}</span>
    </div>
  );
}

function TimeSelect({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const [rawHours = "00", rawMinutes = "00"] = value.split(":");
  const hours = clampNumber(Number(rawHours), 0, 23);
  const minutes = clampNumber(Number(rawMinutes), 0, 59);

  function commit(nextHours: number, nextMinutes: number) {
    onChange(`${String(clampNumber(nextHours, 0, 23)).padStart(2, "0")}:${String(clampNumber(nextMinutes, 0, 59)).padStart(2, "0")}`);
  }

  function updatePart(part: "hour" | "minute", rawValue: string) {
    const digits = rawValue.replace(/\D/g, "").slice(-2);
    const nextValue = Number(digits || 0);
    if (part === "hour") {
      commit(nextValue, minutes);
    } else {
      commit(hours, nextValue);
    }
  }

  function step(part: "hour" | "minute", direction: 1 | -1) {
    if (part === "hour") {
      commit((hours + direction + 24) % 24, minutes);
      return;
    }
    commit(hours, (minutes + direction + 60) % 60);
  }

  function handleKeyDown(part: "hour" | "minute", event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      step(part, 1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      step(part, -1);
    }
  }

  return (
    <div className="grid min-h-11 w-full grid-cols-[1fr_auto_1fr] items-center gap-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-2 py-1 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15">
      <TimePartInput
        label="Giờ"
        onChange={(nextValue) => updatePart("hour", nextValue)}
        onDecrement={() => step("hour", -1)}
        onIncrement={() => step("hour", 1)}
        onKeyDown={(event) => handleKeyDown("hour", event)}
        value={String(hours).padStart(2, "0")}
      />
      <span className="text-center text-base font-black text-[var(--on-surface-variant)]">:</span>
      <TimePartInput
        label="Phút"
        onChange={(nextValue) => updatePart("minute", nextValue)}
        onDecrement={() => step("minute", -1)}
        onIncrement={() => step("minute", 1)}
        onKeyDown={(event) => handleKeyDown("minute", event)}
        value={String(minutes).padStart(2, "0")}
      />
    </div>
  );
}

function TimePartInput({
  label,
  onChange,
  onDecrement,
  onIncrement,
  onKeyDown,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-1.5">
      <input
        aria-label={label}
        className="h-10 w-12 rounded border-0 bg-white text-center text-sm font-black tabular-nums text-[var(--on-surface)] outline-none focus:ring-0"
        inputMode="numeric"
        maxLength={2}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.target.select()}
        onKeyDown={onKeyDown}
        value={value}
      />
      <div className="flex gap-1">
        <button aria-label={`Tăng ${label.toLowerCase()}`} className="flex h-10 w-8 items-center justify-center rounded-md text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] focus:shadow-[var(--focus-ring)] focus:outline-none" onClick={onIncrement} type="button">
          <Icon className="text-[16px] leading-none" name="keyboard_arrow_up" />
        </button>
        <button aria-label={`Giảm ${label.toLowerCase()}`} className="flex h-10 w-8 items-center justify-center rounded-md text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] focus:shadow-[var(--focus-ring)] focus:outline-none" onClick={onDecrement} type="button">
          <Icon className="text-[16px] leading-none" name="keyboard_arrow_down" />
        </button>
      </div>
    </div>
  );
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function StatusBadge({ payment, status }: { payment?: Payment; status: BookingStatus }) {
  const paid = payment?.status === "PAID";
  const label = paid ? "Đã xác nhận thanh toán" : statusLabels[status];
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-black leading-none ${paid ? "bg-[var(--tertiary-fixed)] text-[var(--on-tertiary-fixed)]" : statusClasses[status]}`}>{label}</span>;
}

function InfoLine({ icon, label, tone = "primary", value }: { icon: string; label: string; tone?: "primary" | "tertiary" | "secondary"; value: string }) {
  const color = tone === "tertiary" ? "text-[var(--tertiary)]" : tone === "secondary" ? "text-[var(--secondary)]" : "text-[var(--primary)]";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">{label}</span>
      <span className={`flex items-center gap-2 text-sm font-semibold ${color}`}><Icon name={icon} />{value}</span>
    </div>
  );
}

function Avatar({ name, small = false, src }: { name: string; small?: boolean; src?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  const size = small ? "h-10 w-10 text-sm" : "h-14 w-14 text-xl";
  const showImage = Boolean(src) && !imageFailed;

  return (
    <div className={`${size} relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-fixed)] font-black text-[var(--primary)]`}>
      {showImage ? <Image alt={name} className="object-cover" fill onError={() => setImageFailed(true)} sizes={small ? "40px" : "56px"} src={src || ""} unoptimized /> : initial}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-[var(--outline-variant)] bg-white p-8 text-center text-sm font-semibold text-[var(--on-surface-variant)]">{text}</div>;
}

function BookingsSkeleton() {
  return <main className="min-h-screen bg-[var(--surface)] px-5 py-8 md:px-10"><section className="min-h-[540px] w-full rounded-xl border border-[var(--outline-variant)] bg-white" /></main>;
}

function toPaymentMap(items: Payment[]) {
  return items.reduce<Record<string, Payment>>((acc, payment) => {
    acc[payment.bookingId] = payment;
    return acc;
  }, {});
}
