"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout, Avatar, Icon } from "@/components/admin/admin-layout";
import {
  AdminPayment,
  AdminSummary,
  getAdminPayments,
  getAdminSummary,
} from "@/lib/admin-api";
import { getAccessToken } from "@/lib/auth-storage";
import { getAdminTutors, type AdminTutorListItem } from "@/lib/tutor-api";

function money(value: string | number) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
}

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [tutors, setTutors] = useState<AdminTutorListItem[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    Promise.all([getAdminSummary(token), getAdminTutors(token), getAdminPayments(token)])
      .then(([summaryData, tutorItems, paymentItems]) => {
        setSummary(summaryData);
        setTutors(tutorItems);
        setPayments(paymentItems);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Không thể tải dashboard admin."))
      .finally(() => setLoading(false));
  }, []);

  const pendingTutors = tutors.filter((tutor) => tutor.status === "PENDING_REVIEW");
  const recentPayments = payments.slice(0, 6);
  const completionRate = useMemo(() => {
    if (!summary?.bookings.total) return 0;
    return Math.round((summary.bookings.completed / summary.bookings.total) * 100);
  }, [summary]);

  return (
    <AdminLayout active="dashboard" searchPlaceholder="Tìm gia sư, học viên, booking hoặc giao dịch...">
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-5 py-8 md:px-10">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-black text-[var(--primary)]">Admin dashboard</h1>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">Theo dõi vận hành, duyệt gia sư và dòng tiền.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white" href="/admin/tutors">
              <Icon name="verified_user" />
              Duyệt hồ sơ
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-lg border border-[var(--outline-variant)] px-4 py-3 text-sm font-bold text-[var(--primary)]" href="/admin/payments">
              <Icon name="payments" />
              Thanh toán
            </Link>
          </div>
        </header>

        {error ? <p className="rounded-lg bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--error)]">{error}</p> : null}
        {loading ? <AdminLoading /> : null}

        {!loading && summary ? (
          <>
            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Kpi icon="payments" label="Tiền học đã thu" value={money(summary.payments.grossPaid)} note={`${summary.payments.paidCount} giao dịch`} />
              <Kpi icon="account_balance" label="Phí nền tảng" value={money(summary.payments.platformFees)} note="15% mỗi giao dịch" tone="secondary" />
              <Kpi icon="account_balance_wallet" label="Đang giữ cho gia sư" value={money(summary.payments.heldPayouts)} note="Chờ hoàn thành buổi học" tone="tertiary" />
              <Kpi icon="paid" label="Đã mở khóa cho gia sư" value={money(summary.payments.releasedPayouts)} note="Sau khi trừ phí" />
            </section>

            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Kpi icon="school" label="Gia sư đã duyệt" value={String(summary.tutors.approved)} note={`${summary.tutors.pendingReview} chờ duyệt`} tone="tertiary" />
              <Kpi icon="task_alt" label="Tỉ lệ hoàn thành" value={`${completionRate}%`} note={`${summary.bookings.completed}/${summary.bookings.total} booking`} />
              <Kpi icon="gavel" label="Dispute đang mở" value={String(summary.disputes.open + summary.disputes.underReview)} note={`${summary.disputes.underReview} đang xem xét`} tone="secondary" />
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel title="Hàng chờ duyệt" actionHref="/admin/tutors" actionLabel="Xem tất cả">
                <div className="space-y-3">
                  {pendingTutors.length ? (
                    pendingTutors.slice(0, 5).map((tutor) => (
                      <Link className="flex items-center justify-between rounded-lg border border-[var(--outline-variant)] p-3 hover:bg-[var(--surface-container-low)]" href={`/admin/tutors/${tutor.id}`} key={tutor.id}>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={tutor.fullName} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{tutor.fullName}</p>
                            <p className="truncate text-xs text-[var(--on-surface-variant)]">{tutor.email}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-[var(--secondary-fixed)] px-2 py-1 text-xs font-bold text-[var(--secondary)]">{tutor.documentCount} docs</span>
                      </Link>
                    ))
                  ) : (
                    <Empty text="Không có hồ sơ chờ duyệt." />
                  )}
                </div>
              </Panel>

              <Panel title="Thanh toán gần đây" actionHref="/admin/payments" actionLabel="Xem giao dịch">
                <div className="space-y-3">
                  {recentPayments.length ? recentPayments.map((payment) => (
                    <Link className="block rounded-lg border border-[var(--outline-variant)] p-3 hover:bg-[var(--surface-container-low)]" href={`/admin/payments?paymentId=${payment.id}`} key={payment.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold">{payment.student.fullName}</p>
                        <PaymentBadge status={payment.status} />
                      </div>
                      <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{money(payment.amount)} · {payment.provider}</p>
                    </Link>
                  )) : <Empty text="Chưa có giao dịch." />}
                </div>
              </Panel>
            </section>
          </>
        ) : null}
      </main>
    </AdminLayout>
  );
}

function Kpi({ icon, label, note, tone = "primary", value }: { icon: string; label: string; note: string; tone?: "primary" | "secondary" | "tertiary"; value: string }) {
  const toneClass = tone === "secondary" ? "text-[var(--secondary)] bg-[var(--secondary-container)]/20" : tone === "tertiary" ? "text-[var(--tertiary)] bg-[var(--tertiary-container)]/15" : "text-[var(--primary)] bg-[var(--primary-fixed)]/30";
  return (
    <article className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClass}`}><Icon name={icon} /></span>
        <span className="text-xs font-bold text-[var(--on-surface-variant)]">{note}</span>
      </div>
      <p className="text-sm font-semibold text-[var(--on-surface-variant)]">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </article>
  );
}

function Panel({ actionHref, actionLabel, children, title }: { actionHref: string; actionLabel: string; children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">{title}</h2>
        <Link className="text-sm font-bold text-[var(--primary)] hover:underline" href={actionHref}>{actionLabel}</Link>
      </div>
      {children}
    </section>
  );
}

function PaymentBadge({ status }: { status: AdminPayment["status"] }) {
  const label = status === "PAID" ? "Paid" : status === "REFUNDED" ? "Refund" : status === "PENDING" ? "Pending" : status;
  return <span className="rounded-full bg-[var(--surface-container-high)] px-2 py-1 text-xs font-bold text-[var(--primary)]">{label}</span>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-[var(--outline-variant)] p-4 text-sm text-[var(--on-surface-variant)]">{text}</p>;
}

function AdminLoading() {
  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((item) => <div className="h-32 rounded-xl border border-[var(--outline-variant)] bg-white" key={item} />)}
    </section>
  );
}
