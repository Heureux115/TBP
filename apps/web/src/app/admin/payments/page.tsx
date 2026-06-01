"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout, Avatar, Icon } from "@/components/admin/admin-layout";
import {
  AdminPayment,
  AdminPaymentProvider,
  AdminPaymentStatus,
  AdminWithdrawal,
  getAdminPayments,
  getAdminWithdrawals,
  markAdminWithdrawalPaid,
  markAdminWithdrawalProcessing,
  refundAdminPayment,
  rejectAdminWithdrawal,
} from "@/lib/admin-api";
import { getAccessToken } from "@/lib/auth-storage";

type StatusFilter = "ALL" | AdminPaymentStatus;
type ProviderFilter = "ALL" | AdminPaymentProvider;

function money(value: string | number) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
}

function date(value: string) {
  return new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [provider, setProvider] = useState<ProviderFilter>("ALL");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const highlightedPaymentId = new URLSearchParams(window.location.search).get("paymentId");
    if (highlightedPaymentId) setQuery(highlightedPaymentId);
    Promise.all([getAdminPayments(token), getAdminWithdrawals(token)])
      .then(([paymentItems, withdrawalItems]) => {
        setPayments(paymentItems);
        setWithdrawals(withdrawalItems);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Không thể tải thanh toán."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesStatus = status === "ALL" || payment.status === status;
      const matchesProvider = provider === "ALL" || payment.provider === provider;
      const haystack = `${payment.id} ${payment.student.fullName} ${payment.student.email} ${payment.tutor.fullName} ${payment.provider}`.toLowerCase();
      return matchesStatus && matchesProvider && (!keyword || haystack.includes(keyword));
    });
  }, [payments, provider, query, status]);

  const paid = payments.filter((payment) => payment.status === "PAID");
  const refunded = payments.filter((payment) => payment.status === "REFUNDED");
  const pending = payments.filter((payment) => payment.status === "PENDING");
  const withdrawalQueue = withdrawals.filter((withdrawal) => withdrawal.status === "PENDING" || withdrawal.status === "PROCESSING");

  async function reload(token: string) {
    const [paymentItems, withdrawalItems] = await Promise.all([getAdminPayments(token), getAdminWithdrawals(token)]);
    setPayments(paymentItems);
    setWithdrawals(withdrawalItems);
  }

  async function handleRefund(payment: AdminPayment) {
    const token = getAccessToken();
    if (!token || busyId) return;
    const reason = window.prompt("Lý do hoàn tiền/dispute:", "Admin hoàn tiền theo yêu cầu hỗ trợ");
    if (!reason) return;

    setBusyId(payment.id);
    setError("");
    try {
      await refundAdminPayment(token, payment.id, reason);
      await reload(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể hoàn tiền.");
    } finally {
      setBusyId("");
    }
  }

  async function handleWithdrawalAction(id: string, action: "processing" | "paid" | "reject") {
    const token = getAccessToken();
    if (!token || busyId) return;
    const reason = action === "reject" ? window.prompt("Lý do từ chối yêu cầu rút tiền:", "Thông tin ngân hàng không hợp lệ") : "";
    if (action === "reject" && !reason) return;

    setBusyId(id);
    setError("");
    try {
      if (action === "processing") await markAdminWithdrawalProcessing(token, id);
      if (action === "paid") await markAdminWithdrawalPaid(token, id);
      if (action === "reject") await rejectAdminWithdrawal(token, id, reason || "");
      await reload(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể cập nhật yêu cầu rút tiền.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <AdminLayout active="payments" searchPlaceholder="Tìm giao dịch, học viên hoặc gia sư...">
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 py-8 md:px-10">
        <header>
          <h1 className="text-3xl font-black text-[var(--primary)]">Quản lý thanh toán</h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">Theo dõi thanh toán, hoàn tiền và payout của gia sư.</p>
        </header>

        {error ? <p className="rounded-lg bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--error)]">{error}</p> : null}

        <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
          <Metric icon="payments" label="Tiền học đã thu" value={money(paid.reduce((sum, payment) => sum + Number(payment.amount), 0))} />
          <Metric icon="account_balance_wallet" label="Phí nền tảng" value={money(paid.reduce((sum, payment) => sum + Number(payment.platformFeeAmount || 0), 0))} tone="secondary" />
          <Metric icon="assignment_return" label="Đã hoàn tiền" value={money(refunded.reduce((sum, payment) => sum + Number(payment.amount), 0))} tone="tertiary" />
          <Metric icon="pending_actions" label="Payment đang chờ" value={String(pending.length)} tone="error" />
          <Metric icon="payments" label="Rút tiền cần xử lý" value={String(withdrawalQueue.length)} tone="secondary" />
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm">
          <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-5 py-4">
            <h2 className="text-lg font-black text-[var(--primary)]">Yêu cầu rút tiền của gia sư</h2>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Admin xác nhận chuyển khoản ngân hàng, hoặc từ chối để hoàn số dư về ví gia sư.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-[var(--surface-container-low)] text-xs uppercase text-[var(--on-surface-variant)]">
                <tr>
                  <th className="px-5 py-4">Gia sư</th>
                  <th className="px-5 py-4">Số tiền</th>
                  <th className="px-5 py-4">Ngân hàng</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4">Ngày yêu cầu</th>
                  <th className="px-5 py-4 text-right">Xử lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]/60">
                {loading ? (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={6}>Đang tải yêu cầu...</td></tr>
                ) : withdrawals.length ? withdrawals.map((withdrawal) => (
                  <tr className="hover:bg-[var(--surface-container-low)]" key={withdrawal.id}>
                    <td className="px-5 py-4"><User name={withdrawal.tutor.fullName} email={withdrawal.tutor.email} /></td>
                    <td className="px-5 py-4 text-sm font-black">{money(withdrawal.amount)}</td>
                    <td className="px-5 py-4"><p className="text-sm font-bold">{withdrawal.bankName}</p><p className="text-xs text-[var(--on-surface-variant)]">{withdrawal.bankAccountName} - {withdrawal.bankAccountNumber}</p></td>
                    <td className="px-5 py-4"><WithdrawalBadge status={withdrawal.status} /></td>
                    <td className="px-5 py-4 text-sm">{date(withdrawal.requestedAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {withdrawal.status === "PENDING" ? <button className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold text-[var(--primary)] disabled:opacity-60" disabled={busyId === withdrawal.id} onClick={() => handleWithdrawalAction(withdrawal.id, "processing")} type="button">Đang xử lý</button> : null}
                        {(withdrawal.status === "PENDING" || withdrawal.status === "PROCESSING") ? (
                          <>
                            <button className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={busyId === withdrawal.id} onClick={() => handleWithdrawalAction(withdrawal.id, "paid")} type="button">Đã chuyển</button>
                            <button className="rounded-lg border border-[var(--error)]/30 px-3 py-2 text-xs font-bold text-[var(--error)] disabled:opacity-60" disabled={busyId === withdrawal.id} onClick={() => handleWithdrawalAction(withdrawal.id, "reject")} type="button">Từ chối</button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={6}>Chưa có yêu cầu rút tiền.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">Tìm kiếm</span>
              <input className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" onChange={(event) => setQuery(event.target.value)} placeholder="Mã, học viên, gia sư..." value={query} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">Trạng thái</span>
              <select className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" onChange={(event) => setStatus(event.target.value as StatusFilter)} value={status}>
                <option value="ALL">Tất cả</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="REFUNDED">Refunded</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">Nhà cung cấp</span>
              <select className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" onChange={(event) => setProvider(event.target.value as ProviderFilter)} value={provider}>
                <option value="ALL">Tất cả</option>
                <option value="MOCK">Mock</option>
                <option value="VNPAY">VNPay</option>
                <option value="MOMO">MoMo</option>
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left">
              <thead className="bg-[var(--surface-container-low)] text-xs uppercase text-[var(--on-surface-variant)]">
                <tr>
                  <th className="px-5 py-4">Giao dịch</th>
                  <th className="px-5 py-4">Học viên</th>
                  <th className="px-5 py-4">Gia sư</th>
                  <th className="px-5 py-4">Số tiền</th>
                  <th className="px-5 py-4">Split</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4">Payout</th>
                  <th className="px-5 py-4">Ngày</th>
                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]/60">
                {loading ? (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={9}>Đang tải giao dịch...</td></tr>
                ) : filtered.length ? filtered.map((payment) => (
                  <tr className="hover:bg-[var(--surface-container-low)]" key={payment.id}>
                    <td className="px-5 py-4"><p className="font-black text-[var(--primary)]">#{payment.id.slice(0, 8).toUpperCase()}</p><p className="text-xs text-[var(--on-surface-variant)]">{payment.providerTxnRef || payment.provider}</p></td>
                    <td className="px-5 py-4"><User name={payment.student.fullName} email={payment.student.email} /></td>
                    <td className="px-5 py-4"><User name={payment.tutor.fullName} email={payment.tutor.email} /></td>
                    <td className="px-5 py-4 text-sm font-black">{money(payment.amount)}</td>
                    <td className="px-5 py-4"><p className="text-xs">Fee: {money(payment.platformFeeAmount || 0)}</p><p className="text-xs">Tutor: {money(payment.tutorPayoutAmount || 0)}</p></td>
                    <td className="px-5 py-4"><PaymentBadge status={payment.status} /></td>
                    <td className="px-5 py-4"><PayoutBadge status={payment.payoutStatus} /></td>
                    <td className="px-5 py-4 text-sm">{date(payment.createdAt)}</td>
                    <td className="px-5 py-4 text-right">
                      {payment.status === "PAID" ? (
                        <button className="rounded-lg border border-[var(--error)]/30 px-3 py-2 text-xs font-bold text-[var(--error)] disabled:opacity-60" disabled={busyId === payment.id} onClick={() => handleRefund(payment)} type="button">Hoàn tiền</button>
                      ) : (
                        <Link className="rounded-lg border border-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary)]" href={`/admin/payments?paymentId=${payment.id}`}>Xem</Link>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={9}>Không có giao dịch phù hợp.</td></tr>
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

function User({ email, name }: { email: string; name: string }) {
  return <div className="flex items-center gap-3"><Avatar name={name} /><div><p className="text-sm font-bold">{name}</p><p className="text-xs text-[var(--on-surface-variant)]">{email}</p></div></div>;
}

function PaymentBadge({ status }: { status: AdminPaymentStatus }) {
  const label = status === "PAID" ? "Paid" : status === "REFUNDED" ? "Refunded" : status === "PENDING" ? "Pending" : status;
  const color = status === "REFUNDED" ? "text-[var(--primary)] bg-[var(--primary-container)]/15" : status === "PAID" ? "text-[var(--tertiary)] bg-[var(--tertiary-fixed)]/30" : status === "PENDING" ? "text-[var(--secondary)] bg-[var(--secondary-fixed)]/40" : "text-[var(--error)] bg-[var(--error-container)]";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${color}`}>{label}</span>;
}

function PayoutBadge({ status }: { status: AdminPayment["payoutStatus"] }) {
  const label = status === "HELD" ? "Đang giữ" : status === "RELEASED" ? "Đã mở khóa" : status === "REFUNDED" ? "Đã hoàn" : "Đã hủy";
  const color = status === "RELEASED" ? "text-[var(--tertiary)] bg-[var(--tertiary-fixed)]/30" : status === "HELD" ? "text-[var(--secondary)] bg-[var(--secondary-fixed)]/40" : "text-[var(--error)] bg-[var(--error-container)]";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${color}`}>{label}</span>;
}

function WithdrawalBadge({ status }: { status: AdminWithdrawal["status"] }) {
  const label = status === "PENDING" ? "Chờ xử lý" : status === "PROCESSING" ? "Đang xử lý" : status === "PAID" ? "Đã chuyển" : status === "REJECTED" ? "Từ chối" : "Đã hủy";
  const color = status === "PAID" ? "text-[var(--tertiary)] bg-[var(--tertiary-fixed)]/30" : status === "REJECTED" || status === "CANCELLED" ? "text-[var(--error)] bg-[var(--error-container)]" : "text-[var(--secondary)] bg-[var(--secondary-fixed)]/40";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${color}`}>{label}</span>;
}
