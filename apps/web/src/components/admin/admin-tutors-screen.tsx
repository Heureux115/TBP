"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell, Icon } from "@/components/tutor/dashboard-shell";
import { adminTutorRows } from "@/components/tutor/mock-data";
import { getAccessToken } from "@/lib/auth-storage";
import { getAdminTutors, type AdminTutorListItem, type TutorVerificationStatus } from "@/lib/tutor-api";

type ScreenState = "list" | "loading" | "error" | "empty";

const statusLabels: Record<TutorVerificationStatus, string> = {
  DRAFT: "Nháp",
  PENDING_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
};

export function AdminTutorsScreen({ initialState }: { initialState: ScreenState }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TutorVerificationStatus | "ALL">("PENDING_REVIEW");
  const [serverRows, setServerRows] = useState<AdminTutorListItem[] | null>(null);

  useEffect(() => {
    const token = getAccessToken();

    if (!token || initialState !== "list") {
      return;
    }

    getAdminTutors(token, status === "ALL" ? undefined : status)
      .then(setServerRows)
      .catch(() => setServerRows(null));
  }, [initialState, status]);

  const rows = useMemo(() => {
    return (serverRows ?? adminTutorRows).filter((row) => {
      const matchesStatus = status === "ALL" || row.status === status;
      const searchable = `${row.fullName} ${row.email}`.toLowerCase();
      return matchesStatus && searchable.includes(query.toLowerCase());
    });
  }, [query, serverRows, status]);

  return (
    <DashboardShell active="approvals" mode="admin">
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[var(--outline-variant)] bg-white px-5 shadow-sm md:px-10">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Duyệt hồ sơ gia sư</h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Quản lý và xét duyệt các hồ sơ đăng ký mới.</p>
          </div>
          <button className="relative rounded-full p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]" type="button">
            <Icon name="notifications" />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--error)]" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-5 md:p-10">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-8">
            {initialState === "loading" ? <LoadingState /> : null}
            {initialState === "error" ? <ErrorState /> : null}
            {initialState === "empty" ? <EmptyState /> : null}
            {initialState === "list" ? (
              <>
                <Filters query={query} setQuery={setQuery} setStatus={setStatus} status={status} />
                <TutorsTable rows={rows} />
              </>
            ) : null}
          </div>
        </main>
      </div>
    </DashboardShell>
  );
}

function Filters({
  query,
  setQuery,
  setStatus,
  status,
}: {
  query: string;
  setQuery: (value: string) => void;
  setStatus: (value: TutorVerificationStatus | "ALL") => void;
  status: TutorVerificationStatus | "ALL";
}) {
  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-end">
        <label className="w-full md:w-1/3">
          <span className="mb-2 block text-xs font-semibold text-[var(--on-surface-variant)]">Tìm kiếm</span>
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--outline)]" />
            <input
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên gia sư hoặc email..."
              value={query}
            />
          </div>
        </label>
        <label className="w-full md:w-1/4">
          <span className="mb-2 block text-xs font-semibold text-[var(--on-surface-variant)]">Trạng thái</span>
          <select
            className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            onChange={(event) => setStatus(event.target.value as TutorVerificationStatus | "ALL")}
            value={status}
          >
            <option value="ALL">Tất cả</option>
            <option value="PENDING_REVIEW">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Bị từ chối</option>
            <option value="DRAFT">Nháp</option>
          </select>
        </label>
        <label className="w-full md:w-1/4">
          <span className="mb-2 block text-xs font-semibold text-[var(--on-surface-variant)]">Môn học</span>
          <select className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20">
            <option>Tất cả môn học</option>
            <option>Toán</option>
            <option>Vật lý</option>
            <option>Tiếng Anh</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[var(--primary-container)]" type="button">
            Lọc
          </button>
          <button
            className="rounded-lg border border-[var(--outline-variant)] px-4 py-2.5 text-sm font-bold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
            onClick={() => {
              setQuery("");
              setStatus("PENDING_REVIEW");
            }}
            type="button"
          >
            Đặt lại
          </button>
        </div>
      </div>
    </section>
  );
}

