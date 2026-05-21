"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentUser, PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";

const profileImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBAR54ZA4eH9b8EeH0yAoY2KDNthj7ZYUHbMTf33glIr6I-xxBp1G_-ryqaWql2-Sd6ZzIr72KjE2Z4PbhPy6xSkxD6ydy3m-i01koejMLlc525EhdrEDa5tfMRfPjFkwkoIhHZ2DGNn0CFS46C7Cfo6ISXlDP41c2sIyb9M5SRhBRunxWxT4PHxpcBUEgO9xJT45lqro8drZ3qPo1lqdH6Hk_JkOSzphgH95pVdkDBBIYoFFaUWnocHff4t97_en_j4PNE_-3DuH0";

export function LandingHeader() {
  const [user, setUser] = useState<PublicUser | null>(null);
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
      })
      .catch(() => {
        clearTokens();
        setUser(null);
        setSessionState("guest");
      })
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#c1c7d1] bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-6">
          <Link className="text-2xl font-bold text-[#004271]" href="/">
            TutorConnect
          </Link>
          <div className="hidden items-center rounded-full border border-[#c1c7d1] bg-[#f0f3ff] px-4 py-2 md:flex">
            <span className="mr-2 text-sm text-[#414750]">Search</span>
            <input
              className="w-48 border-none bg-transparent text-sm text-[#111c2d] outline-none placeholder:text-[#717781]"
              placeholder="Tìm kiếm môn học..."
              type="text"
            />
          </div>
        </div>

        <nav className="hidden items-center gap-4 md:flex">
          <a
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[#414750] transition hover:bg-[#dee8ff] hover:text-[#004271]"
            href="#search"
          >
            Find Tutors
          </a>
          <a
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[#414750] transition hover:bg-[#dee8ff] hover:text-[#004271]"
            href="#how-it-works"
          >
            How it Works
          </a>
          <a
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[#414750] transition hover:bg-[#dee8ff] hover:text-[#004271]"
            href="#resources"
          >
            Resources
          </a>
        </nav>

        <div className="flex min-w-32 items-center justify-end gap-3">
          {sessionState === "user" && user ? (
            <>
              <button
                aria-label="Notifications"
                className="hidden h-10 w-10 items-center justify-center rounded-full text-[#414750] transition hover:bg-[#dee8ff] hover:text-[#004271] md:inline-flex"
                type="button"
              >
                <span aria-hidden="true">🔔</span>
              </button>
              <button
                aria-label="Messages"
                className="hidden h-10 w-10 items-center justify-center rounded-full text-[#414750] transition hover:bg-[#dee8ff] hover:text-[#004271] md:inline-flex"
                type="button"
              >
                <span aria-hidden="true">💬</span>
              </button>
              <Link
                className="flex items-center gap-2 rounded-full border border-[#c1c7d1] bg-white p-1 pr-3 transition hover:bg-[#f0f3ff]"
                href="/dashboard"
              >
                <img
                  alt={user.fullName}
                  className="h-9 w-9 rounded-full object-cover"
                  src={profileImage}
                />
                <span className="hidden max-w-28 truncate text-sm font-semibold text-[#111c2d] lg:inline">
                  {user.fullName}
                </span>
              </Link>
            </>
          ) : (
            <>
              <Link
                className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-[#004271] transition hover:bg-[#dee8ff] md:inline-flex"
                href="/login"
              >
                Sign In
              </Link>
              <Link
                className="rounded-lg bg-[#004271] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d5a94]"
                href="/register"
              >
                Join as Tutor
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
