"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentUser, PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { getMyTutorProfile } from "@/lib/tutor-api";

export function LandingHeader() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "guest" | "user">(
    "checking",
  );

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
      })
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#c1c7d1] bg-white/95 shadow-sm backdrop-blur">
      <div className="flex h-20 w-full items-center justify-between px-5 sm:px-8 lg:px-12 2xl:px-16">
        <div className="flex items-center gap-6">
          <Link className="text-2xl font-bold text-[#004271]" href="/">
            TutorConnect
          </Link>
        </div>

        <nav className="hidden items-center gap-4 md:flex">
          <Link
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[#414750] transition hover:bg-[#dee8ff] hover:text-[#004271]"
            href="/tutors"
          >
            Tìm gia sư
          </Link>
          <a
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[#414750] transition hover:bg-[#dee8ff] hover:text-[#004271]"
            href="#how-it-works"
          >
            Cách hoạt động
          </a>
          <a
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[#414750] transition hover:bg-[#dee8ff] hover:text-[#004271]"
            href="#resources"
          >
            Tài nguyên
          </a>
        </nav>

        <div className="flex min-w-32 items-center justify-end gap-3">
          {sessionState === "user" && user ? (
            <>
              <button
                aria-label="Thông báo"
                className="hidden h-10 w-10 items-center justify-center rounded-full text-[#414750] transition hover:bg-[#dee8ff] hover:text-[#004271] md:inline-flex"
                type="button"
              >
                <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
              </button>
              <button
                aria-label="Tin nhắn"
                className="hidden h-10 w-10 items-center justify-center rounded-full text-[#414750] transition hover:bg-[#dee8ff] hover:text-[#004271] md:inline-flex"
                type="button"
              >
                <span className="material-symbols-outlined" aria-hidden="true">chat</span>
              </button>
              <Link
                className="flex items-center gap-2 rounded-full border border-[#c1c7d1] bg-white p-1 pr-3 transition hover:bg-[#f0f3ff]"
                href="/dashboard"
              >
                {avatarUrl ? (
                  <img alt={user.fullName} className="h-9 w-9 rounded-full object-cover" src={avatarUrl} />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d1e4ff] text-sm font-bold text-[#004271]">
                    {user.fullName.trim().charAt(0).toUpperCase() || "U"}
                  </span>
                )}
                <span className="hidden max-w-28 truncate text-sm font-semibold text-[#111c2d] lg:inline">
                  {user.fullName}
                </span>
              </Link>
            </>
          ) : (
            <>
              <Link
                className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-[#004271] transition hover:bg-[#dee8ff] md:inline-flex"
                href="/auth/login"
              >
                Đăng nhập
              </Link>
              <Link
                className="rounded-lg bg-[#004271] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d5a94]"
                href="/register"
              >
                Đăng ký làm gia sư
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
