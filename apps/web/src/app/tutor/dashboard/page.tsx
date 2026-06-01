"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell, Icon } from "@/components/tutor/dashboard-shell";
import { getAccessToken } from "@/lib/auth-storage";
import { getMyTutorProfile, type TutorProfile } from "@/lib/tutor-api";
import { createWithdrawal, getMyWallet, type TutorWallet } from "@/lib/wallet-api";

const statusLabel = {
  DRAFT: "Chưa hoàn thiện",
  PENDING_REVIEW: "Đang chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Cần chỉnh sửa",
};

export default function TutorDashboardPage() {
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const [wallet, setWallet] = useState<TutorWallet | null>(null);
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
  });
  const [walletMessage, setWalletMessage] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      return;
    }

    getMyTutorProfile(token).then(setProfile).catch(() => undefined);
    getMyWallet(token).then(setWallet).catch(() => undefined);
  }, []);

  async function handleWithdrawal() {
    const token = getAccessToken();
    if (!token) return;

    setIsWithdrawing(true);
    setWalletMessage("");

    try {
      const updatedWallet = await createWithdrawal(token, withdrawalForm);
      setWallet(updatedWallet);
      setWithdrawalForm({
        amount: "",
        bankName: "",
        bankAccountNumber: "",
        bankAccountName: "",
      });
      setWalletMessage("Yêu cầu rút tiền đã được ghi nhận.");
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : "Không thể tạo yêu cầu rút tiền.");
    } finally {
      setIsWithdrawing(false);
    }
  }

  const completion = useMemo(() => {
    if (!profile) {
      return 0;
    }

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

  const status = profile?.verificationStatus || "DRAFT";

  return (
    <DashboardShell active="dashboard">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-8 md:px-10">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold">Tổng quan gia sư</h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              Theo dõi trạng thái hồ sơ, lịch dạy và hiệu suất nhận lớp.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-sm"
            href={status === "APPROVED" ? "/tutor/profile" : "/tutor/onboarding"}
          >
            <Icon name={status === "APPROVED" ? "visibility" : "edit"} />
            {status === "APPROVED" ? "Xem hồ sơ" : "Hoàn thiện hồ sơ"}
          </Link>
        </header>

        <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--primary)]">
                <Icon name="verified_user" className="text-[16px]" />
                {statusLabel[status]}
              </div>
              <h2 className="text-2xl font-bold">{profile?.headline || "Hồ sơ gia sư của bạn"}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--on-surface-variant)]">
                {status === "APPROVED"
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
          <Metric icon="payments" label="Số dư có thể rút" value={formatMoney(wallet?.availableBalance || "0")} note="Từ các buổi học đã hoàn tất" />
          <Metric icon="star" label="Đánh giá" value="-" note="Chưa có đánh giá" />
          <Metric icon="menu_book" label="Môn giảng dạy" value={String(profile?.subjects.length || 0)} note="Đã khai báo" />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="mb-4 text-xl font-bold">Việc cần làm</h3>
            <div className="space-y-3">
              <Task done={Boolean(profile?.headline && profile.bio)} label="Hoàn thiện thông tin cơ bản" href="/tutor/onboarding" />
              <Task done={(profile?.subjects.length || 0) > 0} label="Thêm môn học giảng dạy" href="/tutor/onboarding" />
              <Task done={(profile?.documents.length || 0) >= 3} label="Tải tài liệu xác minh" href="/tutor/onboarding" />
              <Task done={status === "APPROVED"} label="Chờ admin duyệt hồ sơ" href="/tutor/profile" />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-bold">Liên kết nhanh</h3>
            <div className="flex flex-col gap-3">
              <QuickLink href="/tutor/profile" icon="person" label="Hồ sơ gia sư" />
              <QuickLink href="/tutor/onboarding" icon="edit_document" label="Chỉnh sửa onboarding" />
              <QuickLink href="/bookings" icon="event_available" label="Quản lý lịch dạy" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h3 className="text-xl font-bold">Ví gia sư</h3>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  Doanh thu 85% của gia sư được cộng vào ví sau khi buổi học hoàn tất.
                </p>
              </div>
              <div className="rounded-lg bg-[var(--surface-container-low)] px-4 py-3 text-right">
                <p className="text-xs font-bold uppercase text-[var(--outline)]">Có thể rút</p>
                <p className="text-2xl font-black text-[var(--primary)]">{formatMoney(wallet?.availableBalance || "0")}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Số tiền" value={withdrawalForm.amount} onChange={(amount) => setWithdrawalForm((form) => ({ ...form, amount }))} placeholder="500000" />
              <Input label="Ngân hàng" value={withdrawalForm.bankName} onChange={(bankName) => setWithdrawalForm((form) => ({ ...form, bankName }))} placeholder="VCB" />
              <Input label="Số tài khoản" value={withdrawalForm.bankAccountNumber} onChange={(bankAccountNumber) => setWithdrawalForm((form) => ({ ...form, bankAccountNumber }))} placeholder="0123456789" />
              <Input label="Tên chủ tài khoản" value={withdrawalForm.bankAccountName} onChange={(bankAccountName) => setWithdrawalForm((form) => ({ ...form, bankAccountName }))} placeholder="NGUYEN VAN A" />
            </div>
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
              disabled={isWithdrawing}
              onClick={handleWithdrawal}
              type="button"
            >
              <Icon name="account_balance" />
              {isWithdrawing ? "Đang gửi..." : "Yêu cầu rút tiền"}
            </button>
            {walletMessage ? <p className="mt-3 text-sm font-semibold text-[var(--on-surface-variant)]">{walletMessage}</p> : null}
          </div>

          <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-bold">Lịch sử rút tiền</h3>
            <div className="space-y-3">
              {wallet?.withdrawals.length ? (
                wallet.withdrawals.map((withdrawal) => (
                  <div className="rounded-lg border border-[var(--outline-variant)] p-3" key={withdrawal.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold">{formatMoney(withdrawal.amount)}</p>
                      <span className="rounded-full bg-[var(--surface-container)] px-2 py-1 text-xs font-bold text-[var(--primary)]">{withdrawal.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{withdrawal.bankName} - {maskAccount(withdrawal.bankAccountNumber)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--on-surface-variant)]">Chưa có yêu cầu rút tiền.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function formatMoney(value: string) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
}

function maskAccount(value: string) {
  return value.length <= 4 ? value : `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

function Input({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[var(--on-surface-variant)]">{label}</span>
      <input
        className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
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
