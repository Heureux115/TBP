"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout, Avatar, Icon } from "@/components/admin/admin-layout";
import {
  AdminAuditLog,
  AdminDispute,
  AdminDisputeStatus,
  getAdminAuditLogs,
  getAdminDisputes,
  markAdminDisputeReview,
  refundAdminDispute,
  rejectAdminDispute,
} from "@/lib/admin-api";
import { getAccessToken } from "@/lib/auth-storage";

type StatusFilter = "ALL" | AdminDisputeStatus;

function date(value: string) {
  return new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function money(value: string | number) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    Promise.all([getAdminDisputes(token), getAdminAuditLogs(token)])
      .then(([disputeItems, logs]) => {
        setDisputes(disputeItems);
        setAuditLogs(logs);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Không thể tải dispute."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return disputes.filter((dispute) => {
      const matchesStatus = status === "ALL" || dispute.status === status;
      const haystack = `${dispute.id} ${dispute.openedBy.fullName} ${dispute.openedBy.email} ${dispute.booking.tutor.fullName} ${dispute.reason}`.toLowerCase();
      return matchesStatus && (!keyword || haystack.includes(keyword));
    });
  }, [disputes, query, status]);

  const openCount = disputes.filter((dispute) => dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW").length;
  const refundedCount = disputes.filter((dispute) => dispute.status === "RESOLVED_REFUNDED").length;
  const rejectedCount = disputes.filter((dispute) => dispute.status === "REJECTED").length;

  async function reload(token: string) {
    const [disputeItems, logs] = await Promise.all([getAdminDisputes(token), getAdminAuditLogs(token)]);
    setDisputes(disputeItems);
    setAuditLogs(logs);
  }

  async function handleAction(dispute: AdminDispute, action: "review" | "refund" | "reject") {
    const token = getAccessToken();
    if (!token || busyId) return;
    const note = window.prompt("Ghi chú xử lý:", action === "refund" ? "Hoàn tiền cho học viên" : "");
    if (note === null) return;

    setBusyId(dispute.id);
    setError("");
    try {
      if (action === "review") await markAdminDisputeReview(token, dispute.id, note);
      if (action === "refund") await refundAdminDispute(token, dispute.id, note);
      if (action === "reject") await rejectAdminDispute(token, dispute.id, note);
      await reload(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể xử lý dispute.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <AdminLayout active="disputes" searchPlaceholder="Tìm dispute, học viên hoặc gia sư...">
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 py-8 md:px-10">
        <header>
          <h1 className="text-3xl font-black text-[var(--primary)]">Quản lý dispute</h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">Xử lý khiếu nại, quyết định hoàn tiền hoặc từ chối và theo dõi audit log.</p>
        </header>

        {error ? <p className="rounded-lg bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--error)]">{error}</p> : null}

        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Metric icon="gavel" label="Đang mở" value={String(openCount)} tone="secondary" />
          <Metric icon="assignment_return" label="Đã hoàn tiền" value={String(refundedCount)} tone="tertiary" />
          <Metric icon="block" label="Đã từ chối" value={String(rejectedCount)} tone="error" />
        </section>

        <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <label>
              <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">Tìm kiếm</span>
              <input className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" onChange={(event) => setQuery(event.target.value)} placeholder="Mã, học viên, gia sư..." value={query} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">Trạng thái</span>
              <select className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" onChange={(event) => setStatus(event.target.value as StatusFilter)} value={status}>
                <option value="ALL">Tất cả</option>
                <option value="OPEN">Mới mở</option>
                <option value="UNDER_REVIEW">Đang xem xét</option>
                <option value="RESOLVED_REFUNDED">Đã hoàn tiền</option>
                <option value="REJECTED">Từ chối</option>
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left">
              <thead className="bg-[var(--surface-container-low)] text-xs uppercase text-[var(--on-surface-variant)]">
                <tr>
                  <th className="px-5 py-4">Dispute</th>
                  <th className="px-5 py-4">Học viên</th>
                  <th className="px-5 py-4">Gia sư</th>
                  <th className="px-5 py-4">Thanh toán</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4">Ngày tạo</th>
                  <th className="px-5 py-4 text-right">Xử lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]/60">
                {loading ? (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={7}>Đang tải dispute...</td></tr>
                ) : filtered.length ? filtered.map((dispute) => (
                  <tr className="hover:bg-[var(--surface-container-low)]" key={dispute.id}>
                    <td className="px-5 py-4"><p className="font-black text-[var(--primary)]">#{dispute.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 line-clamp-2 text-xs text-[var(--on-surface-variant)]">{dispute.reason}</p></td>
                    <td className="px-5 py-4"><User name={dispute.booking.student.fullName} email={dispute.booking.student.email} /></td>
                    <td className="px-5 py-4"><User name={dispute.booking.tutor.fullName} email={dispute.booking.tutor.email} /></td>
                    <td className="px-5 py-4"><p className="text-sm font-black">{money(dispute.payment.amount)}</p><p className="text-xs text-[var(--on-surface-variant)]">{dispute.payment.status} / {dispute.payment.payoutStatus}</p></td>
                    <td className="px-5 py-4"><DisputeBadge status={dispute.status} /></td>
                    <td className="px-5 py-4 text-sm">{date(dispute.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {dispute.status === "OPEN" ? <button className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold text-[var(--primary)] disabled:opacity-60" disabled={busyId === dispute.id} onClick={() => handleAction(dispute, "review")} type="button">Xem xét</button> : null}
                        {(dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW") ? (
                          <>
                            <button className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={busyId === dispute.id} onClick={() => handleAction(dispute, "refund")} type="button">Hoàn tiền</button>
                            <button className="rounded-lg border border-[var(--error)]/30 px-3 py-2 text-xs font-bold text-[var(--error)] disabled:opacity-60" disabled={busyId === dispute.id} onClick={() => handleAction(dispute, "reject")} type="button">Từ chối</button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={7}>Không có dispute phù hợp.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-[var(--primary)]">Audit log gần đây</h2>
          <div className="space-y-3">
            {auditLogs.slice(0, 8).map((log) => (
              <article className="flex flex-col justify-between gap-2 rounded-lg border border-[var(--outline-variant)] p-3 md:flex-row md:items-center" key={log.id}>
                <div>
                  <p className="text-sm font-black">{log.action}</p>
                  <p className="text-xs text-[var(--on-surface-variant)]">{log.actor.fullName} - {log.resourceType} #{log.resourceId.slice(0, 8)}</p>
                </div>
                <span className="text-xs font-semibold text-[var(--on-surface-variant)]">{date(log.createdAt)}</span>
              </article>
            ))}
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

function User({ email, name }: { email: string; name: string }) {
  return <div className="flex items-center gap-3"><Avatar name={name} /><div><p className="text-sm font-bold">{name}</p><p className="text-xs text-[var(--on-surface-variant)]">{email}</p></div></div>;
}

function DisputeBadge({ status }: { status: AdminDisputeStatus }) {
  const label = status === "OPEN" ? "Mới mở" : status === "UNDER_REVIEW" ? "Đang xem xét" : status === "RESOLVED_REFUNDED" ? "Đã hoàn tiền" : "Từ chối";
  const color = status === "RESOLVED_REFUNDED" ? "text-[var(--tertiary)] bg-[var(--tertiary-fixed)]/30" : status === "REJECTED" ? "text-[var(--error)] bg-[var(--error-container)]" : "text-[var(--secondary)] bg-[var(--secondary-fixed)]/40";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${color}`}>{label}</span>;
}
