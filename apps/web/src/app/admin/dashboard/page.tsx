"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardShell, Icon } from "@/components/tutor/dashboard-shell";
import { adminTutorRows } from "@/components/tutor/mock-data";
import { getAccessToken } from "@/lib/auth-storage";
import { getAdminTutors, type AdminTutorListItem } from "@/lib/tutor-api";

export default function AdminDashboardPage() {
  const [rows, setRows] = useState<AdminTutorListItem[]>(adminTutorRows);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      return;
    }

    getAdminTutors(token, "PENDING_REVIEW").then(setRows).catch(() => undefined);
  }, []);

  return (
    <DashboardShell active="dashboard" mode="admin">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-8 md:px-10">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              Theo dõi hàng chờ duyệt gia sư và các tác vụ vận hành chính.
            </p>
          </div>
          <Link className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white" href="/admin/tutors">
            <Icon name="manage_accounts" />
            Mở hàng chờ duyệt
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Kpi icon="pending_actions" label="Hồ sơ chờ duyệt" value={String(rows.length)} />
          <Kpi icon="verified" label="Đã duyệt hôm nay" value="0" />
          <Kpi icon="warning" label="Cần xử lý lại" value="0" />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[var(--outline-variant)] p-5">
              <div>
                <h2 className="text-xl font-bold">Hồ sơ mới chờ duyệt</h2>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Ưu tiên xử lý các hồ sơ mới gửi.</p>
              </div>
              <Link className="text-sm font-bold text-[var(--primary)] hover:underline" href="/admin/tutors">
                Xem tất cả
              </Link>
            </div>
            <div className="divide-y divide-[var(--outline-variant)]">
              {rows.slice(0, 5).map((row) => (
                <Link className="flex items-center justify-between gap-4 p-5 hover:bg-[var(--surface-container-low)]" href={`/admin/tutors/${row.id}`} key={row.id}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-container-high)] font-bold text-[var(--primary)]">
                      {row.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold">{row.fullName}</p>
                      <p className="text-sm text-[var(--on-surface-variant)]">{row.email}</p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{row.subjectCount} môn</p>
                    <p className="text-[var(--on-surface-variant)]">{row.documentCount} tài liệu</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">Tác vụ nhanh</h2>
            <div className="flex flex-col gap-3">
              <AdminAction href="/admin/tutors" icon="fact_check" label="Duyệt hồ sơ gia sư" />
              <AdminAction href="/admin/tutors?state=empty" icon="inbox" label="Xem trạng thái trống" />
              <AdminAction href="/admin/tutors?state=error" icon="report" label="Kiểm tra trạng thái lỗi" />
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function Kpi({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-[var(--primary)]">
        <Icon name={icon} />
      </div>
      <p className="text-sm font-semibold text-[var(--on-surface-variant)]">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function AdminAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link className="flex items-center gap-3 rounded-lg bg-[var(--surface-container-low)] px-4 py-3 text-sm font-bold text-[var(--primary)] hover:bg-[var(--surface-container-high)]" href={href}>
      <Icon name={icon} />
      {label}
    </Link>
  );
}
