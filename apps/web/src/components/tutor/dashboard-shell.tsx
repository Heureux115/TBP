import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getCurrentUser, type PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { getMyTutorProfile, type TutorProfile } from "@/lib/tutor-api";

type NavItem = {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
};

export function DashboardShell({
  active,
  children,
  mode = "tutor",
}: {
  active: "profile" | "approvals" | "dashboard";
  children: ReactNode;
  mode?: "tutor" | "admin";
}) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [profile, setProfile] = useState<TutorProfile | null>(null);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      return;
    }

    getCurrentUser(token)
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        if (currentUser.role === "TUTOR") {
          return getMyTutorProfile(token).then(setProfile).catch(() => undefined);
        }
        return undefined;
      })
      .catch(() => {
        clearTokens();
        setUser(null);
        setProfile(null);
      });
  }, []);

  const displayName = mode === "admin" ? (user?.fullName ?? "System Admin") : (profile?.fullName ?? user?.fullName ?? "Gia sư");
  const avatarUrl = mode === "admin" ? null : profile?.avatarUrl;
  const navItems: NavItem[] =
    mode === "admin"
      ? [
          { href: "/admin/dashboard", icon: "dashboard", label: "Tổng quan", active: active === "dashboard" },
          { href: "/admin/tutors", icon: "manage_accounts", label: "Duyệt hồ sơ", active: active === "approvals" },
          { href: "/admin/tutors", icon: "school", label: "Quản lý gia sư" },
          { href: "#", icon: "payments", label: "Giao dịch" },
          { href: "#", icon: "settings", label: "Cài đặt" },
        ]
      : [
          { href: "/tutor/dashboard", icon: "dashboard", label: "Dashboard", active: active === "dashboard" },
          { href: "#", icon: "event_available", label: "Lịch dạy" },
          { href: "#", icon: "mail", label: "Tin nhắn" },
          { href: "#", icon: "payments", label: "Thanh toán" },
          { href: "/tutor/profile", icon: "settings", label: "Hồ sơ gia sư", active: active === "profile" },
        ];

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-[280px] flex-col border-r border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-6 md:flex">
        <div className="mb-10 flex items-center justify-between px-4">
          <Link className="text-2xl font-black text-[var(--primary)]" href="/">
            TutorConnect
          </Link>
          {mode === "admin" ? (
            <span className="rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--primary)]">
              Admin
            </span>
          ) : null}
        </div>

        <div className="mb-8 flex items-center gap-3 px-4">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] text-[var(--primary)]">
            {avatarUrl ? (
              <img alt={displayName} className="h-full w-full object-cover" src={avatarUrl} />
            ) : (
              <span className="material-symbols-outlined icon-fill">person</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--on-surface-variant)]">Welcome back,</p>
            <p className="truncate text-sm font-bold text-[var(--on-surface)]">
              {displayName}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <Link
              className={[
                "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition",
                item.active
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--on-surface-variant)] hover:translate-x-1 hover:bg-[var(--surface-container-high)]",
              ].join(" ")}
              href={item.href}
              key={item.label}
            >
              <span className={["material-symbols-outlined", item.active ? "icon-fill" : ""].join(" ")}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-[var(--outline-variant)] pt-4">
          <Link
            className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
            href="#"
          >
            <span className="material-symbols-outlined">help</span>
            Help Center
          </Link>
          <Link
            className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
            href="/auth/login"
          >
            <span className="material-symbols-outlined">logout</span>
            Logout
          </Link>
        </div>
      </aside>

      <main className="min-h-screen md:ml-[280px]">{children}</main>
    </div>
  );
}

export function Icon({ name, fill = false, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return (
    <span className={["material-symbols-outlined", fill ? "icon-fill" : "", className].join(" ")}>
      {name}
    </span>
  );
}
