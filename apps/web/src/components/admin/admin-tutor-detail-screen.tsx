"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminAlert, AdminPage, AdminPageHeader, TutorStatusBadge } from "@/components/admin/admin-ui";
import { Button, Card, CardDescription, CardHeader, CardTitle, ConfirmDialog, FeedbackState, Icon, Skeleton, StatusBadge } from "@/components/ui";
import { getAccessToken } from "@/lib/auth-storage";
import { approveTutor, getAdminTutor, rejectTutor, type TutorProfile, type TutorVerificationStatus } from "@/lib/tutor-api";

const statusLabels: Record<TutorVerificationStatus, string> = {
  APPROVED: "Đã duyệt",
  DRAFT: "Bản nháp",
  PENDING_REVIEW: "Chờ duyệt",
  REJECTED: "Từ chối",
};

function money(value: string | null) {
  return value ? `${new Intl.NumberFormat("vi-VN").format(Number(value))}đ/h` : "Chưa cập nhật";
}

export function AdminTutorDetailScreen({ initialStatus, tutorId }: { initialStatus: TutorVerificationStatus; tutorId: string }) {
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const [status, setStatus] = useState<TutorVerificationStatus>(initialStatus);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    getAdminTutor(token, tutorId)
      .then((result) => {
        setProfile(result);
        setStatus(result.verificationStatus);
        setReason(result.rejectionReason || "");
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Không thể tải hồ sơ gia sư."));
  }, [tutorId]);

  async function handleApprove() {
    const token = getAccessToken();
    if (!token) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await approveTutor(token, tutorId);
      setProfile(result);
      setStatus(result.verificationStatus);
      setMessage("Hồ sơ đã được duyệt và có thể xuất hiện trong marketplace.");
      setPendingAction(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể duyệt hồ sơ.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    const token = getAccessToken();
    if (!token || !reason.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await rejectTutor(token, tutorId, reason.trim());
      setProfile(result);
      setStatus(result.verificationStatus);
      setMessage("Hồ sơ đã bị từ chối và lý do đã được lưu.");
      setPendingAction(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể từ chối hồ sơ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout active="tutors" searchPlaceholder="Tìm hồ sơ gia sư...">
      <AdminPage>
        <AdminPageHeader
          actions={<TutorStatusBadge status={status} />}
          description="Kiểm tra thông tin cá nhân, hồ sơ giảng dạy, tài liệu xác minh và quyết định duyệt hoặc từ chối."
          title="Chi tiết hồ sơ gia sư"
        />

        <Link className="inline-flex w-fit items-center gap-1 text-sm font-bold text-[var(--primary)] hover:underline" href="/admin/tutors">
          <Icon name="arrow_back" />
          Quay lại danh sách
        </Link>

        {error ? <AdminAlert>{error}</AdminAlert> : null}
        {message ? <AdminAlert tone="success">{message}</AdminAlert> : null}

        {!profile ? (
          <DetailSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-6">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Thông tin cá nhân</CardTitle>
                    <CardDescription>Dữ liệu định danh cơ bản của gia sư.</CardDescription>
                  </div>
                </CardHeader>
                <div className="grid gap-4 md:grid-cols-2">
                  <Info label="Họ tên" value={profile.fullName} />
                  <Info label="Email" value={profile.email} />
                  <Info label="Số điện thoại" value={profile.phone || "-"} />
                  <Info label="Khu vực" value={[profile.locationDistrict, profile.locationCity].filter(Boolean).join(", ") || "-"} />
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Hồ sơ giảng dạy</CardTitle>
                    <CardDescription>Thông tin phụ huynh/học viên sẽ dùng để ra quyết định đặt lịch.</CardDescription>
                  </div>
                </CardHeader>
                <div className="space-y-5">
                  <Info label="Tiêu đề" value={profile.headline || "-"} />
                  <Info label="Giới thiệu" value={profile.bio || "-"} />
                  <div className="grid gap-4 md:grid-cols-3">
                    <Info label="Kinh nghiệm" value={`${profile.experienceYears || 0} năm`} />
                    <Info label="Học phí" value={money(profile.hourlyRate)} />
                    <Info label="Hình thức" value={profile.teachingMode} />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-wide text-[var(--on-surface-variant)]">Môn học</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.subjects.length ? profile.subjects.map((item) => (
                        <StatusBadge dot={false} key={item.id} tone="neutral">{item.subject.name} · {item.level}</StatusBadge>
                      )) : <span className="text-sm font-semibold text-[var(--on-surface-variant)]">Chưa có môn học</span>}
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Tài liệu xác minh</CardTitle>
                    <CardDescription>Admin cần mở file thật trước khi duyệt hồ sơ.</CardDescription>
                  </div>
                </CardHeader>
                {profile.documents.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {profile.documents.map((document) => (
                      <article className="rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4" key={document.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-black">{document.type}</p>
                            <p className="mt-1 truncate text-xs font-semibold text-[var(--on-surface-variant)]">{document.fileName}</p>
                          </div>
                          <StatusBadge dot={false} tone="neutral">{document.status}</StatusBadge>
                        </div>
                        <a className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--primary)] px-3 py-2 text-sm font-bold text-[var(--primary)] hover:bg-[var(--surface-container-low)]" href={document.filePath} rel="noreferrer" target="_blank">
                          <Icon name="visibility" />
                          Xem file
                        </a>
                      </article>
                    ))}
                  </div>
                ) : (
                  <FeedbackState className="min-h-[220px]" description="Gia sư chưa tải tài liệu xác minh. Không nên duyệt hồ sơ khi thiếu bằng chứng." title="Chưa có tài liệu" />
                )}
              </Card>
            </section>

            <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <Card tone="warning">
                <CardHeader>
                  <div>
                    <CardTitle>Quyết định duyệt</CardTitle>
                    <CardDescription>Duyệt sẽ công khai gia sư; từ chối sẽ lưu lý do để gia sư chỉnh sửa.</CardDescription>
                  </div>
                </CardHeader>
                <div className="space-y-4">
                  <Button className="w-full" disabled={busy || status === "APPROVED"} onClick={() => setPendingAction("approve")}>
                    Duyệt hồ sơ
                  </Button>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[var(--on-surface-variant)]">Lý do từ chối</span>
                    <textarea
                      className="min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white p-3 text-sm leading-6 outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
                      onChange={(event) => setReason(event.target.value)}
                      value={reason}
                    />
                  </label>
                  <Button className="w-full" disabled={busy || !reason.trim()} onClick={() => setPendingAction("reject")} variant="danger">
                    Từ chối hồ sơ
                  </Button>
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Tóm tắt</CardTitle>
                    <CardDescription>Thông tin ra quyết định nhanh.</CardDescription>
                  </div>
                </CardHeader>
                <div className="space-y-3 text-sm">
                  <Info label="Trạng thái" value={statusLabels[status]} />
                  <Info label="Số môn" value={String(profile.subjects.length)} />
                  <Info label="Số tài liệu" value={String(profile.documents.length)} />
                </div>
              </Card>
            </aside>
          </div>
        )}

        <ConfirmDialog
          confirmLabel={pendingAction === "approve" ? "Duyệt hồ sơ" : "Từ chối hồ sơ"}
          description={pendingAction === "approve" ? "Gia sư sẽ đủ điều kiện xuất hiện trong trang tìm kiếm theo logic hiện tại." : "Lý do từ chối hiện tại sẽ được lưu cho hồ sơ gia sư."}
          isBusy={busy}
          onCancel={() => setPendingAction(null)}
          onConfirm={pendingAction === "approve" ? handleApprove : handleReject}
          open={Boolean(pendingAction)}
          title={pendingAction === "approve" ? "Duyệt hồ sơ gia sư này?" : "Từ chối hồ sơ gia sư này?"}
          tone={pendingAction === "approve" ? "primary" : "danger"}
        />
      </AdminPage>
    </AdminLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-[var(--on-surface-variant)]">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-[var(--on-surface)]">{value}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-48 rounded-[var(--radius-lg)]" />
      </div>
      <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
    </div>
  );
}
