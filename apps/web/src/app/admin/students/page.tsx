"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout, Avatar, Icon } from "@/components/admin/admin-layout";
import { AdminUser, getAdminUsers } from "@/lib/admin-api";
import { getAccessToken } from "@/lib/auth-storage";

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
    const keyword = query.trim().toLowerCase();
    return users.filter((user) => `${user.fullName} ${user.email} ${user.phone || ""}`.toLowerCase().includes(keyword));
  }, [query, users]);

  const activeCount = users.filter((user) => user.status === "ACTIVE").length;
  const verifiedCount = users.filter((user) => user.emailVerifiedAt).length;

  return (
    <AdminLayout active="students" searchPlaceholder="Tìm học viên...">
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 py-8 md:px-10">
        <header>
          <h1 className="text-3xl font-black text-[var(--primary)]">Quản lý học viên</h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">Xem tài khoản học viên, trạng thái email, booking và thanh toán.</p>
        </header>

        {error ? <p className="rounded-lg bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--error)]">{error}</p> : null}

        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Metric icon="group" label="Tổng học viên" value={String(users.length)} />
          <Metric icon="verified_user" label="Da kich hoat" value={String(activeCount)} tone="tertiary" />
          <Metric icon="mark_email_read" label="Da xac minh email" value={String(verifiedCount)} tone="secondary" />
        </section>

        <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm">
          <label className="block max-w-md">
            <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">Tìm kiếm</span>
            <input className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" onChange={(event) => setQuery(event.target.value)} placeholder="Tên, email, số điện thoại..." value={query} />
          </label>
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-[var(--surface-container-low)] text-xs uppercase text-[var(--on-surface-variant)]">
                <tr>
                  <th className="px-5 py-4">Hoc vien</th>
                  <th className="px-5 py-4">Dien thoai</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4">Booking</th>
                  <th className="px-5 py-4">Thanh toán</th>
                  <th className="px-5 py-4">Ngày tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]/60">
                {loading ? (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={6}>Đang tải học viên...</td></tr>
                ) : filtered.length ? filtered.map((user) => (
                  <tr className="hover:bg-[var(--surface-container-low)]" key={user.id}>
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar name={user.fullName} /><div><p className="text-sm font-bold">{user.fullName}</p><p className="text-xs text-[var(--on-surface-variant)]">{user.email}</p></div></div></td>
                    <td className="px-5 py-4 text-sm">{user.phone || "-"}</td>
                    <td className="px-5 py-4"><Status status={user.status} verified={Boolean(user.emailVerifiedAt)} /></td>
                    <td className="px-5 py-4 text-sm font-bold">{user.bookingCount}</td>
                    <td className="px-5 py-4 text-sm font-bold">{user.paymentCount}</td>
                    <td className="px-5 py-4 text-sm">{date(user.createdAt)}</td>
                  </tr>
                )) : (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={6}>Không có học viên phù hợp.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AdminLayout>
  );
}

function Metric({ icon, label, tone = "primary", value }: { icon: string; label: string; tone?: "primary" | "secondary" | "tertiary"; value: string }) {
  const toneClass = tone === "secondary" ? "text-[var(--secondary)]" : tone === "tertiary" ? "text-[var(--tertiary)]" : "text-[var(--primary)]";
  return <article className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm"><Icon className={toneClass} name={icon} /><p className="mt-2 text-sm font-semibold text-[var(--on-surface-variant)]">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></article>;
}

function Status({ status, verified }: { status: AdminUser["status"]; verified: boolean }) {
  return <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-bold text-[var(--primary)]">{status}{verified ? " / verified" : ""}</span>;
}
