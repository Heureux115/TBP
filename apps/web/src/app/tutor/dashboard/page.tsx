"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell, Icon } from "@/components/tutor/dashboard-shell";
import { getAccessToken } from "@/lib/auth-storage";
import { getMyTutorProfile, type TutorProfile } from "@/lib/tutor-api";
import { mockTutorProfile } from "@/components/tutor/mock-data";

const statusLabel = {
  DRAFT: "Chưa hoàn thiện",
  PENDING_REVIEW: "Đang chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Cần chỉnh sửa",
};

export default function TutorDashboardPage() {
  const [profile, setProfile] = useState<TutorProfile>(mockTutorProfile);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      return;
    }

    getMyTutorProfile(token).then(setProfile).catch(() => undefined);
  }, []);

  const completion = useMemo(() => {
    const checks = [
      profile.headline,
      profile.bio,
      profile.experienceYears,
      profile.hourlyRate,
      profile.locationCity,
      profile.locationDistrict,
      profile.subjects.length > 0,
      profile.documents.length >= 3,
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  return (
    <DashboardShell active="dashboard">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-8 md:px-10">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold">Dashboard gia sư</h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              Theo dõi trạng thái hồ sơ, lịch dạy và hiệu suất nhận lớp.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-sm"
            href={profile.verificationStatus === "APPROVED" ? "/tutor/profile" : "/tutor/onboarding"}
          >
            <Icon name={profile.verificationStatus === "APPROVED" ? "visibility" : "edit"} />
            {profile.verificationStatus === "APPROVED" ? "Xem hồ sơ" : "Hoàn thiện hồ sơ"}
          </Link>
        </header>

        <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--primary)]">
                <Icon name="verified_user" className="text-[16px]" />
                {statusLabel[profile.verificationStatus]}
              </div>
              <h2 className="text-2xl font-bold">{profile.headline ?? "Hồ sơ gia sư của bạn"}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--on-surface-variant)]">
                {profile.verificationStatus === "APPROVED"
                  ? "Hồ sơ đã được duyệt và có thể hiển thị công khai cho học viên."
                  : "Hoàn thiện thông tin, môn giảng dạy và tài liệu xác minh để admin duyệt hồ sơ."}
              </p>
            </div>
            <div className="min-w-[240px]">
              <div className="mb-2 flex justify-between text-sm font-semibold">
                <span>Hoàn thiện hồ sơ</span>
                <span className="text-[var(--primary)]">{completion}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon="event_available" label="Lịch sắp tới" value="0" note="Chưa có buổi dạy mới" />
          <Metric icon="payments" label="Thu nhập tháng này" value="0đ" note="Sẽ cập nhật sau booking" />
          <Metric icon="star" label="Đánh giá" value="-" note="Chưa có đánh giá" />
          <Metric icon="menu_book" label="Môn giảng dạy" value={String(profile.subjects.length)} note="Đã khai báo" />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="mb-4 text-xl font-bold">Việc cần làm</h3>
            <div className="space-y-3">
              <Task done={Boolean(profile.headline && profile.bio)} label="Hoàn thiện thông tin cơ bản" href="/tutor/onboarding" />
              <Task done={profile.subjects.length > 0} label="Thêm môn học giảng dạy" href="/tutor/onboarding" />
              <Task done={profile.documents.length >= 3} label="Tải tài liệu xác minh" href="/tutor/onboarding" />
              <Task done={profile.verificationStatus === "APPROVED"} label="Chờ admin duyệt hồ sơ" href="/tutor/profile" />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-bold">Liên kết nhanh</h3>
            <div className="flex flex-col gap-3">
              <QuickLink href="/tutor/profile" icon="person" label="Hồ sơ gia sư" />
              <QuickLink href="/tutor/onboarding" icon="edit_document" label="Chỉnh sửa onboarding" />
              <QuickLink href="#" icon="event_available" label="Quản lý lịch dạy" />
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function Metric({ icon, label, note, value }: { icon: string; label: string; note: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-[var(--primary)]">
        <Icon name={icon} />
      </div>
      <p className="text-sm font-semibold text-[var(--on-surface-variant)]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-[var(--on-surface-variant)]">{note}</p>
    </div>
  );
}

function Task({ done, href, label }: { done: boolean; href: string; label: string }) {
  return (
    <Link className="flex items-center justify-between rounded-lg border border-[var(--outline-variant)] p-4 hover:bg-[var(--surface-container-low)]" href={href}>
      <span className="flex items-center gap-3 text-sm font-semibold">
        <Icon name={done ? "check_circle" : "radio_button_unchecked"} fill={done} className={done ? "text-[#004a31]" : "text-[var(--outline)]"} />
        {label}
      </span>
      <Icon name="chevron_right" className="text-[20px] text-[var(--outline)]" />
    </Link>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link className="flex items-center gap-3 rounded-lg bg-[var(--surface-container-low)] px-4 py-3 text-sm font-bold text-[var(--primary)] hover:bg-[var(--surface-container-high)]" href={href}>
      <Icon name={icon} />
      {label}
    </Link>
  );
}
