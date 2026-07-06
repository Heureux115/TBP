"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RoleDashboardShell } from "@/components/layouts/role-dashboard-shell";
import { Button, Card, CardDescription, CardHeader, CardTitle, ConfirmDialog, Dialog, FeedbackState, Icon, PageHeader, Skeleton, StatusBadge, type StatusTone } from "@/components/ui";
import { getAccessToken } from "@/lib/auth-storage";
import { Booking, getMyBookings } from "@/lib/booking-api";
import { getMyPayments, Payment } from "@/lib/payment-api";
import { AvailabilityRepeat, createTutorAvailabilitySlot, deleteTutorAvailabilitySlot, getMyTutorAvailability, TutorAvailabilitySlot } from "@/lib/tutor-api";
import { useHasMounted } from "@/lib/use-has-mounted";

type CalendarView = "month" | "week";
type CalendarEventType = "booking" | "slot";

type CalendarEvent = {
  booking?: Booking;
  endsAt: Date;
  id: string;
  payment?: Payment;
  slot?: TutorAvailabilitySlot;
  startsAt: Date;
  subtitle: string;
  title: string;
  tone: StatusTone;
  type: CalendarEventType;
};

const weekdays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
const hourStart = 6;
const hourEnd = 23;
const hourHeight = 72;
const fieldControlClasses =
  "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm font-semibold text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

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

function endOfWeek(date: Date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
}

function monthRange(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const end = endOfWeek(last);
  return { end, start };
}

function viewRange(date: Date, view: CalendarView) {
  if (view === "month") return monthRange(date);
  return { end: endOfWeek(date), start: startOfWeek(date) };
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toLocalDateInputValue(date: Date) {
  return dateKey(date);
}

function toTimeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function defaultRange() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 2);
  if (start.getHours() >= 22) {
    start.setDate(start.getDate() + 1);
    start.setHours(18, 0, 0, 0);
  }
  const end = new Date(start);
  end.setHours(end.getHours() + 2);
  return { date: toLocalDateInputValue(start), end: toTimeInputValue(end), start: toTimeInputValue(start) };
}

function addAvailabilityRepeatDate(date: Date, repeat: AvailabilityRepeat, index: number) {
  const next = new Date(date);

  if (repeat === "WEEKLY") next.setDate(next.getDate() + index * 7);
  if (repeat === "MONTHLY") next.setMonth(next.getMonth() + index);

  return next;
}

function buildAvailabilityOccurrences(startsAt: Date, endsAt: Date, repeat: AvailabilityRepeat, occurrences: number) {
  const count = repeat === "NONE" ? 1 : occurrences;

  return Array.from({ length: count }, (_, index) => ({
    endsAt: addAvailabilityRepeatDate(endsAt, repeat, index),
    startsAt: addAvailabilityRepeatDate(startsAt, repeat, index),
  }));
}

function findOverlappingAvailabilitySlot(candidateSlots: Array<{ startsAt: Date; endsAt: Date }>, existingSlots: TutorAvailabilitySlot[]) {
  return candidateSlots.find((candidate) =>
    existingSlots.some((slot) => {
      const existingStartsAt = new Date(slot.startsAt);
      const existingEndsAt = new Date(slot.endsAt);

      return existingStartsAt < candidate.endsAt && existingEndsAt > candidate.startsAt;
    }),
  );
}

function formatCandidateRange(slot: { startsAt: Date; endsAt: Date }) {
  const date = slot.startsAt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", weekday: "short" });
  return `${date}, ${formatTimeRange(slot.startsAt, slot.endsAt)}`;
}

