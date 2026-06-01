"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { getCurrentUser, type PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { getMyTutorProfile, type TutorProfile } from "@/lib/tutor-api";

export type DashboardRole = "admin" | "tutor" | "student";
export type DashboardSection =
  | "dashboard"
  | "tutors"
  | "students"
  | "bookings"
  | "payments"
  | "messages"
  | "profile"
  | "approvals"
  | "settings";

type NavItem = {
  href: string;
  icon: string;
  key: DashboardSection;
  label: string;
};

const ROLE_LABELS: Record<DashboardRole, { title: string; subtitle: string; defaultName: string; search: string }> = {
  admin: {
    title: "Tutor Admin",
    subtitle: "Bộ quản trị",
    defaultName: "Quản trị viên",
    search: "Tìm theo mã, người dùng hoặc nội dung...",
  },
  tutor: {
    title: "TutorConnect",
    subtitle: "Không gian gia sư",
    defaultName: "Gia sư",
    search: "Tìm lịch dạy, học sinh hoặc tin nhắn...",
  },
  student: {
    title: "TutorConnect",
    subtitle: "Không gian học viên",
    defaultName: "Học viên",
    search: "Tìm gia sư, lịch học hoặc thanh toán...",
  },
};

const NAV_BY_ROLE: Record<DashboardRole, NavItem[]> = {
  admin: [
    { key: "dashboard", href: "/admin/dashboard", icon: "dashboard", label: "Tổng quan" },
    { key: "tutors", href: "/admin/tutors", icon: "school", label: "Gia sư" },
    { key: "payments", href: "/admin/payments", icon: "payments", label: "Thanh toán" },
  ],
  tutor: [
    { key: "dashboard", href: "/tutor/dashboard", icon: "dashboard", label: "Tổng quan" },
    { key: "bookings", href: "/bookings", icon: "event_available", label: "Lịch dạy" },
    { key: "messages", href: "/messages", icon: "mail", label: "Tin nhắn" },
    { key: "payments", href: "/payments", icon: "payments", label: "Thanh toán" },
    { key: "profile", href: "/tutor/profile", icon: "settings", label: "Hồ sơ gia sư" },
  ],
  student: [
    { key: "dashboard", href: "/dashboard", icon: "dashboard", label: "Tổng quan" },
    { key: "bookings", href: "/bookings", icon: "event_available", label: "Lịch học" },
    { key: "messages", href: "/messages", icon: "mail", label: "Tin nhắn" },
    { key: "payments", href: "/payments", icon: "payments", label: "Thanh toán" },
    { key: "tutors", href: "/tutors", icon: "school", label: "Tìm gia sư" },
  ],
};

