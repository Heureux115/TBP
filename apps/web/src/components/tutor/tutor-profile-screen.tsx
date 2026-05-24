"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardShell, Icon } from "@/components/tutor/dashboard-shell";
import { getAccessToken } from "@/lib/auth-storage";
import { getMyTutorProfile, type TutorDocument, type TutorProfile, type TutorVerificationStatus } from "@/lib/tutor-api";

const statusCopy: Record<
  TutorVerificationStatus,
  { label: string; description: string; icon: string; badge: string; panel: string }
> = {
  DRAFT: {
    label: "Bản nháp / Chưa hoàn thiện",
    description: "Hoàn thiện thông tin chuyên môn, môn giảng dạy và tài liệu xác minh để gửi duyệt.",
    icon: "edit_document",
    badge: "bg-[#fea619]/20 text-[#684000] border-[#fea619]/40",
    panel: "border-[var(--outline-variant)] bg-white",
  },
  PENDING_REVIEW: {
    label: "Đang chờ duyệt",
    description: "Hồ sơ của bạn đã được gửi và đang trong quá trình xét duyệt. Vui lòng chờ phản hồi trong vòng 24-48 giờ.",
    icon: "hourglass_top",
    badge: "bg-[#ffddb8] text-[#684000] border-[#ffb95f]",
    panel: "border-[#ffb95f] bg-[#ffddb8]",
  },
  APPROVED: {
    label: "Đã xác thực / Đã duyệt",
    description: "Hồ sơ đã được phê duyệt và đủ điều kiện hiển thị công khai trên TutorConnect.",
    icon: "verified",
    badge: "bg-[#006444]/10 text-[#004a31] border-[#006444]/20",
    panel: "border-[#006444]/30 bg-white",
  },
  REJECTED: {
    label: "Hồ sơ chưa đạt yêu cầu",
    description: "Ảnh CCCD mặt trước bị mờ, vui lòng chụp lại rõ nét hơn trước khi gửi lại.",
    icon: "error",
    badge: "bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]",
    panel: "border-[#ba1a1a] bg-[#ffdad6]",
  },
};

export function TutorProfileScreen({ initialStatus }: { initialStatus: TutorVerificationStatus }) {
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const status = profile?.verificationStatus ?? initialStatus;
  const copy = statusCopy[status];
  const completion = status === "DRAFT" ? 25 : status === "REJECTED" ? 80 : 100;

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      return;
    }

    getMyTutorProfile(token)
      .then(setProfile)
      .catch(() => undefined);
  }, []);

  return (
    <DashboardShell active="profile">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 py-6 md:px-10 md:py-10">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-normal text-[var(--on-surface)]">Hồ sơ gia sư</h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              Quản lý thông tin chuyên môn, môn giảng dạy và trạng thái xác minh.
            </p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${copy.badge}`}>
            <Icon name={copy.icon} fill className="text-[20px]" />
            {copy.label}
          </div>
        </header>

        {status === "DRAFT" ? (
          <DraftPanel completion={completion} />
        ) : (
          <StatusBanner status={status} />
        )}

        {status === "DRAFT" ? (
          <DraftEmptyCards />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <aside className="lg:col-span-4">
              {profile ? <IdentityCard profile={profile} status={status} /> : <ProfileLoading />}
            </aside>
            <section className="flex flex-col gap-6 lg:col-span-8">
              {profile ? (
                <>
                  <BioCard profile={profile} />
                  <StatsGrid profile={profile} />
                  <SubjectsCard profile={profile} />
                  <DocumentsCard documents={profile.documents} status={status} />
                </>
              ) : (
                <ProfileLoading />
              )}
            </section>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function StatusBanner({ status }: { status: TutorVerificationStatus }) {
  const copy = statusCopy[status];

  return (
    <section className={`rounded-xl border-2 p-5 shadow-sm ${copy.panel}`}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex gap-4">
          <div
            className={[
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
              status === "REJECTED" ? "bg-[var(--error)] text-white" : "bg-[var(--primary)] text-white",
            ].join(" ")}
          >
            <Icon name={copy.icon} fill className="text-[32px]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--on-surface)]">Trạng thái: {copy.label}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--on-surface-variant)]">{copy.description}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            className="rounded-lg border border-[var(--outline)] bg-white px-5 py-3 text-center text-sm font-bold text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
            href="/tutor/onboarding"
          >
            Chỉnh sửa hồ sơ
          </Link>
          {status === "REJECTED" ? (
            <button className="rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[var(--primary-container)]" type="button">
              Gửi lại hồ sơ
            </button>
          ) : null}
          {status === "APPROVED" ? (
            <button className="rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[var(--primary-container)]" type="button">
              Xem hồ sơ công khai
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DraftPanel({ completion }: { completion: number }) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="w-full flex-1">
          <div className="mb-2 flex items-end justify-between">
            <h2 className="text-xl font-semibold">Mức độ hoàn thiện hồ sơ</h2>
            <span className="text-2xl font-bold text-[var(--primary)]">{completion}%</span>
          </div>
          <div className="mb-5 h-3 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${completion}%` }} />
          </div>
          <div className="grid gap-2 text-sm text-[var(--error)]">
            {["Thiếu giới thiệu bản thân và kinh nghiệm", "Thiếu tài liệu xác minh", "Thiếu môn học giảng dạy"].map((item) => (
              <div className="flex items-center gap-2" key={item}>
                <Icon name="error" fill className="text-[18px]" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <Link
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-6 py-4 text-sm font-bold text-white shadow-sm hover:bg-[var(--primary-container)] md:w-auto"
          href="/tutor/onboarding"
        >
          Tiếp tục hoàn thiện hồ sơ
          <Icon name="arrow_forward" className="text-[20px]" />
        </Link>
      </div>
    </section>
  );
}

function DraftEmptyCards() {
  const cards = [
    ["history_edu", "Giới thiệu bản thân", "Viết bio để học viên hiểu rõ phong cách giảng dạy của bạn.", "Thêm giới thiệu"],
    ["local_library", "Môn học giảng dạy", "Liệt kê các môn học, trình độ và nhóm học viên phù hợp.", "Thêm môn học"],
    ["work_history", "Kinh nghiệm", "Nêu bật kinh nghiệm dạy học, bằng cấp và chứng chỉ.", "Thêm kinh nghiệm"],
  ];

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {cards.map(([icon, title, text, action]) => (
        <Link
          className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--outline-variant)] bg-white p-6 text-center transition hover:border-[var(--primary)] hover:bg-[var(--primary-fixed)]"
          href="/tutor/onboarding"
          key={title}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-container-high)] text-[var(--primary)]">
            <Icon name={icon} className="text-[32px]" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--on-surface-variant)]">{text}</p>
          </div>
          <span className="text-xs font-bold uppercase text-[var(--primary)]">{action}</span>
        </Link>
      ))}
    </section>
  );
}