function daysBetween(start: Date, end: Date) {
  const days: Date[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function weekStartsBetween(start: Date, end: Date) {
  const weeks: string[] = [];
  const cursor = startOfWeek(start);
  const last = startOfWeek(end);
  while (cursor <= last) {
    weeks.push(toLocalDateInputValue(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function isSameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b);
}

function overlapsRange(startsAt: Date, endsAt: Date, start: Date, end: Date) {
  return startsAt <= end && endsAt >= start;
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatTimeRange(start: Date, end: Date) {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

function calendarTitle(date: Date, view: CalendarView) {
  if (view === "month") {
    return date.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
  }
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  return `${start.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} - ${end.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
}

function bookingSubject(booking: Booking) {
  return booking.tutor.headline?.split("-")[0]?.trim() || "Buổi học TutorConnect";
}

function modeLabel(mode: Booking["teachingMode"]) {
  return mode === "OFFLINE" ? "Offline" : mode === "ONLINE" ? "Online" : "Online/Offline";
}

function paymentStatus(payment?: Payment) {
  if (!payment) return "Chưa thanh toán";
  if (payment.status === "PAID") return "Đã thanh toán";
  if (payment.status === "REFUNDED") return "Đã hoàn tiền";
  if (payment.status === "FAILED") return "Thanh toán lỗi";
  if (payment.status === "CANCELLED") return "Thanh toán đã hủy";
  return "Chờ thanh toán";
}

function bookingTone(booking: Booking, payment?: Payment): StatusTone {
  if (booking.status === "CANCELLED") return "danger";
  if (booking.status === "PENDING") return "warning";
  if (booking.status === "COMPLETED" || payment?.status === "PAID") return "success";
  return "info";
}

function bookingStatus(booking: Booking, payment?: Payment) {
  if (booking.status === "PENDING") return "Cần xác nhận";
  if (booking.status === "CONFIRMED" && payment?.status === "PAID") return "Đã thanh toán";
  if (booking.status === "CONFIRMED") return "Đã xác nhận";
  if (booking.status === "COMPLETED") return "Đã hoàn thành";
  return "Đã hủy";
}

function toPaymentMap(items: Payment[]) {
  return items.reduce<Record<string, Payment>>((acc, payment) => {
    acc[payment.bookingId] = payment;
    return acc;
  }, {});
}

function toCalendarEvents(slots: TutorAvailabilitySlot[], bookings: Booking[], payments: Record<string, Payment>) {
  const events: CalendarEvent[] = [];
  const slotIdsWithBooking = new Set(bookings.map((booking) => booking.availabilitySlotId));

  for (const slot of slots) {
    if (slotIdsWithBooking.has(slot.id)) continue;
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(slot.endsAt);
    events.push({
      endsAt,
      id: `slot-${slot.id}`,
      slot,
      startsAt,
      subtitle: slot.isBooked ? "Đã có học viên đặt" : "Học viên có thể đặt",
      title: slot.isBooked ? "Đã có học viên đặt" : "Lịch trống",
      tone: slot.isBooked ? "warning" : "success",
      type: "slot",
    });
  }

  for (const booking of bookings) {
    const startsAt = new Date(booking.startsAt);
    const endsAt = new Date(booking.endsAt);
    const payment = payments[booking.id];
    events.push({
      booking,
      endsAt,
      id: `booking-${booking.id}`,
      payment,
      startsAt,
      subtitle: `${booking.student.fullName} · ${modeLabel(booking.teachingMode)}`,
      title: bookingSubject(booking),
      tone: bookingTone(booking, payment),
      type: "booking",
    });
  }

  return events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function TutorScheduleScreen() {
  const hasMounted = useHasMounted();
  const initial = useMemo(() => defaultRange(), []);
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [slots, setSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TutorAvailabilitySlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [slotDate, setSlotDate] = useState(initial.date);
  const [slotStart, setSlotStart] = useState(initial.start);
  const [slotEnd, setSlotEnd] = useState(initial.end);
  const [slotRepeat, setSlotRepeat] = useState<AvailabilityRepeat>("NONE");
  const [slotOccurrences, setSlotOccurrences] = useState(4);

  const range = useMemo(() => viewRange(anchorDate, view), [anchorDate, view]);
  const calendarDays = useMemo(() => daysBetween(range.start, range.end), [range.end, range.start]);
  const events = useMemo(() => {
    return toCalendarEvents(slots, bookings, payments).filter((event) => overlapsRange(event.startsAt, event.endsAt, range.start, range.end));
  }, [bookings, payments, range.end, range.start, slots]);

  async function loadSchedule(token: string, nextRange = range) {
    const weekStarts = weekStartsBetween(nextRange.start, nextRange.end);
    const [bookingItems, paymentItems, ...availabilityItems] = await Promise.all([
      getMyBookings(token),
      getMyPayments(token),
      ...weekStarts.map((weekStart) => getMyTutorAvailability(token, weekStart)),
    ]);
    const slotMap = new Map<string, TutorAvailabilitySlot>();
    for (const availability of availabilityItems) {
      for (const slot of availability.slots) slotMap.set(slot.id, slot);
    }
    setBookings(bookingItems);
    setPayments(toPaymentMap(paymentItems));
    setSlots(Array.from(slotMap.values()));
  }

  useEffect(() => {
    if (!hasMounted) return;
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const weekStarts = weekStartsBetween(range.start, range.end);
    Promise.all([
      getMyBookings(token),
      getMyPayments(token),
      ...weekStarts.map((weekStart) => getMyTutorAvailability(token, weekStart)),
    ])
      .then(([bookingItems, paymentItems, ...availabilityItems]) => {
        const slotMap = new Map<string, TutorAvailabilitySlot>();
        for (const availability of availabilityItems) {
          for (const slot of availability.slots) slotMap.set(slot.id, slot);
        }
        setBookings(bookingItems);
        setPayments(toPaymentMap(paymentItems));
        setSlots(Array.from(slotMap.values()));
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Không thể tải lịch dạy."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted, range.end.getTime(), range.start.getTime()]);

  function moveDate(direction: -1 | 1) {
    setAnchorDate((current) => {
      const next = new Date(current);
      if (view === "month") next.setMonth(next.getMonth() + direction);
      else next.setDate(next.getDate() + direction * 7);
      return next;
    });
  }

  function goToday() {
    setAnchorDate(new Date());
  }

  async function confirmDeleteSlot() {
    const token = getAccessToken();
    if (!token || !deleteTarget) return;

    setBusy(true);
    setError("");
    try {
      await deleteTutorAvailabilitySlot(token, deleteTarget.id);
      await loadSchedule(token);
      setDeleteTarget(null);
      setSelectedEvent(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể xóa lịch dạy.");
    } finally {
      setBusy(false);
    }
  }

  async function createAvailability() {
    const token = getAccessToken();
    if (!token) return;
    const startsAt = new Date(`${slotDate}T${slotStart}:00`);
    const endsAt = new Date(`${slotDate}T${slotEnd}:00`);

    setAvailabilityBusy(true);
    setError("");
    try {
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error("Ngày giờ lịch dạy không hợp lệ.");
      if (startsAt <= new Date()) throw new Error("Vui lòng chọn khung giờ trong tương lai.");
      if (endsAt <= startsAt) throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");

      const occurrences = buildAvailabilityOccurrences(startsAt, endsAt, slotRepeat, slotOccurrences);
      const overlapping = findOverlappingAvailabilitySlot(occurrences, slots);

      if (overlapping) {
        throw new Error(`Khung giờ ${formatCandidateRange(overlapping)} bị trùng với lịch rảnh đã có. Vui lòng chọn thời gian khác.`);
      }

      await createTutorAvailabilitySlot(token, {
        endsAt: endsAt.toISOString(),
        occurrences: slotRepeat === "NONE" ? 1 : slotOccurrences,
        repeat: slotRepeat,
        startsAt: startsAt.toISOString(),
      });
      setAnchorDate(startsAt);
      await loadSchedule(token, viewRange(startsAt, view));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể thêm lịch trống.");
    } finally {
      setAvailabilityBusy(false);
    }
  }

  return (
    <RoleDashboardShell active="bookings" role="tutor">
      <PageHeader
        actions={
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-container-high)] px-4 py-2.5 text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--primary-fixed)] focus-visible:shadow-[var(--focus-ring)]" href="/tutor/booking-requests">
            Yêu cầu đặt lịch
            <Icon name="arrow_forward" />
          </Link>
        }
        description="Mở lịch trống và xem lịch dạy theo tháng hoặc tuần, phân biệt khung giờ trống, lịch đã đặt và các buổi cần xử lý."
        title="Lịch dạy của tôi"
      />

      {error ? (
        <div className="rounded-[var(--radius-md)] bg-[var(--error-container)] p-3 text-sm font-bold text-[var(--error)]" role="alert">
          {error}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <AvailabilityForm
            busy={availabilityBusy}
            date={slotDate}
            end={slotEnd}
            occurrences={slotOccurrences}
            onCreate={createAvailability}
            onDateChange={setSlotDate}
            onEndChange={setSlotEnd}
            onOccurrencesChange={setSlotOccurrences}
            onRepeatChange={setSlotRepeat}
            onStartChange={setSlotStart}
            repeat={slotRepeat}
            start={slotStart}
          />
        </aside>

        <Card className="min-w-0 overflow-hidden p-0">
          <CalendarToolbar anchorDate={anchorDate} busy={busy || loading || availabilityBusy} onMove={moveDate} onToday={goToday} onViewChange={setView} title={calendarTitle(anchorDate, view)} view={view} />
          {loading ? (
            <CalendarSkeleton />
          ) : events.length ? (
            <>
              <div className="hidden md:block">
                {view === "month" ? (
                  <MonthCalendar anchorDate={anchorDate} days={calendarDays} events={events} onSelect={setSelectedEvent} />
                ) : (
                  <WeekCalendar days={calendarDays.slice(0, 7)} events={events} onSelect={setSelectedEvent} />
                )}
              </div>
              <AgendaList days={calendarDays} events={events} onSelect={setSelectedEvent} />
            </>
          ) : (
            <FeedbackState
              className="m-4 min-h-[420px]"
              description="Chưa có khung giờ hoặc buổi dạy trong khoảng thời gian này. Dùng form bên cạnh để mở lịch trống cho học viên."
              icon="calendar_month"
              title="Lịch đang trống"
            />
          )}
        </Card>
      </div>

      <EventDetailDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} onDeleteSlot={(slot) => setDeleteTarget(slot)} />
      <ConfirmDialog
        confirmLabel={deleteTarget?.isBooked ? "Hủy khung giờ" : "Xóa khung giờ"}
        description={deleteTarget?.isBooked ? "Khung giờ này đã có học viên đặt. Thao tác sẽ dùng đúng logic hủy/xóa lịch hiện tại của hệ thống." : "Khung giờ trống này sẽ không còn xuất hiện để học viên đặt lịch."}
        isBusy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteSlot}
        open={Boolean(deleteTarget)}
        title={deleteTarget?.isBooked ? "Hủy khung giờ đã có booking?" : "Xóa khung giờ trống?"}
      />
    </RoleDashboardShell>
  );
}

function AvailabilityForm({
  busy,
  date,
  end,
  occurrences,
  onCreate,
  onDateChange,
  onEndChange,
  onOccurrencesChange,
  onRepeatChange,
  onStartChange,
  repeat,
  start,
}: {
  busy: boolean;
  date: string;
  end: string;
  occurrences: number;
  onCreate: () => void;
  onDateChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onOccurrencesChange: (value: number) => void;
  onRepeatChange: (value: AvailabilityRepeat) => void;
  onStartChange: (value: string) => void;
  repeat: AvailabilityRepeat;
  start: string;
}) {
  return (
    <Card className="sticky top-24" tone="subtle">
      <CardHeader>
        <CardTitle>Thêm khung giờ trống</CardTitle>
        <CardDescription>Tạo lịch một lần hoặc lặp theo tuần/tháng. Lịch mới sẽ xuất hiện ngay trên calendar.</CardDescription>
      </CardHeader>
      <div className="space-y-4">
        <Field label="Ngày dạy">
          <input className={fieldControlClasses} min={toLocalDateInputValue(new Date())} onChange={(event) => onDateChange(event.target.value)} type="date" value={date} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bắt đầu">
            <input className={fieldControlClasses} onChange={(event) => onStartChange(event.target.value)} type="time" value={start} />
          </Field>
          <Field label="Kết thúc">
            <input className={fieldControlClasses} onChange={(event) => onEndChange(event.target.value)} type="time" value={end} />
          </Field>
        </div>
        <Field label="Lặp lại">
          <select className={fieldControlClasses} onChange={(event) => onRepeatChange(event.target.value as AvailabilityRepeat)} value={repeat}>
            <option value="NONE">Không lặp</option>
            <option value="WEEKLY">Hàng tuần</option>
            <option value="MONTHLY">Hàng tháng</option>
          </select>
        </Field>
        <Field label="Số lần">
          <input className={fieldControlClasses} disabled={repeat === "NONE"} max={24} min={1} onChange={(event) => onOccurrencesChange(Number(event.target.value) || 1)} type="number" value={repeat === "NONE" ? 1 : occurrences} />
        </Field>
        <Button className="w-full" disabled={busy} isLoading={busy} leftIcon={<Icon name="add" />} onClick={onCreate}>
          {repeat === "NONE" ? "Thêm lịch trống" : "Tạo lịch cố định"}
        </Button>
      </div>
    </Card>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block text-xs font-black uppercase tracking-wide text-[var(--on-surface-variant)]">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function CalendarToolbar({
  anchorDate,
  busy,
  onMove,
  onToday,
  onViewChange,
  title,
  view,
}: {
  anchorDate: Date;
  busy: boolean;
  onMove: (direction: -1 | 1) => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  title: string;
  view: CalendarView;
}) {
  return (
    <div className="border-b border-[var(--outline-variant)] bg-white px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex w-fit rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-1 text-sm font-black text-[var(--on-surface-variant)]">
            <button className={`min-h-10 rounded-[var(--radius-sm)] px-4 ${view === "month" ? "bg-white text-[var(--primary)] shadow-[var(--shadow-panel)]" : ""}`} onClick={() => onViewChange("month")} type="button">
              Tháng
            </button>
            <button className={`min-h-10 rounded-[var(--radius-sm)] px-4 ${view === "week" ? "bg-white text-[var(--primary)] shadow-[var(--shadow-panel)]" : ""}`} onClick={() => onViewChange("week")} type="button">
              Tuần
            </button>
          </div>
          <h2 className="tc-text-safe flex items-center gap-2 text-xl font-black text-[var(--primary)] sm:text-2xl">
            {title}
            <Icon className="text-[22px]" name="calendar_month" />
          </h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{anchorDate.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={onToday} variant="secondary">
            Hôm nay
          </Button>
          <Button aria-label="Lùi lịch" disabled={busy} leftIcon={<Icon name="chevron_left" />} onClick={() => onMove(-1)} size="icon" variant="outline" />
          <Button aria-label="Tiến lịch" disabled={busy} leftIcon={<Icon name="chevron_right" />} onClick={() => onMove(1)} size="icon" variant="outline" />
        </div>
      </div>
    </div>
  );
}
function MonthCalendar({ anchorDate, days, events, onSelect }: { anchorDate: Date; days: Date[]; events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[940px]">
        <div className="grid grid-cols-7 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
          {weekdays.map((day) => (
            <div className="px-3 py-3 text-xs font-black text-[var(--on-surface-variant)]" key={day}>
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = events.filter((event) => isSameDay(event.startsAt, day));
            const muted = day.getMonth() !== anchorDate.getMonth();
            const today = isSameDay(day, new Date());
            return (
              <div className={`min-h-[138px] border-b border-r border-[var(--outline-variant)] p-2 ${today ? "bg-[var(--primary-fixed)]/45" : muted ? "bg-[var(--surface-container-low)]/45" : "bg-white"}`} key={dateKey(day)}>
                <div className="mb-2 flex justify-end">
                  <span className={`text-xs font-black tabular-nums ${today ? "text-[var(--primary)]" : muted ? "text-[var(--outline)]" : "text-[var(--on-surface-variant)]"}`}>{day.getDate()}</span>
                </div>
                <div className="space-y-1.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <EventChip event={event} key={event.id} onSelect={onSelect} compact />
                  ))}
                  {dayEvents.length > 3 ? <p className="text-xs font-bold text-[var(--on-surface-variant)]">+{dayEvents.length - 3} lịch khác</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekCalendar({ days, events, onSelect }: { days: Date[]; events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) {
  const hours = Array.from({ length: hourEnd - hourStart + 1 }, (_, index) => hourStart + index);
  const timelineHeight = (hourEnd - hourStart + 1) * hourHeight;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1040px]">
        <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
          <div />
          {days.map((day, index) => {
            const today = isSameDay(day, new Date());
            return (
              <div className={`px-3 py-3 text-sm font-black ${today ? "bg-[var(--primary-fixed)]/55 text-[var(--primary)]" : "text-[var(--on-surface-variant)]"}`} key={dateKey(day)}>
                {weekdays[index]} <span className="tabular-nums">{day.getDate()}</span>
              </div>
            );
          })}
        </div>
        <div className="relative grid grid-cols-[72px_repeat(7,minmax(0,1fr))]" style={{ minHeight: timelineHeight }}>
          <div className="border-r border-[var(--outline-variant)] bg-white">
            {hours.map((hour) => (
              <div className="border-b border-[var(--outline-variant)]/55 pr-2 pt-1 text-right text-xs font-bold tabular-nums text-[var(--on-surface-variant)]" key={hour} style={{ height: hourHeight }}>
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((day) => {
            const dayEvents = events.filter((event) => isSameDay(event.startsAt, day));
            const today = isSameDay(day, new Date());
            return (
              <div className={`relative border-r border-[var(--outline-variant)] ${today ? "bg-[var(--primary-fixed)]/35" : "bg-white"}`} key={dateKey(day)}>
                {hours.map((hour) => (
                  <div className="border-b border-[var(--outline-variant)]/45" key={hour} style={{ height: hourHeight }} />
                ))}
                {dayEvents.map((event) => (
                  <WeekEventBlock event={event} key={event.id} onSelect={onSelect} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekEventBlock({ event, onSelect }: { event: CalendarEvent; onSelect: (event: CalendarEvent) => void }) {
  const startHour = event.startsAt.getHours() + event.startsAt.getMinutes() / 60;
  const endHour = event.endsAt.getHours() + event.endsAt.getMinutes() / 60;
  const displayStartHour = Math.max(hourStart, startHour);
  const displayEndHour = Math.min(hourEnd + 1, Math.max(displayStartHour + 0.25, endHour));
  const top = Math.max(0, (displayStartHour - hourStart) * hourHeight);
  const height = Math.max(44, (displayEndHour - displayStartHour) * hourHeight);

  return (
    <button
      className={`absolute left-2 right-2 z-10 overflow-hidden rounded-[var(--radius-md)] border p-2 text-left shadow-[var(--shadow-panel)] transition hover:brightness-95 focus-visible:shadow-[var(--focus-ring)] ${eventClasses(event)}`}
      onClick={() => onSelect(event)}
      style={{ height, top }}
      type="button"
    >
      <span className="block text-[11px] font-black tabular-nums">{formatTimeRange(event.startsAt, event.endsAt)}</span>
      <span className="tc-text-safe mt-1 block text-xs font-black">{event.title}</span>
      <span className="tc-text-safe mt-1 block text-[11px] font-semibold opacity-85">{event.subtitle}</span>
    </button>
  );
}

function AgendaList({ days, events, onSelect }: { days: Date[]; events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) {
  const daysWithEvents = days
    .map((day) => ({ day, events: events.filter((event) => isSameDay(event.startsAt, day)) }))
    .filter((group) => group.events.length);

  return (
    <div className="space-y-4 p-4 md:hidden">
      {daysWithEvents.map((group) => (
        <section key={dateKey(group.day)}>
          <h3 className="mb-2 text-sm font-black text-[var(--primary)]">{formatDate(group.day)}</h3>
          <div className="space-y-2">
            {group.events.map((event) => (
              <EventChip event={event} key={event.id} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventChip({ compact = false, event, onSelect }: { compact?: boolean; event: CalendarEvent; onSelect: (event: CalendarEvent) => void }) {
  return (
    <button className={`w-full rounded-[var(--radius-md)] border px-2 py-1.5 text-left transition hover:brightness-95 focus-visible:shadow-[var(--focus-ring)] ${eventClasses(event)}`} onClick={() => onSelect(event)} type="button">
      <span className="block text-[11px] font-black tabular-nums">{formatTimeRange(event.startsAt, event.endsAt)}</span>
      <span className={`tc-text-safe block font-black ${compact ? "text-xs" : "text-sm"}`}>{event.title}</span>
      {!compact ? <span className="tc-text-safe mt-0.5 block text-xs font-semibold opacity-85">{event.subtitle}</span> : null}
    </button>
  );
}

function eventClasses(event: CalendarEvent) {
  if (event.type === "slot" && !event.slot?.isBooked) return "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]";
  if (event.type === "slot") return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
  if (event.booking?.status === "PENDING") return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
  if (event.booking?.status === "CANCELLED") return "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]";
  return "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]";
}

function EventDetailDialog({ event, onClose, onDeleteSlot }: { event: CalendarEvent | null; onClose: () => void; onDeleteSlot: (slot: TutorAvailabilitySlot) => void }) {
  if (!event) return null;
  const booking = event.booking;
  const slot = event.slot;

  return (
    <Dialog description={`${formatDate(event.startsAt)} · ${formatTimeRange(event.startsAt, event.endsAt)}`} onClose={onClose} open={Boolean(event)} title={event.title}>
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={event.tone}>{booking ? bookingStatus(booking, event.payment) : slot?.isBooked ? "Đã có học viên đặt" : "Lịch trống"}</StatusBadge>
          {booking ? <StatusBadge tone={event.payment?.status === "PAID" ? "success" : "neutral"}>{paymentStatus(event.payment)}</StatusBadge> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem icon="event" label="Ngày" value={formatDate(event.startsAt)} />
          <DetailItem icon="schedule" label="Thời gian" value={formatTimeRange(event.startsAt, event.endsAt)} />
          {booking ? <DetailItem icon="person" label="Học viên" value={booking.student.fullName} /> : null}
          {booking ? <DetailItem icon="school" label="Hình thức" value={modeLabel(booking.teachingMode)} /> : null}
        </div>
        {booking?.studentNote ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[var(--on-surface-variant)]">Ghi chú học viên</p>
            <p className="tc-text-safe mt-2 text-sm leading-6 text-[var(--on-surface)]">{booking.studentNote}</p>
          </div>
        ) : null}
      </div>
      <footer className="flex flex-col gap-3 bg-[var(--surface-container-low)] p-4 sm:flex-row sm:justify-end">
        {slot ? (
          <Button onClick={() => onDeleteSlot(slot)} variant="danger">
            {slot.isBooked ? "Hủy khung giờ" : "Xóa khung giờ"}
          </Button>
        ) : null}
        {booking ? (
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-[var(--on-primary)] shadow-[var(--shadow-panel)] transition hover:bg-[var(--primary-container)] focus-visible:shadow-[var(--focus-ring)]" href={`/bookings/${booking.id}`}>
            Chi tiết lịch học
            <Icon name="arrow_forward" />
          </Link>
        ) : null}
      </footer>
    </Dialog>
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

function CalendarSkeleton() {
  return (
    <div className="p-4" role="status" aria-label="Đang tải lịch dạy">
      <div className="grid gap-2 md:grid-cols-7">
        {Array.from({ length: 21 }).map((_, index) => (
          <Skeleton className="h-28" key={index} />
        ))}
      </div>
    </div>
  );
}