export function RoleDashboardShell({
  active,
  children,
  role,
  searchPlaceholder,
}: {
  active: DashboardSection;
  children: ReactNode;
  role: DashboardRole;
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const labels = ROLE_LABELS[role];

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    getCurrentUser(token)
      .then(({ user: currentUser }) => {
        if (!canAccessRole(currentUser.role, role)) {
          router.replace(defaultDashboardForRole(currentUser.role));
          return undefined;
        }

        setUser(currentUser);
        if (role === "tutor" && currentUser.role === "TUTOR") {
          return getMyTutorProfile(token).then(setProfile).catch(() => undefined);
        }
        return undefined;
      })
      .catch(() => {
        clearTokens();
        setUser(null);
        setProfile(null);
        router.replace("/auth/login");
      });
  }, [role, router]);

  const displayName = useMemo(() => {
    if (role === "tutor") return profile?.fullName || user?.fullName || labels.defaultName;
    return user?.fullName || labels.defaultName;
  }, [labels.defaultName, profile?.fullName, role, user?.fullName]);

  const roleText = role === "admin" ? (user?.role === "SUPER_ADMIN" ? "Quản trị cấp cao" : "Quản trị hệ thống") : labels.subtitle;
  const navItems = NAV_BY_ROLE[role];

  function handleLogout() {
    clearTokens();
    router.replace("/auth/login");
  }

  return (
    <div className="flex min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <aside className="sticky left-0 top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-6 md:flex">
        <div className="mb-9 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
            <Icon name={role === "admin" ? "admin_panel_settings" : "school"} />
          </div>
          <div className="min-w-0">
            <Link className="block truncate text-xl font-black text-[var(--primary)]" href={role === "admin" ? "/admin/dashboard" : role === "tutor" ? "/tutor/dashboard" : "/dashboard"}>
              {labels.title}
            </Link>
            <p className="text-xs font-semibold text-[var(--outline)]">{labels.subtitle}</p>
          </div>
        </div>

        <div className="mb-8 flex items-center gap-3 rounded-xl bg-white/60 p-3">
          <Avatar name={displayName} src={role === "tutor" ? profile?.avatarUrl : null} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--on-surface-variant)]">Xin chào,</p>
            <p className="truncate text-sm font-black">{displayName}</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink active={active === item.key || (active === "approvals" && item.key === "tutors")} item={item} key={item.key} />
          ))}
        </nav>

        <div className="mt-auto border-t border-[var(--outline-variant)] pt-4">
          {role === "student" ? (
            <Link className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[var(--secondary-container)] px-4 py-3 text-sm font-black text-[var(--on-secondary-container)] shadow-sm hover:opacity-90" href="/tutors">
              <Icon name="add_circle" />
              Đặt lịch học
            </Link>
          ) : null}
          {role === "admin" ? (
            <Link className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-black text-white shadow-sm hover:opacity-90" href="/admin/tutors">
              <Icon name="add_circle" />
              Duyệt hồ sơ
            </Link>
          ) : null}
          <Link className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]" href="#">
            <Icon name="help" />
            Trung tâm hỗ trợ
          </Link>
          <button className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-[var(--error)] hover:bg-[var(--error-container)]" onClick={handleLogout} type="button">
            <Icon name="logout" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-[var(--surface)] px-5 shadow-sm md:px-10">
          <div className="relative hidden w-full max-w-md sm:block">
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--outline)]" name="search" />
            <input
              className="w-full rounded-full border-none bg-[var(--surface-container-low)] py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              placeholder={searchPlaceholder || labels.search}
              type="text"
            />
          </div>
          <div className="flex flex-1 items-center justify-between gap-3 sm:flex-none sm:justify-end">
            <Link className="text-lg font-black text-[var(--primary)] md:hidden" href={role === "admin" ? "/admin/dashboard" : role === "tutor" ? "/tutor/dashboard" : "/dashboard"}>
              {labels.title}
            </Link>
            <div className="flex items-center gap-3">
              {role === "admin" ? (
                <Link className="rounded-full p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]" href="/admin/tutors" aria-label="Duyệt hồ sơ">
                  <Icon name="verified_user" />
                </Link>
              ) : (
                <Link className="rounded-full p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]" href="/messages" aria-label="Tin nhắn">
                  <Icon name="chat" />
                </Link>
              )}
              <button className="relative rounded-full p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]" type="button" aria-label="Thông báo">
                <Icon name="notifications" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--error)]" />
              </button>
              <div className="hidden h-8 w-px bg-[var(--outline-variant)] sm:block" />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-black leading-none">{displayName}</p>
                <p className="text-xs font-semibold text-[var(--outline)]">{roleText}</p>
              </div>
              <Avatar name={displayName} src={role === "tutor" ? profile?.avatarUrl : null} />
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function canAccessRole(userRole: PublicUser["role"], dashboardRole: DashboardRole) {
  if (dashboardRole === "admin") return userRole === "ADMIN" || userRole === "SUPER_ADMIN";
  if (dashboardRole === "tutor") return userRole === "TUTOR";
  return userRole === "STUDENT";
}

function defaultDashboardForRole(userRole: PublicUser["role"]) {
  if (userRole === "ADMIN" || userRole === "SUPER_ADMIN") return "/admin/dashboard";
  if (userRole === "TUTOR") return "/tutor/dashboard";
  return "/dashboard";
}

function NavLink({ active, item }: { active: boolean; item: NavItem }) {
  return (
    <Link
      className={[
        "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition",
        active ? "bg-[var(--primary)] text-white shadow-sm" : "text-[var(--on-surface-variant)] hover:translate-x-1 hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]",
      ].join(" ")}
      href={item.href}
    >
      <Icon fill={active} name={item.icon} />
      {item.label}
    </Link>
  );
}

export function Icon({ name, fill = false, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return <span className={["material-symbols-outlined", fill ? "icon-fill" : "", className].join(" ")}>{name}</span>;
}

export function Avatar({ name, src, className = "" }: { name: string; src?: string | null; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-fixed)] text-sm font-black text-[var(--primary)] ${className}`}>
      {src ? <img alt={name} className="h-full w-full object-cover" src={src} /> : initial}
    </div>
  );
}
