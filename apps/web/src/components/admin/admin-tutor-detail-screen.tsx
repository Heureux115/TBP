"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardShell, Icon } from "@/components/tutor/dashboard-shell";
import { mockTutorProfile } from "@/components/tutor/mock-data";
import { getAccessToken } from "@/lib/auth-storage";
import {
  approveTutor,
  getAdminTutor,
  rejectTutor,
  type TutorProfile,
  type TutorVerificationStatus,
} from "@/lib/tutor-api";

const statusLabels: Record<TutorVerificationStatus, string> = {
  DRAFT: "Nháp",
  PENDING_REVIEW: "Đang chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
};

export function AdminTutorDetailScreen({
  initialStatus,
  tutorId,
}: {
  initialStatus: TutorVerificationStatus;
  tutorId: string;
}) {
  const [status, setStatus] = useState<TutorVerificationStatus>(initialStatus);
  const [profile, setProfile] = useState<TutorProfile>({
    ...mockTutorProfile,
    id: tutorId,
    verificationStatus: initialStatus,
  });
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState<"approved" | "rejected" | null>(null);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      return;
    }

    getAdminTutor(token, tutorId)
      .then((result) => {
        setProfile(result);
        setStatus(result.verificationStatus);
      })
      .catch(() => undefined);
  }, [tutorId]);

  function approve() {
    const token = getAccessToken();

    if (!token) {
      setStatus("APPROVED");
      setApproveOpen(false);
      setSuccess("approved");
      return;
    }

    approveTutor(token, profile.id)
      .then((result) => {
        setProfile(result);
        setStatus(result.verificationStatus);
        setSuccess("approved");
      })
      .catch(() => {
        setStatus("APPROVED");
        setSuccess("approved");
      })
      .finally(() => setApproveOpen(false));
  }

  function reject() {
    if (!reason.trim()) {
      return;
    }

    const token = getAccessToken();

    if (!token) {
      setStatus("REJECTED");
      setRejectOpen(false);
      setSuccess("rejected");
      return;
    }

    rejectTutor(token, profile.id, reason)
      .then((result) => {
        setProfile(result);
        setStatus(result.verificationStatus);
        setSuccess("rejected");
      })
      .catch(() => {
        setStatus("REJECTED");
        setSuccess("rejected");
      })
      .finally(() => setRejectOpen(false));
  }

  return (
    <DashboardShell active="approvals" mode="admin">
      <div className="min-h-screen bg-[var(--surface)]">
        <header className="sticky top-0 z-30 flex flex-col gap-4 border-b border-[var(--outline-variant)] bg-white/95 px-5 py-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between md:px-10">
          <div className="flex items-center gap-4">
            <Link className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]" href="/admin/tutors">
              <Icon name="arrow_back" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Chi tiết hồ sơ đăng ký</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusPill status={status} />
                <span className="text-sm text-[var(--on-surface-variant)]">ID: GS-2026-1042</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {status === "PENDING_REVIEW" ? (
              <>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--outline)] px-5 py-2.5 text-sm font-bold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                  onClick={() => setRejectOpen(true)}
                  type="button"
                >
                  <Icon name="close" className="text-[18px]" />
                  Từ chối
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--primary-container)]"
                  onClick={() => setApproveOpen(true)}
                  type="button"
                >
                  <Icon name="check" className="text-[18px]" />
                  Duyệt hồ sơ
                </button>
              </>
            ) : (
              <Link className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-white" href="/admin/tutors">
                Quay lại danh sách
              </Link>
            )}
          </div>
        </header>

        <main className="mx-auto flex max-w-[1280px] flex-col gap-6 p-5 md:p-10">
          {success ? (
            <div className={["rounded-xl border p-4 text-sm font-semibold", success === "approved" ? "border-[#006444]/30 bg-[#006444]/10 text-[#004a31]" : "border-[var(--error)] bg-[var(--error-container)] text-[var(--error)]"].join(" ")}>
              {success === "approved" ? "Hồ sơ đã được duyệt thành công." : "Hồ sơ đã bị từ chối và lý do đã được lưu."}
            </div>
          ) : null}

          {status === "REJECTED" ? <RejectedReason reason={reason || "Bằng cấp không hợp lệ hoặc tài liệu xác minh chưa rõ nét."} /> : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-6">
              <PersonalInfoCard />
              <TeachingProfileCard />
              <DocumentsReviewCard status={status} />
            </div>
            <aside className="flex flex-col gap-6">
              <SummaryCard status={status} />
              <TimelineCard status={status} />
              <InternalNotes />
            </aside>
          </div>
        </main>
      </div>

      {approveOpen ? <ApproveModal onCancel={() => setApproveOpen(false)} onConfirm={approve} tutorName={profile.fullName} /> : null}
      {rejectOpen ? (
        <RejectModal
          onCancel={() => setRejectOpen(false)}
          onConfirm={reject}
          reason={reason}
          setReason={setReason}
          tutorName={profile.fullName}
        />
      ) : null}
    </DashboardShell>
  );
}

