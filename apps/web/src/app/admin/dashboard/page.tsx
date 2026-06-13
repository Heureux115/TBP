"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminAlert, AdminMetric, AdminMetricGrid, AdminPage, AdminPageHeader, AdminUserCell, PaymentStatusBadge } from "@/components/admin/admin-ui";
import { Avatar, Button, Card, CardDescription, CardHeader, CardTitle, FeedbackState, Icon, Skeleton, StatusBadge } from "@/components/ui";
import { AdminPayment, AdminSummary, getAdminPayments, getAdminSummary } from "@/lib/admin-api";
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
      <AdminPage className="gap-7">
        <AdminPageHeader
          actions={
            <>
              <Link href="/admin/tutors">
                <Button leftIcon={<Icon name="verified_user" />}>Duyệt hồ sơ</Button>
              </Link>
              <Link href="/admin/payments">
                <Button leftIcon={<Icon name="payments" />} variant="outline">Thanh toán</Button>
              </Link>
            </>
          }
          description="Theo dõi vận hành marketplace, hàng chờ duyệt và dòng tiền cần admin chú ý."
          title="Admin dashboard"
        />

        {error ? <AdminAlert>{error}</AdminAlert> : null}
        {loading ? <DashboardLoading /> : null}

        {!loading && summary ? (
          <>
            <AdminMetricGrid>
              <AdminMetric icon="payments" label="Tiền học đã thu" note={`${summary.payments.paidCount} giao dịch`} tone="success" value={money(summary.payments.grossPaid)} />
              <AdminMetric icon="account_balance" label="Phí nền tảng" note="15% mỗi giao dịch" tone="warning" value={money(summary.payments.platformFees)} />
              <AdminMetric icon="account_balance_wallet" label="Đang giữ cho gia sư" note="Chờ hoàn thành buổi học" tone="info" value={money(summary.payments.heldPayouts)} />
              <AdminMetric icon="paid" label="Đã mở khóa cho gia sư" note="Sau khi trừ phí" tone="success" value={money(summary.payments.releasedPayouts)} />
            </AdminMetricGrid>

            <AdminMetricGrid>
              <AdminMetric icon="school" label="Gia sư đã duyệt" note={`${summary.tutors.pendingReview} chờ duyệt`} tone="success" value={summary.tutors.approved} />
              <AdminMetric icon="task_alt" label="Tỉ lệ hoàn thành" note={`${summary.bookings.completed}/${summary.bookings.total} booking`} tone="info" value={`${completionRate}%`} />
            </AdminMetricGrid>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader
                  action={<Link className="text-sm font-bold text-[var(--primary)] hover:underline" href="/admin/tutors">Xem tất cả</Link>}
                >
                  <div>
                    <CardTitle>Hàng chờ duyệt</CardTitle>
                    <CardDescription>Hồ sơ gia sư cần kiểm tra tài liệu trước khi công khai.</CardDescription>
                  </div>
                </CardHeader>
                <div className="space-y-3">
                  {pendingTutors.length ? (
                    pendingTutors.slice(0, 5).map((tutor) => (
                      <Link className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--outline-variant)] p-3 transition hover:bg-[var(--surface-container-low)]" href={`/admin/tutors/${tutor.id}`} key={tutor.id}>
                        <AdminUserCell avatar={<Avatar name={tutor.fullName} src={tutor.avatarUrl} />} email={tutor.email} name={tutor.fullName} />
                        <StatusBadge tone="warning">{tutor.documentCount} tài liệu</StatusBadge>
                      </Link>
                    ))
                  ) : (
                    <FeedbackState className="min-h-[220px]" description="Không có hồ sơ gia sư nào đang chờ duyệt." title="Hàng chờ trống" />
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader
                  action={<Link className="text-sm font-bold text-[var(--primary)] hover:underline" href="/admin/payments">Xem giao dịch</Link>}
                >
                  <div>
                    <CardTitle>Thanh toán gần đây</CardTitle>
                    <CardDescription>Giao dịch mới nhất để admin phát hiện trạng thái bất thường.</CardDescription>
                  </div>
                </CardHeader>
                <div className="space-y-3">
                  {recentPayments.length ? recentPayments.map((payment) => (
                    <Link className="block rounded-[var(--radius-md)] border border-[var(--outline-variant)] p-3 transition hover:bg-[var(--surface-container-low)]" href={`/admin/payments?paymentId=${payment.id}`} key={payment.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-black">{payment.student.fullName}</p>
                        <PaymentStatusBadge status={payment.status} />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[var(--on-surface-variant)]">{money(payment.amount)} · {payment.provider}</p>
                    </Link>
                  )) : (
                    <FeedbackState className="min-h-[220px]" description="Chưa có giao dịch thanh toán nào." title="Chưa có giao dịch" />
                  )}
                </div>
              </Card>
            </section>
          </>
        ) : null}
      </AdminPage>
    </AdminLayout>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <Skeleton className="h-36 rounded-[var(--radius-lg)]" key={item} />)}
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
      </section>
    </div>
  );
}
