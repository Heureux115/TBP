"use client";

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
  AdminTableLoading,
  AdminToolbar,
  AdminUserCell,
  UserStatusBadge,
} from "@/components/admin/admin-ui";
import { Avatar, DataTable, DataTableBody, DataTableHead } from "@/components/ui";
import { AdminUser, getAdminUsers } from "@/lib/admin-api";
import { getAccessToken } from "@/lib/auth-storage";
import { createSearchMatcher } from "@/lib/search-text";

function date(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminStudentsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    getAdminUsers(token, "STUDENT")
      .then(setUsers)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Không thể tải học viên."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const matchesQuery = createSearchMatcher(query);
    return users.filter((user) => matchesQuery(`${user.fullName} ${user.email} ${user.phone || ""}`));
  }, [query, users]);

  const activeCount = users.filter((user) => user.status === "ACTIVE").length;
  const verifiedCount = users.filter((user) => user.emailVerifiedAt).length;
  const hasFilters = Boolean(query.trim());

  function clearFilters() {
    setQuery("");
  }

  return (
    <AdminLayout active="students" searchPlaceholder="Tìm học viên...">
      <AdminPage>
        <AdminPageHeader
          description="Xem tài khoản học viên, trạng thái email, số booking và lịch sử thanh toán để hỗ trợ vận hành marketplace."
          title="Quản lý học viên"
        />

        {error ? <AdminAlert>{error}</AdminAlert> : null}

        <AdminMetricGrid>
          <AdminMetric icon="group" label="Tổng học viên" note="Tài khoản student" tone="info" value={users.length} />
          <AdminMetric icon="verified_user" label="Đang hoạt động" note="Có thể đặt lịch" tone="success" value={activeCount} />
          <AdminMetric icon="mark_email_read" label="Đã xác minh email" note="Tin cậy hơn" tone="warning" value={verifiedCount} />
        </AdminMetricGrid>

        <AdminToolbar resultLabel={`${filtered.length}/${users.length} học viên đang hiển thị`}>
          <AdminSearchField onChange={setQuery} placeholder="Tên, email, số điện thoại..." value={query} />
          <div className="flex items-end">
            <AdminClearFiltersButton disabled={!hasFilters} onClick={clearFilters} />
          </div>
        </AdminToolbar>

        <DataTable tableClassName="min-w-[860px]">
          <DataTableHead>
            <tr>
              <th className="px-5 py-4" scope="col">Học viên</th>
              <th className="px-5 py-4" scope="col">Điện thoại</th>
              <th className="px-5 py-4" scope="col">Trạng thái</th>
              <th className="px-5 py-4" scope="col">Booking</th>
              <th className="px-5 py-4" scope="col">Thanh toán</th>
              <th className="px-5 py-4" scope="col">Ngày tạo</th>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <AdminTableLoading colSpan={6} />
            ) : filtered.length ? (
              filtered.map((user) => (
                <tr className="transition hover:bg-[var(--surface-container-low)]" key={user.id}>
                  <td className="px-5 py-4">
                    <AdminUserCell avatar={<Avatar name={user.fullName} />} email={user.email} name={user.fullName} />
                  </td>
                  <td className="px-5 py-4 text-sm font-medium">{user.phone || "-"}</td>
                  <td className="px-5 py-4">
                    <UserStatusBadge status={user.status} verified={Boolean(user.emailVerifiedAt)} />
                  </td>
                  <td className="px-5 py-4 text-sm font-black tabular-nums">{user.bookingCount}</td>
                  <td className="px-5 py-4 text-sm font-black tabular-nums">{user.paymentCount}</td>
                  <td className="px-5 py-4 text-sm font-medium">{date(user.createdAt)}</td>
                </tr>
              ))
            ) : (
              <AdminEmptyState
                colSpan={6}
                description={hasFilters ? "Không có học viên nào khớp với từ khóa hiện tại." : "Chưa có tài khoản học viên nào."}
                onAction={hasFilters ? clearFilters : undefined}
                title={hasFilters ? "Không tìm thấy học viên" : "Chưa có học viên"}
              />
            )}
          </DataTableBody>
        </DataTable>
      </AdminPage>
    </AdminLayout>
  );
}