function IdentityCard({ profile, status }: { profile: TutorProfile; status: TutorVerificationStatus }) {
  const color = status === "REJECTED" ? "bg-[var(--error)]" : status === "APPROVED" ? "bg-[var(--tertiary)]" : "bg-[var(--secondary)]";
  const location = [profile.locationDistrict, profile.locationCity].filter(Boolean).join(", ") || "Chưa cập nhật";
  const initial = profile.fullName.trim().charAt(0).toUpperCase() || "G";

  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 text-center shadow-sm">
      <div className="relative mx-auto mb-4 h-32 w-32">
        <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-[var(--surface)] bg-[var(--surface-container-highest)] text-5xl font-bold text-[var(--primary)]">
          {profile.avatarUrl ? <img alt={profile.fullName} className="h-full w-full object-cover" src={profile.avatarUrl} /> : initial}
        </div>
        <div className={`absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-white ${color}`}>
          <Icon name={status === "APPROVED" ? "verified" : status === "REJECTED" ? "priority_high" : "hourglass_empty"} fill className="text-[16px]" />
        </div>
      </div>
      <h3 className="text-2xl font-semibold">{profile.fullName}</h3>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{profile.headline ?? "Chưa cập nhật tiêu đề"}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {(profile.subjects.length ? profile.subjects.slice(0, 3).map((item) => item.subject.name) : ["Chưa cập nhật"]).map((item) => (
          <span className="rounded-full bg-[var(--surface-container)] px-3 py-1 text-xs font-semibold text-[var(--on-surface-variant)]" key={item}>
            {item}
          </span>
        ))}
      </div>
      <div className="my-5 h-px bg-[var(--outline-variant)]" />
      <div className="space-y-3 text-left text-sm">
        <InfoLine icon="mail" text={profile.email} />
        <InfoLine icon="call" text={profile.phone ?? "Chưa cập nhật"} />
        <InfoLine icon="location_on" text={location} />
      </div>
    </div>
  );
}

function ProfileLoading() {
  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 text-sm font-semibold text-[var(--on-surface-variant)] shadow-sm">
      Đang tải dữ liệu hồ sơ từ database...
    </section>
  );
}

function BioCard({ profile }: { profile: TutorProfile }) {
  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <h3 className="mb-3 text-xl font-semibold">Giới thiệu bản thân</h3>
      <p className="text-sm leading-7 text-[var(--on-surface-variant)]">
        {profile.bio ?? "Chưa cập nhật phần giới thiệu bản thân."}
      </p>
    </section>
  );
}

