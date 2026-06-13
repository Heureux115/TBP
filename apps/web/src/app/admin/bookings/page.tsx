"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  AdminAlert,
  AdminClearFiltersButton,
  AdminEmptyState,
  AdminMetric,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminSearchField,
  AdminSelectField,
  AdminTableLoading,
  AdminToolbar,
  AdminUserCell,
  BookingStatusBadge,
  PaymentStatusBadge,
} from "@/components/admin/admin-ui";
import { Avatar, DataTable, DataTableBody, DataTableHead } from "@/components/ui";
import { AdminBooking, AdminBookingStatus, getAdminBookings } from "@/lib/admin-api";
import { getAccessToken } from "@/lib/auth-storage";
import { createSearchMatcher } from "@/lib/search-text";

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
    const matchesQuery = createSearchMatcher(query);
    return bookings.filter((booking) => {
      const matchesStatus = status === "ALL" || booking.status === status;
      const haystack = `${booking.id} ${booking.student.fullName} ${booking.student.email} ${booking.tutor.fullName} ${subject(booking)}`;
      return matchesStatus && matchesQuery(haystack);
    });
  }, [bookings, query, status]);

  const paidRevenue = bookings.reduce((sum, booking) => sum + (booking.payment?.status === "PAID" ? Number(booking.payment.amount) : 0), 0);
  const cancelled = bookings.filter((booking) => booking.status === "CANCELLED").length;
  const today = new Date().toDateString();
  const todayCount = bookings.filter((booking) => new Date(booking.startsAt).toDateString() === today).length;
  const hasFilters = Boolean(query.trim()) || status !== "ALL";

  function clearFilters() {
    setQuery("");
    setStatus("ALL");
  }

  return (
    <AdminLayout active="bookings" searchPlaceholder="Tìm booking, học viên hoặc gia sư...">
      <AdminPage>
        <AdminPageHeader
          description="Theo dõi lịch học, trạng thái xác nhận, thanh toán và các booking bị hủy để phát hiện rủi ro vận hành."
          title="Quản lý booking"
        />

        {error ? <AdminAlert>{error}</AdminAlert> : null}

        <AdminMetricGrid>
          <AdminMetric icon="event_available" label="Booking hôm nay" note="Theo giờ học" tone="info" value={todayCount} />
          <AdminMetric icon="cancel" label="Đã hủy" note="Cần theo dõi lý do" tone="danger" value={cancelled} />
          <AdminMetric icon="payments" label="Tiền học đã thu" note="Payment paid" tone="warning" value={money(String(paidRevenue))} />
        </AdminMetricGrid>

        <AdminToolbar resultLabel={`${filtered.length}/${bookings.length} booking đang hiển thị`}>
          <AdminSearchField onChange={setQuery} placeholder="Mã booking, học viên, gia sư, môn học..." value={query} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <AdminSelectField<StatusFilter>
              label="Trạng thái"
              onChange={setStatus}
              options={[
                { label: "Tất cả", value: "ALL" },
                { label: "Chờ xác nhận", value: "PENDING" },
                { label: "Đã xác nhận", value: "CONFIRMED" },
                { label: "Hoàn thành", value: "COMPLETED" },
                { label: "Đã hủy", value: "CANCELLED" },
              ]}
              value={status}
            />
            <AdminClearFiltersButton disabled={!hasFilters} onClick={clearFilters} />
          </div>
        </AdminToolbar>

        <DataTable tableClassName="min-w-[1040px]">
          <DataTableHead>
            <tr>
              <th className="px-5 py-4" scope="col">Booking</th>
              <th className="px-5 py-4" scope="col">Học viên</th>
              <th className="px-5 py-4" scope="col">Gia sư</th>
              <th className="px-5 py-4" scope="col">Thời gian</th>
              <th className="px-5 py-4" scope="col">Thanh toán</th>
              <th className="px-5 py-4" scope="col">Trạng thái</th>
              <th className="px-5 py-4 text-right" scope="col">Thao tác</th>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <AdminTableLoading colSpan={7} />
            ) : filtered.length ? (
              filtered.map((booking) => (
                <tr className="transition hover:bg-[var(--surface-container-low)]" key={booking.id}>
                  <td className="px-5 py-4">
                    <p className="font-black text-[var(--primary)]">#{booking.id.slice(0, 8).toUpperCase()}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--on-surface-variant)]">{subject(booking)} · {modeLabel(booking.teachingMode)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <AdminUserCell avatar={<Avatar name={booking.student.fullName} />} email={booking.student.email} name={booking.student.fullName} />
                  </td>
                  <td className="px-5 py-4">
                    <AdminUserCell avatar={<Avatar name={booking.tutor.fullName} />} email={booking.tutor.email} name={booking.tutor.fullName} />
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-black">{date(booking.startsAt)}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--on-surface-variant)]">{timeRange(booking)}</p>
                  </td>
                  <td className="px-5 py-4">
                    {booking.payment ? (
                      <div className="space-y-1">
                        <p className="text-sm font-black tabular-nums">{money(booking.payment.amount)}</p>
                        <PaymentStatusBadge status={booking.payment.status} />
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-[var(--on-surface-variant)]">Chưa có</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <BookingStatusBadge status={booking.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary)] hover:bg-[var(--surface-container-low)]" href={`/admin/bookings/${booking.id}`}>
                      Xem trong admin
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <AdminEmptyState
                colSpan={7}
                description={hasFilters ? "Không có booking nào khớp với bộ lọc hiện tại." : "Chưa có booking nào trong hệ thống."}
                onAction={hasFilters ? clearFilters : undefined}
                title={hasFilters ? "Không tìm thấy booking" : "Chưa có booking"}
              />
            )}
          </DataTableBody>
        </DataTable>
      </AdminPage>
    </AdminLayout>
  );
}
