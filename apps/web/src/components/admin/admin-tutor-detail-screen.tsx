"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLayout, Icon } from "@/components/admin/admin-layout";
import { getAccessToken } from "@/lib/auth-storage";
import { approveTutor, getAdminTutor, rejectTutor, type TutorProfile, type TutorVerificationStatus } from "@/lib/tutor-api";

const statusLabels: Record<TutorVerificationStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
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
      setMessage("Hồ sơ đã được duyệt.");
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
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể từ chối hồ sơ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout active="tutors" searchPlaceholder="Tìm hồ sơ gia sư...">
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 py-8 md:px-10">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Link className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--primary)]" href="/admin/tutors">
              <Icon name="arrow_back" />
              Quay lại danh sách
            </Link>
            <h1 className="text-3xl font-black text-[var(--primary)]">Chi tiết hồ sơ gia sư</h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Kiểm tra thông tin, tài liệu và duyệt hồ sơ.</p>
          </div>
          <Status status={status} />
        </header>

        {error ? <p className="rounded-lg bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--error)]">{error}</p> : null}
        {message ? <p className="rounded-lg bg-[var(--tertiary-fixed)]/30 p-3 text-sm font-semibold text-[var(--tertiary)]">{message}</p> : null}

        {!profile ? (
          <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-8 text-sm text-[var(--on-surface-variant)]">Đang tải hồ sơ...</section>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="space-y-6 lg:col-span-2">
              <Card title="Thông tin cá nhân" icon="person">
                <div className="grid gap-4 md:grid-cols-2">
                  <Info label="Họ tên" value={profile.fullName} />
                  <Info label="Email" value={profile.email} />
                  <Info label="Số điện thoại" value={profile.phone || "-"} />
                  <Info label="Khu vực" value={[profile.locationDistrict, profile.locationCity].filter(Boolean).join(", ") || "-"} />
                </div>
              </Card>

              <Card title="Hồ sơ giảng dạy" icon="school">
                <div className="space-y-4">
                  <Info label="Tiêu đề" value={profile.headline || "-"} />
                  <Info label="Giới thiệu" value={profile.bio || "-"} />
                  <div className="grid gap-4 md:grid-cols-3">
                    <Info label="Kinh nghiệm" value={`${profile.experienceYears || 0} năm`} />
                    <Info label="Học phí" value={money(profile.hourlyRate)} />
                    <Info label="Hình thức" value={profile.teachingMode} />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase text-[var(--on-surface-variant)]">Môn học</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.subjects.length ? profile.subjects.map((item) => (
                        <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-sm font-bold" key={item.id}>{item.subject.name} · {item.level}</span>
                      )) : <span className="text-sm text-[var(--on-surface-variant)]">Chưa có môn học</span>}
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Tài liệu xác minh" icon="description">
                <div className="grid gap-4 md:grid-cols-2">
                  {profile.documents.length ? profile.documents.map((document) => (
                    <article className="rounded-lg border border-[var(--outline-variant)] p-4" key={document.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{document.type}</p>
                          <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{document.fileName}</p>
                        </div>
                        <span className="rounded-full bg-[var(--surface-container-high)] px-2 py-1 text-xs font-bold">{document.status}</span>
                      </div>
                      <a className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--primary)]" href={document.filePath} rel="noreferrer" target="_blank">
                        <Icon name="visibility" />
                        Xem file
                      </a>
                    </article>
                  )) : <p className="text-sm text-[var(--on-surface-variant)]">Chưa có tài liệu.</p>}
                </div>
              </Card>
            </section>

            <aside className="space-y-6">
              <Card title="Quyết định duyệt" icon="rule">
                <div className="space-y-4">
                  <p className="text-sm text-[var(--on-surface-variant)]">Duyệt hồ sơ sẽ công khai gia sư trên trang tìm kiếm. Từ chối sẽ lưu lý do để gia sư chỉnh sửa.</p>
                  <button className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60" disabled={busy || status === "APPROVED"} onClick={handleApprove} type="button">
                    Duyệt hồ sơ
                  </button>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">Lý do từ chối</span>
                    <textarea className="min-h-28 w-full rounded-lg border border-[var(--outline-variant)] p-3 text-sm outline-none focus:border-[var(--primary)]" onChange={(event) => setReason(event.target.value)} value={reason} />
                  </label>
                  <button className="w-full rounded-lg border border-[var(--error)] px-4 py-3 text-sm font-bold text-[var(--error)] disabled:opacity-60" disabled={busy || !reason.trim()} onClick={handleReject} type="button">
                    Từ chối hồ sơ
                  </button>
                </div>
              </Card>

              <Card title="Tóm tắt" icon="analytics">
                <div className="space-y-3 text-sm">
                  <Info label="Trạng thái" value={statusLabels[status]} />
                  <Info label="Số môn" value={String(profile.subjects.length)} />
                  <Info label="Số tài liệu" value={String(profile.documents.length)} />
                </div>
              </Card>
            </aside>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}

function Card({ children, icon, title }: { children: React.ReactNode; icon: string; title: string }) {
  return <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><Icon className="text-[var(--primary)]" name={icon} />{title}</h2>{children}</section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}

function Status({ status }: { status: TutorVerificationStatus }) {
  const color = status === "APPROVED" ? "text-[var(--tertiary)] bg-[var(--tertiary-fixed)]/30" : status === "REJECTED" ? "text-[var(--error)] bg-[var(--error-container)]" : "text-[var(--secondary)] bg-[var(--secondary-fixed)]/40";
  return <span className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${color}`}>{statusLabels[status]}</span>;
}