function TutorsTable({ rows }: { rows: AdminTutorListItem[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
              {["Tên gia sư / Email", "Khu vực", "Số môn", "Tài liệu", "Ngày gửi", "Trạng thái", "Thao tác"].map((head) => (
                <th className="px-6 py-4 text-xs font-bold uppercase text-[var(--on-surface-variant)]" key={head}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--outline-variant)]/50">
            {rows.map((row) => (
              <tr className="transition hover:bg-[var(--surface-container)]" key={row.id}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--outline-variant)] bg-[var(--tertiary-container)]/10 font-bold text-[var(--tertiary)]">
                      {row.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold">{row.fullName}</div>
                      <div className="text-sm text-[var(--on-surface-variant)]">{row.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">{[row.district, row.city].filter(Boolean).join(", ")}</td>
                <td className="px-6 py-4 text-center">
                  <span className="rounded-md bg-[var(--surface-container-high)] px-2 py-1 text-xs font-bold">{row.subjectCount}</span>
                </td>
                <td className="px-6 py-4 text-center text-sm font-semibold text-[var(--primary)]">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="description" className="text-[16px]" />
                    {row.documentCount}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[var(--on-surface-variant)]">{formatDate(row.submittedAt)}</td>
                <td className="px-6 py-4">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    className="rounded-md border border-[var(--primary)] px-4 py-2 text-xs font-bold text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white"
                    href={`/admin/tutors/${row.id}`}
                  >
                    Xem chi tiết
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col justify-between gap-3 border-t border-[var(--outline-variant)] p-4 text-sm sm:flex-row sm:items-center">
        <span className="text-[var(--on-surface-variant)]">Hiển thị 1-{rows.length} trên tổng số 24 hồ sơ</span>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-[var(--outline-variant)] p-2 text-[var(--outline)] opacity-50" disabled type="button">
            <Icon name="chevron_left" className="text-[20px]" />
          </button>
          {[1, 2, 3].map((page) => (
            <button
              className={["flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold", page === 1 ? "bg-[var(--primary)] text-white" : "border border-[var(--outline-variant)]"].join(" ")}
              key={page}
              type="button"
            >
              {page}
            </button>
          ))}
          <button className="rounded-md border border-[var(--outline-variant)] p-2 hover:bg-[var(--surface-container)]" type="button">
            <Icon name="chevron_right" className="text-[20px]" />
          </button>
        </div>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <>
      <div>
        <h2 className="text-3xl font-bold">Hồ sơ chờ duyệt</h2>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Đang tải danh sách gia sư mới nhất cần xem xét...</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-6" key={item}>
            <div className="skeleton-shimmer mb-4 h-10 w-10 rounded-full" />
            <div className="skeleton-shimmer mb-3 h-5 w-28 rounded" />
            <div className="skeleton-shimmer h-8 w-16 rounded" />
          </div>
        ))}
      </div>
      <section className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white">
        {[1, 2, 3, 4].map((row) => (
          <div className="flex items-center gap-4 border-b border-[var(--outline-variant)] p-4" key={row}>
            <div className="skeleton-shimmer h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-4 w-40 rounded" />
              <div className="skeleton-shimmer h-3 w-28 rounded" />
            </div>
            <div className="skeleton-shimmer h-8 w-24 rounded" />
          </div>
        ))}
      </section>
    </>
  );
}

function ErrorState() {
  return (
    <div className="flex min-h-[520px] items-center justify-center">
      <section className="w-full max-w-md rounded-xl border border-[var(--error-container)] bg-white p-10 text-center shadow-lg">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--error-container)] text-[var(--error)]">
          <Icon name="warning" fill className="text-[48px]" />
        </div>
        <h2 className="text-xl font-bold">Lỗi tải dữ liệu</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
          Đã xảy ra lỗi khi tải danh sách hồ sơ gia sư. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.
        </p>
        <div className="mt-6 flex gap-3">
          <button className="flex-1 rounded-lg bg-[var(--primary)] py-3 text-sm font-bold text-white" onClick={() => window.location.reload()} type="button">
            Thử lại
          </button>
          <Link className="flex-1 rounded-lg border border-[var(--outline)] py-3 text-sm font-bold text-[var(--on-surface-variant)]" href="/dashboard">
            Trang chủ
          </Link>
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[560px] items-center justify-center">
      <section className="w-full max-w-2xl rounded-xl border border-[var(--outline-variant)] bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-48 w-48 items-center justify-center rounded-full bg-[var(--surface-container-low)] text-[var(--primary)]">
          <Icon name="inbox" className="text-[80px]" />
        </div>
        <h2 className="text-3xl font-bold">Chưa có hồ sơ mới</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--on-surface-variant)]">
          Hiện tại không có hồ sơ gia sư nào đang chờ duyệt. Mọi thứ đã được xử lý ổn thỏa.
        </p>
        <Link className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--surface-container-high)] px-5 py-3 text-sm font-bold text-[var(--primary)]" href="/admin/tutors">
          <Icon name="refresh" />
          Làm mới danh sách
        </Link>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: TutorVerificationStatus }) {
  const className =
    status === "PENDING_REVIEW"
      ? "bg-[#fea619]/20 text-[#684000]"
      : status === "APPROVED"
        ? "bg-[#006444]/10 text-[#004a31]"
        : status === "REJECTED"
          ? "bg-[#ffdad6] text-[#93000a]"
          : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Chưa gửi";
  }

  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