function StatsGrid({ profile }: { profile: TutorProfile }) {
  const location = [profile.locationDistrict, profile.locationCity].filter(Boolean).join(", ") || "Chưa cập nhật";
  const stats = [
    ["school", "Kinh nghiệm", `${profile.experienceYears ?? 0} năm`],
    ["payments", "Mức học phí", profile.hourlyRate ? `${new Intl.NumberFormat("vi-VN").format(Number(profile.hourlyRate))}đ/giờ` : "Chưa cập nhật"],
    ["cast_for_education", "Hình thức dạy", teachingModeLabel(profile.teachingMode)],
    ["location_on", "Khu vực", location],
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(([icon, label, value]) => (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-white p-4 shadow-sm" key={label}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-[var(--primary)]">
            <Icon name={icon} />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--on-surface-variant)]">{label}</p>
            <p className="text-base font-semibold">{value}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function SubjectsCard({ profile }: { profile: TutorProfile }) {
  const subjects = profile.subjects.length
    ? profile.subjects.map((item) => `${item.subject.name} - ${subjectLevelLabel(item.level)}`)
    : ["Chưa cập nhật môn học"];

  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <Icon name="menu_book" className="text-[var(--primary)]" />
        Môn học giảng dạy
      </h3>
      <div className="flex flex-wrap gap-2">
        {subjects.map((item) => (
          <span className="rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] px-4 py-2 text-sm font-semibold" key={item}>
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function DocumentsCard({ documents, status }: { documents: TutorDocument[]; status: TutorVerificationStatus }) {
  return (
    <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-semibold">
            <Icon name="verified_user" className="text-[var(--primary)]" />
            Tài liệu xác minh
          </h3>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Các tài liệu dùng để xác thực hồ sơ gia sư.</p>
        </div>
        {status === "REJECTED" ? (
          <span className="w-fit rounded-full border border-[var(--error)] bg-[var(--error-container)] px-3 py-1 text-xs font-bold text-[var(--error)]">
            Cần cập nhật
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {documents.length ? documents.map((doc) => (
          <div
            className={[
              "rounded-xl border p-4",
              doc.status === "REJECTED" ? "border-[var(--error)] bg-[var(--error-container)]/30" : "border-[var(--outline-variant)] bg-white",
            ].join(" ")}
            key={doc.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <Icon name={doc.type.includes("ID") ? "badge" : "history_edu"} className={doc.status === "REJECTED" ? "text-[var(--error)]" : "text-[var(--primary)]"} />
                <div>
                  <h4 className="text-sm font-bold">{documentLabel(doc.type)}</h4>
                  <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{doc.fileName}</p>
                </div>
              </div>
              <Icon name={doc.status === "REJECTED" ? "error" : doc.status === "APPROVED" ? "check_circle" : "hourglass_empty"} fill={doc.status !== "PENDING"} className={doc.status === "REJECTED" ? "text-[var(--error)]" : "text-[var(--tertiary)]"} />
            </div>
            <p className={["mt-3 text-sm font-medium", doc.status === "REJECTED" ? "text-[var(--error)]" : "text-[var(--on-surface-variant)]"].join(" ")}>
              {doc.status === "REJECTED" ? `Bị từ chối: ${doc.rejectionReason}` : doc.status === "APPROVED" ? "Đã duyệt" : "Đang xử lý"}
            </p>
            {doc.status === "REJECTED" ? (
              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-[var(--error)] px-4 py-2 text-sm font-bold text-white" type="button">
                <Icon name="upload" className="text-[18px]" />
                Tải lại tài liệu
              </button>
            ) : null}
          </div>
        )) : (
          <p className="col-span-full rounded-lg border border-dashed border-[var(--outline-variant)] bg-[var(--surface)] p-4 text-sm text-[var(--on-surface-variant)]">
            Chưa có tài liệu xác minh.
          </p>
        )}
      </div>
    </section>
  );
}

function InfoLine({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} className="text-[20px] text-[var(--outline)]" />
      <span>{text}</span>
    </div>
  );
}

function documentLabel(type: TutorDocument["type"]) {
  const labels: Record<TutorDocument["type"], string> = {
    NATIONAL_ID_FRONT: "CCCD mặt trước",
    NATIONAL_ID_BACK: "CCCD mặt sau",
    DEGREE: "Bằng cấp",
    CERTIFICATE: "Chứng chỉ",
    BACKGROUND_CHECK: "Lý lịch tư pháp",
    OTHER: "Tài liệu khác",
  };

  return labels[type];
}

function subjectLevelLabel(level: TutorProfile["subjects"][number]["level"]) {
  const labels: Record<TutorProfile["subjects"][number]["level"], string> = {
    PRIMARY: "Tiểu học",
    LOWER_SECONDARY: "Cấp 2",
    HIGH_SCHOOL: "Cấp 3",
    UNIVERSITY: "Đại học",
    BASIC: "Cơ bản",
    INTERMEDIATE: "Trung cấp",
    ADVANCED: "Nâng cao",
    EXAM_PREP: "Luyện thi",
  };

  return labels[level];
}

function teachingModeLabel(mode: TutorProfile["teachingMode"]) {
  if (mode === "ONLINE") return "Online";
  if (mode === "OFFLINE") return "Offline";
  return "Online/Offline";
}
