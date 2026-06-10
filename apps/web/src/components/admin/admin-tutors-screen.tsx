"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout, Avatar, Icon } from "@/components/admin/admin-layout";
import { getAccessToken } from "@/lib/auth-storage";
import { getAdminTutors, type AdminTutorListItem, type TutorVerificationStatus } from "@/lib/tutor-api";

type ScreenState = "list" | "loading" | "error" | "empty";

const labels: Record<TutorVerificationStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
};

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
}

export function AdminTutorsScreen({ initialState }: { initialState: ScreenState }) {
  const [rows, setRows] = useState<AdminTutorListItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TutorVerificationStatus | "ALL">("ALL");
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
    const keyword = query.trim().toLowerCase();
    return rows.filter((row) => `${row.fullName} ${row.email} ${row.city || ""} ${row.district || ""}`.toLowerCase().includes(keyword));
  }, [query, rows]);

  const pending = rows.filter((row) => row.status === "PENDING_REVIEW").length;
  const approved = rows.filter((row) => row.status === "APPROVED").length;
  const rejected = rows.filter((row) => row.status === "REJECTED").length;

  return (
    <AdminLayout active="tutors" searchPlaceholder="Tìm hồ sơ gia sư...">
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 py-8 md:px-10">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-black text-[var(--primary)]">Duyệt hồ sơ gia sư</h1>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">Kiểm tra thông tin, tài liệu và trạng thái xác minh của gia sư.</p>
          </div>
          <Link className="inline-flex items-center gap-2 rounded-lg border border-[var(--outline-variant)] px-4 py-3 text-sm font-bold text-[var(--primary)]" href="/admin/dashboard">
            <Icon name="dashboard" />
            Dashboard
          </Link>
        </header>

        {error ? <p className="rounded-lg bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--error)]">{error}</p> : null}

        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Metric icon="pending_actions" label="Chờ duyệt" value={String(pending)} tone="secondary" />
          <Metric icon="verified_user" label="Đã duyệt" value={String(approved)} tone="tertiary" />
          <Metric icon="cancel" label="Bị từ chối" value={String(rejected)} tone="error" />
        </section>

        <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <label>
              <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">Tìm kiếm</span>
              <input className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" onChange={(event) => setQuery(event.target.value)} placeholder="Tên, email, khu vực..." value={query} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">Trạng thái</span>
              <select className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" onChange={(event) => setStatus(event.target.value as TutorVerificationStatus | "ALL")} value={status}>
                <option value="ALL">Tất cả</option>
                <option value="PENDING_REVIEW">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="REJECTED">Bị từ chối</option>
                <option value="DRAFT">Draft</option>
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left">
              <thead className="bg-[var(--surface-container-low)] text-xs uppercase text-[var(--on-surface-variant)]">
                <tr>
                  <th className="px-5 py-4">Gia sư</th>
                  <th className="px-5 py-4">Khu vực</th>
                  <th className="px-5 py-4">Môn</th>
                  <th className="px-5 py-4">Tài liệu</th>
                  <th className="px-5 py-4">Ngày gửi</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]/60">
                {loading ? (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={7}>Đang tải hồ sơ...</td></tr>
                ) : filtered.length ? filtered.map((row) => (
                  <tr className="hover:bg-[var(--surface-container-low)]" key={row.id}>
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar name={row.fullName} src={row.avatarUrl} /><div><p className="text-sm font-bold">{row.fullName}</p><p className="text-xs text-[var(--on-surface-variant)]">{row.email}</p></div></div></td>
                    <td className="px-5 py-4 text-sm">{[row.district, row.city].filter(Boolean).join(", ") || "-"}</td>
                    <td className="px-5 py-4 text-sm font-bold">{row.subjectCount}</td>
                    <td className="px-5 py-4 text-sm font-bold">{row.documentCount}</td>
                    <td className="px-5 py-4 text-sm">{date(row.submittedAt)}</td>
                    <td className="px-5 py-4"><Status status={row.status} /></td>
                    <td className="px-5 py-4 text-right"><Link className="inline-flex whitespace-nowrap rounded-lg border border-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary)]" href={`/admin/tutors/${row.id}`}>Chi tiết</Link></td>
                  </tr>
                )) : (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={7}>Không có hồ sơ phù hợp.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AdminLayout>
  );
}

function Metric({ icon, label, tone = "primary", value }: { icon: string; label: string; tone?: "primary" | "secondary" | "tertiary" | "error"; value: string }) {
  const toneClass = tone === "secondary" ? "text-[var(--secondary)]" : tone === "tertiary" ? "text-[var(--tertiary)]" : tone === "error" ? "text-[var(--error)]" : "text-[var(--primary)]";
  return <article className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm"><Icon className={toneClass} name={icon} /><p className="mt-2 text-sm font-semibold text-[var(--on-surface-variant)]">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></article>;
}

function Status({ status }: { status: TutorVerificationStatus }) {
  const color = status === "APPROVED" ? "text-[var(--tertiary)] bg-[var(--tertiary-fixed)]/30" : status === "REJECTED" ? "text-[var(--error)] bg-[var(--error-container)]" : status === "PENDING_REVIEW" ? "text-[var(--secondary)] bg-[var(--secondary-fixed)]/40" : "text-[var(--on-surface-variant)] bg-[var(--surface-container-high)]";
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold leading-none ${color}`}>{labels[status]}</span>;
}
