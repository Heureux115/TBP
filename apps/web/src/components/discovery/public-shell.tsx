"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--outline-variant)] bg-white/95 shadow-sm backdrop-blur">
        <div className="flex h-20 w-full items-center justify-between px-5 sm:px-8 lg:px-12 2xl:px-16">
          <div className="flex items-center gap-6">
            <Link className="text-2xl font-black text-[var(--primary)]" href="/">
              TutorConnect
            </Link>
            <Link className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--surface-container-high)] md:inline-flex" href="/tutors">
              Tìm gia sư
            </Link>
          </div>

          <nav className="hidden items-center gap-3 md:flex">
            <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]" href="/#how-it-works">
              Cách hoạt động
            </Link>
            {sessionState === "user" && user ? (
              <>
                <Link className="rounded-full p-2 text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]" href="/messages" aria-label="Tin nhắn">
                  <Icon name="chat" />
                </Link>
                <Link className="rounded-full p-2 text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]" href="/payments" aria-label="Thông báo thanh toán">
                  <Icon name="notifications" />
                </Link>
                <Link className="flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-white p-1 pr-3 transition hover:bg-[var(--surface-container-low)]" href={dashboardHref}>
                  <Avatar name={user.fullName} src={avatarUrl} />
                  <span className="hidden max-w-32 truncate text-sm font-semibold text-[var(--on-surface)] lg:inline">{user.fullName}</span>
                </Link>
              </>
            ) : (
              <>
                <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]" href="/auth/login">
                  Đăng nhập
                </Link>
                <Link className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-container)]" href="/register">
                  Đăng ký
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {children}

      <footer className="mt-12 w-full border-t border-[var(--outline-variant)] bg-[var(--surface-container-highest)] px-5 py-10 sm:px-8 lg:px-12 2xl:px-16">
        <div className="flex flex-col justify-between gap-6 md:flex-row">
          <div className="max-w-sm">
            <p className="text-xl font-black text-[var(--primary)]">TutorConnect</p>
            <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
              Kết nối học viên với gia sư đã xác thực, lịch học rõ ràng và hồ sơ minh bạch.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm font-semibold text-[var(--on-surface-variant)]">
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

function Avatar({ name, src }: { name: string; src?: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  return (
    <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-fixed)] text-sm font-bold text-[var(--primary)]">
      {src ? <img alt={name} className="h-full w-full object-cover" src={src} /> : initial}
    </span>
  );
}

export function Icon({ name, fill = false, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return <span className={["material-symbols-outlined", fill ? "icon-fill" : "", className].join(" ")}>{name}</span>;
}
