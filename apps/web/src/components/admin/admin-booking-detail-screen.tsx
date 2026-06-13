"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminAlert, AdminPage, AdminPageHeader, BookingStatusBadge, PaymentStatusBadge, PayoutStatusBadge } from "@/components/admin/admin-ui";
import { Avatar, Card, CardDescription, CardHeader, CardTitle, FeedbackState, Icon, Skeleton } from "@/components/ui";
import { AdminBooking, getAdminBookings } from "@/lib/admin-api";
import { getAccessToken } from "@/lib/auth-storage";

export function AdminBookingDetailScreen({ bookingId }: { bookingId: string }) {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.resolve()
      .then(async () => {
        const token = getAccessToken();
        if (!token) throw new Error("Bạn cần đăng nhập bằng tài khoản admin.");
        return getAdminBookings(token);
      })
      .then((items) => {
        if (!cancelled) setBookings(items);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Không thể tải booking.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const booking = useMemo(() => bookings.find((item) => item.id === bookingId) || null, [bookingId, bookings]);

  return (
    <AdminPage className="max-w-none">
      <AdminPageHeader
        actions={
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--primary)] px-4 py-2.5 text-sm font-bold text-[var(--primary)] hover:bg-[var(--surface-container-low)]" href={`/admin/bookings?bookingId=${bookingId}`}>
            <Icon name="arrow_back" />
            Quay lại danh sách
          </Link>
        }
        description="Xem đầy đủ thông tin học viên, gia sư, lịch học và thanh toán liên quan đến booking."
        title="Chi tiết booking"
      />

      {error ? <AdminAlert>{error}</AdminAlert> : null}

      {loading ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-48 lg:col-span-2" />
          <Skeleton className="h-48" />
          <Skeleton className="h-56 lg:col-span-3" />
        </section>
      ) : !booking ? (
        <FeedbackState
          action={
            <Link className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white" href="/admin/bookings">
              Về danh sách booking
            </Link>
          }
          description="Booking này không có trong dữ liệu admin hiện tại hoặc đã bị xóa."
          title="Không tìm thấy booking"
          tone="not-found"
        />
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,.8fr)]">
            <Card>
              <CardHeader
                action={
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <BookingStatusBadge status={booking.status} />
                    {booking.payment ? <PaymentStatusBadge status={booking.payment.status} /> : null}
                  </div>
                }
              >
                <CardTitle>{subject(booking)}</CardTitle>
                <CardDescription>Mã booking: {booking.id}</CardDescription>
              </CardHeader>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <InfoTile icon="calendar_month" label="Ngày học" value={formatDate(booking.startsAt)} />
                <InfoTile icon="schedule" label="Thời gian" value={timeRange(booking)} />
                <InfoTile icon="computer" label="Hình thức" value={modeLabel(booking.teachingMode)} />
                <InfoTile icon="history" label="Tạo lúc" value={formatDateTime(booking.createdAt)} />
              </div>
            </Card>

            <Card>
              <CardTitle>Thanh toán</CardTitle>
              {booking.payment ? (
                <div className="mt-5 space-y-3">
                  <InfoRow label="Mã giao dịch" value={booking.payment.id} />
                  <InfoRow label="Số tiền" value={money(booking.payment.amount)} />
                  <InfoRow label="Provider" value={booking.payment.provider} />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-[var(--on-surface-variant)]">Payout</span>
                    <PayoutStatusBadge status={booking.payment.payoutStatus} />
                  </div>
                  <InfoRow label="Thanh toán lúc" value={booking.payment.paidAt ? formatDateTime(booking.payment.paidAt) : "Chưa thanh toán"} />
                  <InfoRow label="Hoàn tiền lúc" value={booking.payment.refundedAt ? formatDateTime(booking.payment.refundedAt) : "Chưa hoàn tiền"} />
                </div>
              ) : (
                <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-4 text-sm font-semibold text-[var(--on-surface-variant)]">Booking này chưa có giao dịch thanh toán.</p>
              )}
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <UserCard email={booking.student.email} icon="person" name={booking.student.fullName} role="Học viên" />
            <UserCard email={booking.tutor.email} icon="school" name={booking.tutor.fullName} role="Gia sư" subtitle={booking.tutor.headline || subject(booking)} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardTitle>Ghi chú học viên</CardTitle>
              <p className="tc-text-safe mt-4 min-h-24 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-4 text-sm leading-6">
                {booking.studentNote || "Học viên chưa để lại ghi chú."}
              </p>
            </Card>
            <Card>
              <CardTitle>Lý do hủy</CardTitle>
              <p className="tc-text-safe mt-4 min-h-24 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-4 text-sm leading-6">
                {booking.cancellationReason || "Booking chưa có lý do hủy."}
              </p>
            </Card>
          </section>
        </>
      )}
    </AdminPage>
  );
}

function InfoTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-4">
      <Icon className="mb-3 text-[22px] text-[var(--primary)]" name={icon} />
      <p className="text-xs font-black uppercase text-[var(--on-surface-variant)]">{label}</p>
      <p className="tc-text-safe mt-1 text-sm font-black text-[var(--on-surface)]">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--outline-variant)] pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm font-bold text-[var(--on-surface-variant)]">{label}</span>
      <span className="tc-text-safe text-right text-sm font-black text-[var(--on-surface)]">{value}</span>
    </div>
  );
}

function UserCard({ email, icon, name, role, subtitle }: { email: string; icon: string; name: string; role: string; subtitle?: string }) {
  return (
    <Card>
      <div className="flex min-w-0 items-center gap-4">
        <Avatar name={name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-black uppercase text-[var(--on-surface-variant)]">
            <Icon className="text-[18px]" name={icon} />
            {role}
          </p>
          <h2 className="tc-text-safe mt-1 text-lg font-black">{name}</h2>
          <p className="truncate text-sm font-semibold text-[var(--on-surface-variant)]">{email}</p>
          {subtitle ? <p className="tc-text-safe mt-2 text-sm text-[var(--on-surface-variant)]">{subtitle}</p> : null}
        </div>
      </div>
    </Card>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", weekday: "long" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "2-digit", year: "numeric" });
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
