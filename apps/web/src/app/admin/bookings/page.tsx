"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout, Avatar, Icon } from "@/components/admin/admin-layout";
import { AdminBooking, AdminBookingStatus, getAdminBookings } from "@/lib/admin-api";
import { getAccessToken } from "@/lib/auth-storage";

type StatusFilter = "ALL" | AdminBookingStatus;

function date(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function timeRange(booking: AdminBooking) {
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  return `${start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

function money(value: string | null | undefined) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
}

function subject(booking: AdminBooking) {
  return booking.tutor.subjects[0]?.subject.name || booking.tutor.headline?.split("-")[0]?.trim() || "Buổi học";
}

function modeLabel(mode: AdminBooking["teachingMode"]) {
  return mode === "OFFLINE" ? "Offline" : mode === "ONLINE" ? "Online" : "Online/Offline";
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const highlightedBookingId = new URLSearchParams(window.location.search).get("bookingId");
    if (highlightedBookingId) queueMicrotask(() => setQuery(highlightedBookingId));
    getAdminBookings(token)
      .then(setBookings)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Không thể tải booking."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesStatus = status === "ALL" || booking.status === status;
      const haystack = `${booking.id} ${booking.student.fullName} ${booking.student.email} ${booking.tutor.fullName} ${subject(booking)}`.toLowerCase();
      return matchesStatus && (!keyword || haystack.includes(keyword));
    });
  }, [bookings, query, status]);

  const paidRevenue = bookings.reduce((sum, booking) => sum + (booking.payment?.status === "PAID" ? Number(booking.payment.amount) : 0), 0);
  const cancelled = bookings.filter((booking) => booking.status === "CANCELLED").length;
  const today = new Date().toDateString();
  const todayCount = bookings.filter((booking) => new Date(booking.startsAt).toDateString() === today).length;

  return (
    <AdminLayout active="bookings" searchPlaceholder="Tìm booking, học viên hoặc gia sư...">
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 py-8 md:px-10">
        <header>
          <h1 className="text-3xl font-black text-[var(--primary)]">Quản lý booking</h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">Theo dõi trạng thái lịch học, thanh toán và các booking bị hủy.</p>
        </header>

        {error ? <p className="rounded-lg bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--error)]">{error}</p> : null}

        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Metric icon="event_available" label="Booking hom nay" value={String(todayCount)} />
          <Metric icon="cancel" label="Da huy" value={String(cancelled)} tone="error" />
          <Metric icon="payments" label="Tiền học đã thu" value={money(String(paidRevenue))} tone="secondary" />
        </section>

        <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <label className="block md:w-80">
              <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">Tìm kiếm</span>
              <input className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" onChange={(event) => setQuery(event.target.value)} placeholder="Mã booking, học viên, gia sư..." value={query} />
            </label>
            <label className="block md:w-56">
              <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">Trạng thái</span>
              <select className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" onChange={(event) => setStatus(event.target.value as StatusFilter)} value={status}>
                <option value="ALL">Tat ca</option>
                <option value="PENDING">Cho gia su xac nhan</option>
                <option value="CONFIRMED">Da xac nhan</option>
                <option value="COMPLETED">Hoàn thành</option>
                <option value="CANCELLED">Da huy</option>
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-[var(--surface-container-low)] text-xs uppercase text-[var(--on-surface-variant)]">
                <tr>
                  <th className="px-5 py-4">Booking</th>
                  <th className="px-5 py-4">Hoc vien</th>
                  <th className="px-5 py-4">Gia sư</th>
                  <th className="px-5 py-4">Thoi gian</th>
                  <th className="px-5 py-4">Thanh toán</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]/60">
                {loading ? (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={7}>Đang tải booking...</td></tr>
                ) : filtered.length ? filtered.map((booking) => (
                  <tr className="hover:bg-[var(--surface-container-low)]" key={booking.id}>
                    <td className="px-5 py-4">
                      <p className="font-black text-[var(--primary)]">#{booking.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-[var(--on-surface-variant)]">{subject(booking)} · {modeLabel(booking.teachingMode)}</p>
                    </td>
                    <td className="px-5 py-4"><User name={booking.student.fullName} email={booking.student.email} /></td>
                    <td className="px-5 py-4"><User name={booking.tutor.fullName} email={booking.tutor.email} /></td>
                    <td className="px-5 py-4"><p className="text-sm font-bold">{date(booking.startsAt)}</p><p className="text-xs text-[var(--on-surface-variant)]">{timeRange(booking)}</p></td>
                    <td className="px-5 py-4"><PaymentText booking={booking} /></td>
                    <td className="px-5 py-4"><BookingBadge status={booking.status} /></td>
                    <td className="px-5 py-4 text-right"><Link className="inline-flex whitespace-nowrap rounded-lg border border-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary)]" href={`/admin/bookings?bookingId=${booking.id}`}>Xem trong admin</Link></td>
                  </tr>
                )) : (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={7}>Không có booking phù hợp.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AdminLayout>
  );
}

function Metric({ icon, label, tone = "primary", value }: { icon: string; label: string; tone?: "primary" | "secondary" | "error"; value: string }) {
  const toneClass = tone === "secondary" ? "text-[var(--secondary)]" : tone === "error" ? "text-[var(--error)]" : "text-[var(--primary)]";
  return <article className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm"><Icon className={toneClass} name={icon} /><p className="mt-2 text-sm font-semibold text-[var(--on-surface-variant)]">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></article>;
}

function User({ email, name }: { email: string; name: string }) {
  return <div className="flex items-center gap-3"><Avatar name={name} /><div><p className="text-sm font-bold">{name}</p><p className="text-xs text-[var(--on-surface-variant)]">{email}</p></div></div>;
}

function BookingBadge({ status }: { status: AdminBookingStatus }) {
  const label = status === "PENDING" ? "Chờ gia sư" : status === "CONFIRMED" ? "Đã xác nhận" : status === "COMPLETED" ? "Hoàn thành" : "Đã hủy";
  const color = status === "CANCELLED" ? "text-[var(--error)] bg-[var(--error-container)]" : status === "COMPLETED" ? "text-[var(--tertiary)] bg-[var(--tertiary-fixed)]/30" : "text-[var(--primary)] bg-[var(--primary-fixed)]/40";
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold leading-none ${color}`}>{label}</span>;
}

function PaymentText({ booking }: { booking: AdminBooking }) {
  if (!booking.payment) return <span className="text-sm text-[var(--on-surface-variant)]">Chưa có</span>;
  return <div><p className="text-sm font-black">{money(booking.payment.amount)}</p><p className="text-xs text-[var(--on-surface-variant)]">{booking.payment.status}</p></div>;
}
