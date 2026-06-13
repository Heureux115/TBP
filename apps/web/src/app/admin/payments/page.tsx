"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  AdminActionDialog,
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
  PaymentStatusBadge,
  PayoutStatusBadge,
  WithdrawalStatusBadge,
} from "@/components/admin/admin-ui";
import { Avatar, Button, DataTable, DataTableBody, DataTableHead } from "@/components/ui";
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
import { createSearchMatcher } from "@/lib/search-text";

type StatusFilter = "ALL" | AdminPaymentStatus;
type ProviderFilter = "ALL" | AdminPaymentProvider;
type PendingPaymentDialog =
  | { payment: AdminPayment; type: "refund-payment" }
  | { type: "reject-withdrawal"; withdrawal: AdminWithdrawal }
  | null;

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
  const [pendingDialog, setPendingDialog] = useState<PendingPaymentDialog>(null);
  const [dialogNote, setDialogNote] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const highlightedPaymentId = new URLSearchParams(window.location.search).get("paymentId");
    if (highlightedPaymentId) queueMicrotask(() => setQuery(highlightedPaymentId));
    Promise.all([getAdminPayments(token), getAdminWithdrawals(token)])
      .then(([paymentItems, withdrawalItems]) => {
        setPayments(paymentItems);
        setWithdrawals(withdrawalItems);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Không thể tải thanh toán."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const matchesQuery = createSearchMatcher(query);
    return payments.filter((payment) => {
      const matchesStatus = status === "ALL" || payment.status === status;
      const matchesProvider = provider === "ALL" || payment.provider === provider;
      const haystack = `${payment.id} ${payment.student.fullName} ${payment.student.email} ${payment.tutor.fullName} ${payment.provider}`;
      return matchesStatus && matchesProvider && matchesQuery(haystack);
    });
  }, [payments, provider, query, status]);

  const paid = payments.filter((payment) => payment.status === "PAID");
  const refunded = payments.filter((payment) => payment.status === "REFUNDED");
  const pending = payments.filter((payment) => payment.status === "PENDING");
  const withdrawalQueue = withdrawals.filter((withdrawal) => withdrawal.status === "PENDING" || withdrawal.status === "PROCESSING");
  const hasFilters = Boolean(query.trim()) || status !== "ALL" || provider !== "ALL";

  async function reload(token: string) {
    const [paymentItems, withdrawalItems] = await Promise.all([getAdminPayments(token), getAdminWithdrawals(token)]);
    setPayments(paymentItems);
    setWithdrawals(withdrawalItems);
  }

  function clearFilters() {
    setQuery("");
    setStatus("ALL");
    setProvider("ALL");
  }

  function openRefundDialog(payment: AdminPayment) {
    setDialogNote("Admin hoàn tiền theo yêu cầu hỗ trợ");
    setPendingDialog({ payment, type: "refund-payment" });
  }

  function openRejectWithdrawalDialog(withdrawal: AdminWithdrawal) {
    setDialogNote("Thông tin ngân hàng không hợp lệ");
    setPendingDialog({ type: "reject-withdrawal", withdrawal });
  }

  function closeDialog() {
    if (busyId) return;
    setPendingDialog(null);
    setDialogNote("");
  }

  async function confirmDialogAction() {
    const token = getAccessToken();
    if (!token || !pendingDialog || busyId || !dialogNote.trim()) return;

    const targetId = pendingDialog.type === "refund-payment" ? pendingDialog.payment.id : pendingDialog.withdrawal.id;
    setBusyId(targetId);
    setError("");
    try {
      if (pendingDialog.type === "refund-payment") {
        await refundAdminPayment(token, pendingDialog.payment.id, dialogNote.trim());
      } else {
        await rejectAdminWithdrawal(token, pendingDialog.withdrawal.id, dialogNote.trim());
      }
      await reload(token);
      setPendingDialog(null);
      setDialogNote("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : pendingDialog.type === "refund-payment" ? "Không thể hoàn tiền." : "Không thể từ chối yêu cầu rút tiền.");
    } finally {
      setBusyId("");
    }
  }

  async function handleWithdrawalAction(id: string, action: "processing" | "paid") {
    const token = getAccessToken();
    if (!token || busyId) return;

    setBusyId(id);
    setError("");
    try {
      if (action === "processing") await markAdminWithdrawalProcessing(token, id);
      if (action === "paid") await markAdminWithdrawalPaid(token, id);
      await reload(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể cập nhật yêu cầu rút tiền.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <AdminLayout active="payments" searchPlaceholder="Tìm giao dịch, học viên hoặc gia sư...">
      <AdminPage>
        <AdminPageHeader
          description="Theo dõi thanh toán, hoàn tiền, trạng thái giữ tiền và yêu cầu rút tiền của gia sư."
          title="Quản lý thanh toán"
        />

        {error ? <AdminAlert>{error}</AdminAlert> : null}

        <AdminMetricGrid>
          <AdminMetric icon="payments" label="Tiền học đã thu" note={`${paid.length} giao dịch paid`} tone="success" value={money(paid.reduce((sum, payment) => sum + Number(payment.amount), 0))} />
          <AdminMetric icon="account_balance_wallet" label="Phí nền tảng" note="Theo payment paid" tone="warning" value={money(paid.reduce((sum, payment) => sum + Number(payment.platformFeeAmount || 0), 0))} />
          <AdminMetric icon="assignment_return" label="Đã hoàn tiền" note={`${refunded.length} giao dịch`} tone="info" value={money(refunded.reduce((sum, payment) => sum + Number(payment.amount), 0))} />
          <AdminMetric icon="pending_actions" label="Cần xử lý" note={`${pending.length} pending · ${withdrawalQueue.length} rút tiền`} tone="danger" value={pending.length + withdrawalQueue.length} />
        </AdminMetricGrid>

        <DataTable tableClassName="min-w-[980px]">
          <DataTableHead>
            <tr>
              <th className="px-5 py-4" scope="col">Gia sư</th>
              <th className="px-5 py-4" scope="col">Số tiền</th>
              <th className="px-5 py-4" scope="col">Ngân hàng</th>
              <th className="px-5 py-4" scope="col">Trạng thái</th>
              <th className="px-5 py-4" scope="col">Ngày yêu cầu</th>
              <th className="px-5 py-4 text-right" scope="col">Xử lý</th>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <AdminTableLoading colSpan={6} rows={4} />
            ) : withdrawals.length ? (
              withdrawals.map((withdrawal) => (
                <tr className="transition hover:bg-[var(--surface-container-low)]" key={withdrawal.id}>
                  <td className="px-5 py-4">
                    <AdminUserCell avatar={<Avatar name={withdrawal.tutor.fullName} />} email={withdrawal.tutor.email} name={withdrawal.tutor.fullName} />
                  </td>
                  <td className="px-5 py-4 text-sm font-black tabular-nums">{money(withdrawal.amount)}</td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-black">{withdrawal.bankName}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--on-surface-variant)]">{withdrawal.bankAccountName} · {withdrawal.bankAccountNumber}</p>
                  </td>
                  <td className="px-5 py-4">
                    <WithdrawalStatusBadge status={withdrawal.status} />
                  </td>
                  <td className="px-5 py-4 text-sm font-medium">{date(withdrawal.requestedAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      {withdrawal.status === "PENDING" ? (
                        <Button disabled={busyId === withdrawal.id} onClick={() => handleWithdrawalAction(withdrawal.id, "processing")} size="sm" variant="outline">
                          Đang xử lý
                        </Button>
                      ) : null}
                      {withdrawal.status === "PENDING" || withdrawal.status === "PROCESSING" ? (
                        <>
                          <Button isLoading={busyId === withdrawal.id} onClick={() => handleWithdrawalAction(withdrawal.id, "paid")} size="sm">
                            Đã chuyển
                          </Button>
                          <Button disabled={busyId === withdrawal.id} onClick={() => openRejectWithdrawalDialog(withdrawal)} size="sm" variant="danger">
                            Từ chối
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <AdminEmptyState colSpan={6} description="Chưa có yêu cầu rút tiền từ gia sư." title="Không có yêu cầu rút tiền" />
            )}
          </DataTableBody>
        </DataTable>

        <AdminToolbar resultLabel={`${filtered.length}/${payments.length} giao dịch đang hiển thị`}>
          <AdminSearchField onChange={setQuery} placeholder="Mã giao dịch, học viên, gia sư, provider..." value={query} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <AdminSelectField<StatusFilter>
              label="Trạng thái"
              onChange={setStatus}
              options={[
                { label: "Tất cả", value: "ALL" },
                { label: "Đang chờ", value: "PENDING" },
                { label: "Đã thanh toán", value: "PAID" },
                { label: "Đã hoàn tiền", value: "REFUNDED" },
                { label: "Thất bại", value: "FAILED" },
                { label: "Đã hủy", value: "CANCELLED" },
              ]}
              value={status}
            />
            <AdminSelectField<ProviderFilter>
              label="Nhà cung cấp"
              onChange={setProvider}
              options={[
                { label: "Tất cả", value: "ALL" },
                { label: "Mock", value: "MOCK" },
                { label: "VNPay", value: "VNPAY" },
                { label: "MoMo", value: "MOMO" },
              ]}
              value={provider}
            />
            <AdminClearFiltersButton disabled={!hasFilters} onClick={clearFilters} />
          </div>
        </AdminToolbar>

        <DataTable tableClassName="min-w-[1120px]">
          <DataTableHead>
            <tr>
              <th className="px-5 py-4" scope="col">Giao dịch</th>
              <th className="px-5 py-4" scope="col">Học viên</th>
              <th className="px-5 py-4" scope="col">Gia sư</th>
              <th className="px-5 py-4" scope="col">Số tiền</th>
              <th className="px-5 py-4" scope="col">Split</th>
              <th className="px-5 py-4" scope="col">Trạng thái</th>
              <th className="px-5 py-4" scope="col">Payout</th>
              <th className="px-5 py-4" scope="col">Ngày</th>
              <th className="px-5 py-4 text-right" scope="col">Thao tác</th>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <AdminTableLoading colSpan={9} rows={6} />
            ) : filtered.length ? (
              filtered.map((payment) => (
                <tr className="transition hover:bg-[var(--surface-container-low)]" key={payment.id}>
                  <td className="px-5 py-4">
                    <p className="font-black text-[var(--primary)]">#{payment.id.slice(0, 8).toUpperCase()}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--on-surface-variant)]">{payment.providerTxnRef || payment.provider}</p>
                  </td>
                  <td className="px-5 py-4">
                    <AdminUserCell avatar={<Avatar name={payment.student.fullName} />} email={payment.student.email} name={payment.student.fullName} />
                  </td>
                  <td className="px-5 py-4">
                    <AdminUserCell avatar={<Avatar name={payment.tutor.fullName} />} email={payment.tutor.email} name={payment.tutor.fullName} />
                  </td>
                  <td className="px-5 py-4 text-sm font-black tabular-nums">{money(payment.amount)}</td>
                  <td className="px-5 py-4">
                    <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Fee: {money(payment.platformFeeAmount || 0)}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--on-surface-variant)]">Tutor: {money(payment.tutorPayoutAmount || 0)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <PaymentStatusBadge status={payment.status} />
                  </td>
                  <td className="px-5 py-4">
                    <PayoutStatusBadge status={payment.payoutStatus} />
                  </td>
                  <td className="px-5 py-4 text-sm font-medium">{date(payment.createdAt)}</td>
                  <td className="w-32 px-5 py-4 text-right">
                    {payment.status === "PAID" ? (
                      <Button className="w-28 whitespace-nowrap" disabled={busyId === payment.id} onClick={() => openRefundDialog(payment)} size="sm" variant="danger">
                        Hoàn tiền
                      </Button>
                    ) : (
                      <Link className="inline-flex min-h-11 w-28 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary)] hover:bg-[var(--surface-container-low)]" href={`/payments/${payment.id}`}>
                        Xem
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <AdminEmptyState
                colSpan={9}
                description={hasFilters ? "Không có giao dịch nào khớp với bộ lọc hiện tại." : "Chưa có giao dịch thanh toán."}
                onAction={hasFilters ? clearFilters : undefined}
                title={hasFilters ? "Không tìm thấy giao dịch" : "Chưa có giao dịch"}
              />
            )}
          </DataTableBody>
        </DataTable>

        <AdminActionDialog
          busy={Boolean(busyId)}
          confirmLabel={pendingDialog?.type === "refund-payment" ? "Hoàn tiền" : "Từ chối"}
          description={pendingDialog?.type === "refund-payment" ? "Giao dịch sẽ được gửi qua luồng hoàn tiền hiện tại. Lý do này được lưu theo API admin." : "Yêu cầu rút tiền sẽ bị từ chối và số dư được xử lý theo logic hiện tại."}
          note={dialogNote}
          noteLabel={pendingDialog?.type === "refund-payment" ? "Lý do hoàn tiền" : "Lý do từ chối"}
          notePlaceholder="Nhập lý do rõ ràng để admin khác có thể audit quyết định này."
          noteRequired
          onCancel={closeDialog}
          onConfirm={confirmDialogAction}
          onNoteChange={setDialogNote}
          open={Boolean(pendingDialog)}
          title={pendingDialog?.type === "refund-payment" ? "Hoàn tiền giao dịch này?" : "Từ chối yêu cầu rút tiền?"}
        />
      </AdminPage>
    </AdminLayout>
  );
}
