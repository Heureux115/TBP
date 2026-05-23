"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getCurrentUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    getCurrentUser(token)
      .then(({ user }) => {
        if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
          router.replace("/admin/dashboard");
          return;
        }

        if (user.role === "TUTOR") {
          router.replace("/tutor/dashboard");
          return;
        }

        router.replace("/");
      })
      .catch(() => {
        clearTokens();
        router.replace("/login");
      });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] text-sm text-[var(--on-surface-variant)]">
      Đang mở dashboard...
    </main>
  );
}
