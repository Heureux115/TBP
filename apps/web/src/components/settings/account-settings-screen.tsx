"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RoleDashboardShell, type DashboardRole } from "@/components/layouts/role-dashboard-shell";
import { Avatar, Button, Card, Icon, StatusBadge } from "@/components/ui";
import { changeAccountPassword, updateAccountProfile, uploadAccountAvatar } from "@/lib/account-api";
import { getCurrentUser, type PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";

export function AccountSettingsScreen({ role }: { role: DashboardRole }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const avatarPreviewUrl = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : null), [avatarFile]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    getCurrentUser(token)
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        setFullName(currentUser.fullName);
        setPhone(currentUser.phone || "");
      })
      .catch(() => clearTokens());
  }, []);

  useEffect(() => {
    if (!avatarPreviewUrl) return undefined;
    return () => URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl]);

  const avatarPreview = avatarPreviewUrl || user?.avatarUrl || null;

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token || busy) return;

    setBusy("profile");
    setError("");
    setMessage("");
    try {
      let nextUser = (await updateAccountProfile(token, { fullName, phone: phone || undefined })).user;
      if (avatarFile) {
        nextUser = (await uploadAccountAvatar(token, avatarFile)).user;
        setAvatarFile(null);
      }
      setUser(nextUser);
      window.dispatchEvent(new CustomEvent("account:updated", { detail: nextUser }));
      setMessage("Đã cập nhật thông tin tài khoản.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể cập nhật tài khoản.");
    } finally {
      setBusy("");
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token || busy) return;

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setBusy("password");
    setError("");
    setMessage("");
    try {
      await changeAccountPassword(token, { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Đã đổi mật khẩu. Phiên hiện tại vẫn được giữ.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể đổi mật khẩu.");
    } finally {
      setBusy("");
    }
  }

  return (
    <RoleDashboardShell active="settings" role={role}>
      <section className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        <header>
          <p className="text-sm font-black uppercase text-[var(--on-surface-variant)]">Tài khoản</p>
          <h1 className="mt-2 text-3xl font-black text-[var(--primary)]">Cài đặt tài khoản</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--on-surface-variant)]">
            Cập nhật tên hiển thị, ảnh đại diện và mật khẩu dùng cho TutorConnect.
          </p>
        </header>

        {error ? <div className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-bold text-[var(--status-danger-text)]">{error}</div> : null}
        {message ? <div className="rounded-[var(--radius-md)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm font-bold text-[var(--status-success-text)]">{message}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <Card>
            <form className="space-y-5" onSubmit={handleProfileSubmit}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar name={fullName || user?.email || "TC"} size="xl" src={avatarPreview} />
                <div className="min-w-0">
                  <h2 className="text-xl font-black text-[var(--on-surface)]">Thông tin cá nhân</h2>
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Ảnh và tên này sẽ xuất hiện trong tin nhắn, lịch học và hồ sơ liên quan.</p>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--primary)]">
                    <Icon name="photo_camera" />
                    Chọn ảnh
                    <input accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} type="file" />
                  </label>
                  {avatarFile ? (
                    <p className="mt-2 text-xs font-bold text-[var(--tertiary)]">
                      Đã chọn {avatarFile.name}. Bấm “Lưu thay đổi” để cập nhật ảnh đại diện.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Họ và tên" onChange={setFullName} required value={fullName} />
                <Field label="Số điện thoại" onChange={setPhone} value={phone} />
              </div>

              <Button isLoading={busy === "profile"} leftIcon={<Icon name="save" />} type="submit">
                Lưu thay đổi
              </Button>
            </form>
          </Card>

          <Card>
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Đổi mật khẩu</h2>
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">Phiên hiện tại vẫn được giữ sau khi đổi mật khẩu.</p>
                </div>
                <StatusBadge tone="info">Bảo mật</StatusBadge>
              </div>
              <PasswordField label="Mật khẩu hiện tại" onChange={setCurrentPassword} value={currentPassword} />
              <PasswordField label="Mật khẩu mới" onChange={setNewPassword} value={newPassword} />
              <PasswordField label="Xác nhận mật khẩu mới" onChange={setConfirmPassword} value={confirmPassword} />
              <Button className="w-full" isLoading={busy === "password"} leftIcon={<Icon name="lock_reset" />} type="submit">
                Cập nhật mật khẩu
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </RoleDashboardShell>
  );
}

function Field({ label, onChange, required = false, value }: { label: string; onChange: (value: string) => void; required?: boolean; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[var(--on-surface)]">{label}</span>
      <input
        className="mt-2 min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-4 text-sm font-semibold outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
    </label>
  );
}

function PasswordField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[var(--on-surface)]">{label}</span>
      <input
        className="mt-2 min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-4 text-sm font-semibold outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
        minLength={8}
        onChange={(event) => onChange(event.target.value)}
        required
        type="password"
        value={value}
      />
    </label>
  );
}
