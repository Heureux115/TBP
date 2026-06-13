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
  TutorStatusBadge,
} from "@/components/admin/admin-ui";
import { Avatar, Button, DataTable, DataTableBody, DataTableHead, Icon } from "@/components/ui";
import { getAccessToken } from "@/lib/auth-storage";
import { createSearchMatcher } from "@/lib/search-text";
import { getAdminTutors, type AdminTutorListItem, type TutorVerificationStatus } from "@/lib/tutor-api";

type ScreenState = "list" | "loading" | "error" | "empty";
type StatusFilter = TutorVerificationStatus | "ALL";

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
}

export function AdminTutorsScreen({ initialState }: { initialState: ScreenState }) {
  const [rows, setRows] = useState<AdminTutorListItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(initialState === "loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token || initialState !== "list") return;

    queueMicrotask(() => setLoading(true));
    getAdminTutors(token, status === "ALL" ? undefined : status)
      .then(setRows)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Không thể tải hồ sơ gia sư."))
      .finally(() => setLoading(false));
  }, [initialState, status]);

  const filtered = useMemo(() => {
    const matchesQuery = createSearchMatcher(query);
    return rows.filter((row) => matchesQuery(`${row.fullName} ${row.email} ${row.city || ""} ${row.district || ""}`));
  }, [query, rows]);

  const pending = rows.filter((row) => row.status === "PENDING_REVIEW").length;
  const approved = rows.filter((row) => row.status === "APPROVED").length;
  const rejected = rows.filter((row) => row.status === "REJECTED").length;
  const hasFilters = Boolean(query.trim()) || status !== "ALL";

  function clearFilters() {
    setQuery("");
    setStatus("ALL");
  }

  return (
    <AdminLayout active="tutors" searchPlaceholder="Tìm hồ sơ gia sư...">
      <AdminPage>
        <AdminPageHeader
          actions={
            <Link href="/admin/dashboard">
              <Button leftIcon={<Icon name="dashboard" />} variant="outline">
                Dashboard
              </Button>
            </Link>
          }
          description="Kiểm tra hồ sơ, tài liệu xác minh và quyết định hồ sơ nào đủ tin cậy để xuất hiện trong marketplace."
          title="Duyệt hồ sơ gia sư"
        />

        {error ? <AdminAlert>{error}</AdminAlert> : null}

        <AdminMetricGrid>
          <AdminMetric icon="pending_actions" label="Chờ duyệt" note="Cần xử lý trước" tone="warning" value={pending} />
          <AdminMetric icon="verified_user" label="Đã duyệt" note="Đang công khai" tone="success" value={approved} />
          <AdminMetric icon="cancel" label="Từ chối" note="Cần lý do rõ" tone="danger" value={rejected} />
        </AdminMetricGrid>

        <AdminToolbar resultLabel={`${filtered.length}/${rows.length} hồ sơ đang hiển thị`}>
          <AdminSearchField onChange={setQuery} placeholder="Tên, email, quận/huyện, thành phố..." value={query} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <AdminSelectField<StatusFilter>
              label="Trạng thái"
              onChange={setStatus}
              options={[
                { label: "Tất cả", value: "ALL" },
                { label: "Chờ duyệt", value: "PENDING_REVIEW" },
                { label: "Đã duyệt", value: "APPROVED" },
                { label: "Từ chối", value: "REJECTED" },
                { label: "Bản nháp", value: "DRAFT" },
              ]}
              value={status}
            />
            <AdminClearFiltersButton disabled={!hasFilters} onClick={clearFilters} />
          </div>
        </AdminToolbar>

        <DataTable tableClassName="min-w-[920px]">
          <DataTableHead>
            <tr>
              <th className="px-5 py-4" scope="col">Gia sư</th>
              <th className="px-5 py-4" scope="col">Khu vực</th>
              <th className="px-5 py-4" scope="col">Môn</th>
              <th className="px-5 py-4" scope="col">Tài liệu</th>
              <th className="px-5 py-4" scope="col">Ngày gửi</th>
              <th className="px-5 py-4" scope="col">Trạng thái</th>
              <th className="px-5 py-4 text-right" scope="col">Thao tác</th>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <AdminTableLoading colSpan={7} />
            ) : filtered.length ? (
              filtered.map((row) => (
                <tr className="transition hover:bg-[var(--surface-container-low)]" key={row.id}>
                  <td className="px-5 py-4">
                    <AdminUserCell avatar={<Avatar name={row.fullName} src={row.avatarUrl} />} email={row.email} name={row.fullName} />
                  </td>
                  <td className="px-5 py-4 text-sm font-medium">{[row.district, row.city].filter(Boolean).join(", ") || "-"}</td>
                  <td className="px-5 py-4 text-sm font-black tabular-nums">{row.subjectCount}</td>
                  <td className="px-5 py-4 text-sm font-black tabular-nums">{row.documentCount}</td>
                  <td className="px-5 py-4 text-sm font-medium">{date(row.submittedAt)}</td>
                  <td className="px-5 py-4">
                    <TutorStatusBadge status={row.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary)] hover:bg-[var(--surface-container-low)]" href={`/admin/tutors/${row.id}`}>
                      Chi tiết
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <AdminEmptyState
                colSpan={7}
                description={hasFilters ? "Không có hồ sơ gia sư nào khớp với bộ lọc hiện tại." : "Chưa có hồ sơ gia sư nào trong hàng chờ admin."}
                onAction={hasFilters ? clearFilters : undefined}
                title={hasFilters ? "Không tìm thấy hồ sơ" : "Chưa có hồ sơ"}
              />
            )}
          </DataTableBody>
        </DataTable>
      </AdminPage>
    </AdminLayout>
  );
}
