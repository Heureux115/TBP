"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Avatar, Icon } from "@/components/ui";
import { getCurrentUser, type PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { getMyTutorProfile } from "@/lib/tutor-api";

export function PublicShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "guest" | "user">("checking");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      queueMicrotask(() => setSessionState("guest"));
      return;
    }

    getCurrentUser(token)
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        setSessionState("user");
        if (currentUser.role === "TUTOR") {
          return getMyTutorProfile(token).then((profile) => setAvatarUrl(profile.avatarUrl)).catch(() => undefined);
        }
        return undefined;
      })
      .catch(() => {
        clearTokens();
        setUser(null);
        setAvatarUrl(null);
        setSessionState("guest");
      });
  }, []);

  const dashboardHref = useMemo(() => {
    if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") return "/admin/dashboard";
    if (user?.role === "TUTOR") return "/tutor/dashboard";
    return "/dashboard";
  }, [user?.role]);

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <header className="fixed inset-x-0 top-0 z-[var(--z-sticky)] border-b border-[var(--outline-variant)] bg-white/95 backdrop-blur">
        <div className="flex min-h-[4.5rem] w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 2xl:px-12">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLogo className="text-[var(--primary)]" />
            <Link
              className="hidden min-h-10 items-center rounded-[var(--radius-md)] px-3 text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--surface-container-high)] md:inline-flex"
              href="/tutors"
            >
              Tìm gia sư
            </Link>
          </div>

          <nav aria-label="Điều hướng công khai" className="hidden items-center gap-2 md:flex">
            <Link
              className="min-h-10 rounded-[var(--radius-md)] px-3 py-2 text-sm font-bold text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
              href="/#how-it-works"
            >
              Cách đặt lịch
            </Link>
            {sessionState === "user" && user ? (
              <>
                <Link
                  aria-label="Tin nhắn"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
                  href="/messages"
                >
                  <Icon name="chat" />
                </Link>
                <NotificationBell buttonClassName="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]" />
                <Link
                  className="flex min-h-11 items-center gap-2 rounded-[var(--radius-full)] border border-[var(--outline-variant)] bg-white p-1 pr-3 transition hover:bg-[var(--surface-container-low)]"
                  href={dashboardHref}
                >
                  <Avatar name={user.fullName} size="sm" src={avatarUrl} />
                  <span className="hidden max-w-32 truncate text-sm font-bold text-[var(--on-surface)] lg:inline">{user.fullName}</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  className="min-h-10 rounded-[var(--radius-md)] px-3 py-2 text-sm font-bold text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
                  href="/auth/login"
                >
                  Đăng nhập
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--on-primary)] shadow-[var(--shadow-panel)] transition hover:bg-[var(--primary-container)]"
                  href="/register"
                >
                  Đăng ký làm gia sư
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <Link
              aria-label={sessionState === "user" ? "Vào dashboard" : "Đăng nhập"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
              href={sessionState === "user" ? dashboardHref : "/auth/login"}
            >
              <Icon name={sessionState === "user" ? "account_circle" : "login"} />
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--on-primary)] shadow-[var(--shadow-panel)]"
              href="/tutors"
            >
              Tìm gia sư
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="mt-12 w-full border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-10 sm:px-6 lg:px-8 2xl:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-8 md:flex-row md:items-start">
          <div className="max-w-md">
            <BrandLogo className="text-[var(--primary)]" href="/" />
            <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
              Kết nối học viên với gia sư có hồ sơ rõ ràng, lịch học dễ theo dõi và học phí minh bạch trước khi đặt.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-[var(--on-surface-variant)]">
            <Link className="hover:text-[var(--primary)]" href="/tutors">
              Tìm gia sư
            </Link>
            <Link className="hover:text-[var(--primary)]" href="/register">
              Trở thành gia sư
            </Link>
            <Link className="hover:text-[var(--primary)]" href={sessionState === "user" ? dashboardHref : "/auth/login"}>
              {sessionState === "user" ? "Vào dashboard" : "Đăng nhập"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { Icon };
