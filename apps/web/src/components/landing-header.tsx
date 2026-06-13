"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Avatar, Icon } from "@/components/ui";
import { getCurrentUser, type PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { getMyTutorProfile } from "@/lib/tutor-api";

export function LandingHeader() {
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
      .then((result) => {
        setUser(result.user);
        setSessionState("user");
        if (result.user.role === "TUTOR") {
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

  const dashboardHref = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? "/admin/dashboard" : user?.role === "TUTOR" ? "/tutor/dashboard" : "/dashboard";

  return (
    <header className="fixed inset-x-0 top-0 z-[var(--z-sticky)] border-b border-[var(--outline-variant)] bg-white/95 backdrop-blur">
      <div className="flex min-h-[4.5rem] w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex min-w-0 items-center gap-4">
          <BrandLogo className="text-[var(--primary)]" />
        </div>

        <nav aria-label="Điều hướng trang chủ" className="hidden items-center gap-2 md:flex">
          <Link
            className="min-h-10 rounded-[var(--radius-md)] px-3 py-2 text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--surface-container-high)]"
            href="/tutors"
          >
            Tìm gia sư
          </Link>
          <a
            className="min-h-10 rounded-[var(--radius-md)] px-3 py-2 text-sm font-bold text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
            href="#how-it-works"
          >
            Cách đặt lịch
          </a>
          <a
            className="min-h-10 rounded-[var(--radius-md)] px-3 py-2 text-sm font-bold text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
            href="#resources"
          >
            Cho phụ huynh & gia sư
          </a>
        </nav>

        <div className="flex min-w-32 items-center justify-end gap-2">
          {sessionState === "user" && user ? (
            <>
              <NotificationBell buttonClassName="relative hidden h-11 w-11 items-center justify-center rounded-full text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)] md:inline-flex" />
              <Link
                aria-label="Tin nhắn"
                className="hidden h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)] md:inline-flex"
                href="/messages"
              >
                <Icon name="chat" />
              </Link>
              <Link
                className="flex min-h-11 items-center gap-2 rounded-[var(--radius-full)] border border-[var(--outline-variant)] bg-white p-1 pr-3 transition hover:bg-[var(--surface-container-low)]"
                href={dashboardHref}
              >
                <Avatar name={user.fullName} size="sm" src={avatarUrl} />
                <span className="hidden max-w-28 truncate text-sm font-bold text-[var(--on-surface)] lg:inline">{user.fullName}</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                className="hidden min-h-10 rounded-[var(--radius-md)] px-3 py-2 text-sm font-bold text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)] md:inline-flex"
                href="/auth/login"
              >
                Đăng nhập
              </Link>
              <Link
                className="hidden min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--primary)] shadow-[var(--shadow-panel)] transition hover:border-[var(--primary)] hover:bg-[var(--surface-container-low)] sm:inline-flex"
                href="/register"
              >
                Đăng ký làm gia sư
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-[var(--on-primary)] shadow-[var(--shadow-panel)] transition hover:bg-[var(--primary-container)]"
                href="/tutors"
              >
                Tìm gia sư
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