function PersonalInfoCard() {
  const items = [
    ["Họ và tên", "Nguyễn Văn A"],
    ["Ngày sinh", "15/08/1998"],
    ["Email", "nguyenvana@email.com"],
    ["Số điện thoại", "0912 345 678"],
    ["Địa chỉ hiện tại", "Quận Cầu Giấy, Hà Nội"],
  ];

  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <h2 className="mb-5 flex items-center gap-2 border-b border-[var(--outline-variant)]/50 pb-3 text-xl font-semibold">
        <Icon name="person" className="text-[var(--primary)]" />
        Thông tin cá nhân
      </h2>
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] text-5xl font-bold text-[var(--primary)]">
          A
        </div>
        <dl className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2">
          {items.map(([label, value], index) => (
            <div className={index === items.length - 1 ? "sm:col-span-2" : ""} key={label}>
              <dt className="mb-1 text-xs font-bold uppercase text-[var(--outline)]">{label}</dt>
              <dd className="text-sm font-semibold text-[var(--on-surface)]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function TeachingProfileCard() {
  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <h2 className="mb-5 flex items-center gap-2 border-b border-[var(--outline-variant)]/50 pb-3 text-xl font-semibold">
        <Icon name="work" className="text-[var(--primary)]" />
        Hồ sơ giảng dạy
      </h2>
      <div className="space-y-5">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-[var(--outline)]">Tiêu đề hồ sơ</p>
          <p className="text-lg font-bold">Gia sư Toán THPT - Kinh nghiệm luyện thi Đại học</p>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-[var(--outline)]">Giới thiệu bản thân</p>
          <p className="rounded-lg border border-[var(--outline-variant)]/40 bg-[var(--surface-container)] px-4 py-3 text-sm leading-7 text-[var(--on-surface-variant)]">
            Cựu học sinh chuyên Toán Amsterdam, hiện đang học năm cuối ĐH Bách Khoa Hà Nội. Đã có 5 năm kinh nghiệm gia sư Toán cho học sinh cấp 3, đặc biệt luyện thi THPT Quốc gia. Phương pháp dạy học trực quan, dễ hiểu, bám sát cấu trúc đề thi.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Metric icon="history" label="Kinh nghiệm" value="5 năm" />
          <Metric icon="payments" label="Mức học phí" value="250k/h" />
          <Metric icon="location_on" label="Hình thức" value="Online & Offline" />
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-[var(--outline)]">Môn học đăng ký</p>
          <div className="flex flex-wrap gap-2">
            {["Toán 10", "Toán 11", "Toán 12", "Luyện thi THPT QG"].map((subject) => (
              <span className="rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-high)] px-3 py-1 text-sm font-semibold" key={subject}>
                {subject}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DocumentsReviewCard({ status }: { status: TutorVerificationStatus }) {
  const rejected = status === "REJECTED";
  const documents = [
    ["badge", "CCCD / CMND", "cccd_mat_truoc_sau.jpg", rejected ? "Ảnh bị mờ, cần tải lại" : "Đã tải lên"],
    ["history_edu", "Bằng cấp / Thẻ SV", "bang_dai_hoc_sp.pdf", rejected ? "Thiếu chứng chỉ đã khai báo" : "Đã tải lên"],
    ["workspace_premium", "Chứng chỉ", "nghiep_vu_su_pham.pdf", "Đã tải lên"],
    ["description", "Tài liệu khác", "bang_diem.pdf", "Đã tải lên"],
  ];

  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <h2 className="mb-5 flex items-center gap-2 border-b border-[var(--outline-variant)]/50 pb-3 text-xl font-semibold">
        <Icon name="folder_open" className="text-[var(--primary)]" />
        Tài liệu xác minh
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {documents.map(([icon, title, file, note], index) => {
          const isRejected = rejected && index < 2;
          return (
            <div className={["rounded-lg border p-4", isRejected ? "border-[var(--error)] bg-[var(--error-container)]/30" : "border-[var(--outline-variant)] bg-[var(--surface)]"].join(" ")} key={title}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon name={icon} className={isRejected ? "text-[var(--error)]" : "text-[var(--primary)]"} />
                  <span className="text-sm font-bold">{title}</span>
                </div>
                <span className={["rounded px-2 py-0.5 text-[10px] font-bold uppercase", isRejected ? "bg-[var(--error)] text-white" : "bg-[#006444]/10 text-[#004a31]"].join(" ")}>
                  {isRejected ? "Cần kiểm tra" : "Đã tải lên"}
                </span>
              </div>
              <div className="mb-3 flex h-28 items-center justify-center rounded border border-[var(--outline-variant)] bg-white text-[var(--outline)]">
                <Icon name={file.endsWith(".pdf") ? "picture_as_pdf" : "image"} className="text-[40px]" />
              </div>
              <p className="truncate text-sm font-semibold">{file}</p>
              <p className={["mt-1 text-xs", isRejected ? "text-[var(--error)]" : "text-[var(--on-surface-variant)]"].join(" ")}>{note}</p>
              <button className="mt-3 inline-flex items-center gap-1 rounded border border-[var(--primary)]/30 px-3 py-1.5 text-xs font-bold text-[var(--primary)] hover:bg-[var(--primary)]/5" type="button">
                <Icon name="visibility" className="text-[16px]" />
                Xem tài liệu
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SummaryCard({ status }: { status: TutorVerificationStatus }) {
  const approved = status === "APPROVED";
  const rejected = status === "REJECTED";

  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3 border-b border-[var(--outline-variant)]/50 pb-4">
        <div className={["flex h-12 w-12 items-center justify-center rounded-full text-white", approved ? "bg-[var(--tertiary-container)]" : rejected ? "bg-[var(--error)]" : "bg-[var(--secondary)]"].join(" ")}>
          <Icon name={approved ? "verified" : rejected ? "cancel" : "pending"} fill />
        </div>
        <div>
          <h3 className="text-xl font-semibold">{statusLabels[status]}</h3>
          <p className="text-sm text-[var(--on-surface-variant)]">
            {approved ? "Hồ sơ đủ điều kiện" : rejected ? "Cần chỉnh sửa" : "Đang cần admin xử lý"}
          </p>
        </div>
      </div>
      <p className="text-sm leading-6 text-[var(--on-surface-variant)]">
        {approved
          ? "Ứng viên có tài liệu xác minh đầy đủ và phù hợp để bắt đầu nhận lớp."
          : rejected
            ? "Ứng viên cần bổ sung tài liệu rõ nét hơn trước khi được xét duyệt lại."
            : "Kiểm tra thông tin cá nhân, hồ sơ giảng dạy và tài liệu xác minh trước khi ra quyết định."}
      </p>
    </section>
  );
}

function TimelineCard({ status }: { status: TutorVerificationStatus }) {
  const events = [
    status === "APPROVED"
      ? ["Đã phê duyệt hồ sơ", "Bởi Admin User", "Hôm nay, 14:30", "bg-[var(--tertiary-container)]"]
      : status === "REJECTED"
        ? ["Từ chối hồ sơ", "Bởi Admin User", "Hôm nay, 14:30", "bg-[var(--error)]"]
        : ["Hồ sơ được phân công", "Cho Admin User xét duyệt", "Hôm nay, 10:30", "bg-[var(--secondary-container)]"],
    ["Ứng viên cập nhật tài liệu", "CCCD và bằng cấp", "Hôm qua, 15:45", "bg-[var(--outline-variant)]"],
    ["Hồ sơ đăng ký mới", "Hệ thống ghi nhận", "2 ngày trước, 09:00", "bg-[var(--outline-variant)]"],
  ];

  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <Icon name="history" />
        Lịch sử xét duyệt
      </h3>
      <div className="relative ml-2 space-y-5 border-l-2 border-[var(--surface-variant)] pl-5">
        {events.map(([title, detail, time, color]) => (
          <div className="relative" key={title}>
            <span className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white ${color}`} />
            <p className="text-xs font-semibold text-[var(--outline)]">{time}</p>
            <p className="mt-1 text-sm font-bold">{title}</p>
            <p className="text-sm text-[var(--on-surface-variant)]">{detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InternalNotes() {
  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-xl font-semibold">
        <Icon name="edit_note" />
        Ghi chú nội bộ
      </h3>
      <textarea
        className="h-32 w-full resize-none rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
        placeholder="Nhập ghi chú về hồ sơ này..."
      />
      <button className="mt-3 w-full rounded-lg border border-[var(--outline-variant)] py-2 text-sm font-bold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]" type="button">
        Lưu ghi chú
      </button>
    </section>
  );
}

function ApproveModal({ onCancel, onConfirm, tutorName }: { onCancel: () => void; onConfirm: () => void; tutorName: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-[var(--primary)]">
          <Icon name="task_alt" />
        </div>
        <h2 className="text-center text-xl font-bold">Xác nhận duyệt hồ sơ?</h2>
        <p className="mt-3 text-center text-sm leading-6 text-[var(--on-surface-variant)]">
          Sau khi duyệt, hồ sơ của {tutorName} sẽ được hiển thị công khai và có thể bắt đầu nhận lịch hẹn.
        </p>
        <div className="mt-6 flex gap-3">
          <button className="flex-1 rounded-lg border border-[var(--primary)] py-2.5 text-sm font-bold text-[var(--primary)]" onClick={onCancel} type="button">
            Hủy
          </button>
          <button className="flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-sm font-bold text-white" onClick={onConfirm} type="button">
            Đồng ý duyệt
          </button>
        </div>
      </section>
    </div>
  );
}

function RejectModal({
  onCancel,
  onConfirm,
  reason,
  setReason,
  tutorName,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  reason: string;
  setReason: (value: string) => void;
  tutorName: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <section className="w-full max-w-[480px] overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--error-container)]/40 px-6 py-5">
          <div className="flex items-center gap-2 text-[var(--error)]">
            <Icon name="warning" fill />
            <h2 className="text-xl font-bold">Từ chối hồ sơ</h2>
          </div>
          <button className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]" onClick={onCancel} type="button">
            <Icon name="close" />
          </button>
        </header>
        <div className="space-y-4 p-6">
          <p className="text-sm leading-6 text-[var(--on-surface-variant)]">
            Bạn đang từ chối hồ sơ của <strong className="text-[var(--on-surface)]">{tutorName}</strong>. Vui lòng cung cấp lý do chi tiết để gia sư có thể khắc phục.
          </p>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">
              Lý do từ chối <span className="text-[var(--error)]">*</span>
            </span>
            <textarea
              className="h-32 w-full resize-none rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Nhập lý do từ chối hồ sơ tại đây..."
              value={reason}
            />
          </label>
        </div>
        <footer className="flex justify-end gap-3 border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-6 py-4">
          <button className="rounded-lg border border-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary)]" onClick={onCancel} type="button">
            Hủy bỏ
          </button>
          <button
            className="rounded-lg bg-[var(--error)] px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!reason.trim()}
            onClick={onConfirm}
            type="button"
          >
            Xác nhận từ chối
          </button>
        </footer>
      </section>
    </div>
  );
}

function RejectedReason({ reason }: { reason: string }) {
  return (
    <section className="flex items-start gap-4 rounded-xl border border-[var(--error-container)] bg-[var(--error-container)]/30 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--error)] text-white">
        <Icon name="warning" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-[var(--on-error-container)]">Lý do từ chối</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--on-surface-variant)]">{reason}</p>
        <p className="mt-2 text-xs text-[var(--on-surface-variant)]">Người duyệt: Admin User - Hôm nay, 14:30</p>
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--outline-variant)]/50 bg-[var(--surface)] p-4 text-center">
      <Icon name={icon} className="mx-auto mb-1 text-[32px] text-[var(--primary)]" />
      <p className="text-xs font-semibold text-[var(--outline)]">{label}</p>
      <p className="text-base font-bold">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: TutorVerificationStatus }) {
  const className =
    status === "PENDING_REVIEW"
      ? "bg-[#fea619]/20 text-[#684000]"
      : status === "APPROVED"
        ? "bg-[#006444]/10 text-[#004a31]"
        : status === "REJECTED"
          ? "bg-[#ffdad6] text-[#93000a]"
          : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      <Icon name={status === "APPROVED" ? "check_circle" : status === "REJECTED" ? "cancel" : "pending"} fill className="text-[16px]" />
      {statusLabels[status]}
    </span>
  );
}
