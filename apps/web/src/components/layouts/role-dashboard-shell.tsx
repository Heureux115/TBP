"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Avatar, Badge, Button, Icon } from "@/components/ui";
import { getCurrentUser, type PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { getMyNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem } from "@/lib/notification-api";
import { getMyTutorProfile, type TutorProfile } from "@/lib/tutor-api";

export type DashboardRole = "admin" | "tutor" | "student";
export type DashboardSection =
  | "dashboard"
  | "tutors"
  | "students"
  | "bookings"
  | "bookingRequests"
  | "payments"
  | "messages"
  | "reviews"
  | "profile"
  | "approvals"
  | "settings";

type NavItem = {
  href: string;
  icon: string;
  key: DashboardSection;
  label: string;
};

const ROLE_LABELS: Record<
  DashboardRole,
  { action?: { href: string; icon: string; label: string; variant: "payment" | "primary" | "secondary" }; defaultName: string; search: string; subtitle: string; title: string }
> = {
  admin: {
    action: { href: "/admin/tutors", icon: "verified_user", label: "Duyệt hồ sơ", variant: "primary" },
    defaultName: "Quản trị viên",
    search: "Tìm mã, người dùng hoặc nội dung...",
    subtitle: "Bộ quản trị",
    title: "Tutor Admin",
  },
  tutor: {
    defaultName: "Gia sư",
    search: "Tìm lịch dạy, học sinh hoặc tin nhắn...",
    subtitle: "Không gian gia sư",
    title: "TutorConnect",
  },
  student: {
    action: { href: "/tutors", icon: "event_available", label: "Đặt lịch học", variant: "payment" },
    defaultName: "Học viên",
    search: "Tìm gia sư, lịch học hoặc thanh toán...",
    subtitle: "Không gian học viên",
    title: "TutorConnect",
  },
};

const NAV_BY_ROLE: Record<DashboardRole, NavItem[]> = {
  admin: [
    { key: "dashboard", href: "/admin/dashboard", icon: "dashboard", label: "Tổng quan" },
    { key: "tutors", href: "/admin/tutors", icon: "school", label: "Gia sư" },
    { key: "students", href: "/admin/students", icon: "groups", label: "Học viên" },
    { key: "bookings", href: "/admin/bookings", icon: "event_available", label: "Booking" },
    { key: "payments", href: "/admin/payments", icon: "payments", label: "Thanh toán" },
    { key: "settings", href: "/admin/settings", icon: "settings", label: "Cài đặt" },
  ],
  tutor: [
    { key: "dashboard", href: "/tutor/dashboard", icon: "dashboard", label: "Tổng quan" },
    { key: "bookings", href: "/tutor/schedule", icon: "event_available", label: "Lịch dạy" },
    { key: "bookingRequests", href: "/tutor/booking-requests", icon: "fact_check", label: "Quản lý lịch" },
    { key: "reviews", href: "/tutor/reviews", icon: "star", label: "Đánh giá" },
    { key: "messages", href: "/messages", icon: "mail", label: "Tin nhắn" },
    { key: "payments", href: "/payments", icon: "payments", label: "Thanh toán" },
    { key: "profile", href: "/tutor/profile", icon: "badge", label: "Hồ sơ" },
    { key: "settings", href: "/tutor/settings", icon: "settings", label: "Cài đặt" },
  ],
  student: [
    { key: "dashboard", href: "/dashboard", icon: "dashboard", label: "Tổng quan" },
    { key: "bookings", href: "/bookings", icon: "event_available", label: "Lịch học" },
    { key: "messages", href: "/messages", icon: "mail", label: "Tin nhắn" },
    { key: "payments", href: "/payments", icon: "payments", label: "Thanh toán" },
    { key: "tutors", href: "/tutors", icon: "school", label: "Tìm gia sư" },
    { key: "settings", href: "/settings", icon: "settings", label: "Cài đặt" },
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
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [authorizedRole, setAuthorizedRole] = useState<DashboardRole | null>(null);
  const labels = ROLE_LABELS[role];
  const authChecked = authorizedRole === role;

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
        setAuthorizedRole(role);
        getMyNotifications(token)
          .then((result) => {
            setUnreadNotifications(result.unreadCount);
            setNotifications(result.items);
          })
          .catch(() => undefined);
        if (role === "tutor" && currentUser.role === "TUTOR") {
          return getMyTutorProfile(token).then(setProfile).catch(() => undefined);
        }
        return undefined;
      })
      .catch(() => {
        clearTokens();
        setUser(null);
        setProfile(null);
        setAuthorizedRole(null);
        router.replace("/auth/login");
      });
  }, [role, router]);

  useEffect(() => {
    function handleAccountUpdated(event: Event) {
      const nextUser = (event as CustomEvent<PublicUser>).detail;
      if (nextUser?.id) {
        setUser(nextUser);
      }
    }

    window.addEventListener("account:updated", handleAccountUpdated);
    return () => window.removeEventListener("account:updated", handleAccountUpdated);
  }, []);

  const displayName = useMemo(() => {
    if (role === "tutor") return profile?.fullName || user?.fullName || labels.defaultName;
    return user?.fullName || labels.defaultName;
  }, [labels.defaultName, profile?.fullName, role, user?.fullName]);

  const roleText = role === "admin" ? (user?.role === "SUPER_ADMIN" ? "Quản trị cấp cao" : "Quản trị hệ thống") : labels.subtitle;
  const navItems = NAV_BY_ROLE[role];
  const mobileNavItems = role === "admin" ? navItems.filter((item) => item.key !== "students") : navItems;

  function handleLogout() {
    clearTokens();
    router.replace("/auth/login");
  }

  async function refreshNotifications() {
    const token = getAccessToken();
    if (!token) return;

    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const result = await getMyNotifications(token);
      setUnreadNotifications(result.unreadCount);
      setNotifications(result.items);
    } catch (requestError) {
      setNotificationsError(requestError instanceof Error ? requestError.message : "Không thể tải thông báo.");
    } finally {
      setNotificationsLoading(false);
    }
  }

  function handleToggleNotifications() {
    setNotificationsOpen((currentOpen) => {
      const nextOpen = !currentOpen;
      if (nextOpen) {
        void refreshNotifications();
      }
      return nextOpen;
    });
  }

  async function handleReadNotification(item: NotificationItem) {
    const token = getAccessToken();
    if (!token) return;

    if (!item.readAt) {
      try {
        const updated = await markNotificationRead(token, item.id);
        setNotifications((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
        setUnreadNotifications((count) => Math.max(0, count - 1));
      } catch {
        return;
      }
    }

    if (item.actionUrl) {
      setNotificationsOpen(false);
      router.push(item.actionUrl);
    }
  }

  async function handleReadAllNotifications() {
    const token = getAccessToken();
    if (!token || notificationsLoading) return;

    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const result = await markAllNotificationsRead(token);
      setUnreadNotifications(result.unreadCount);
      setNotifications(result.items);
    } catch (requestError) {
      setNotificationsError(requestError instanceof Error ? requestError.message : "Không thể cập nhật thông báo.");
    } finally {
      setNotificationsLoading(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--on-surface-variant)]">
        Đang mở không gian làm việc...
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <aside className="sticky left-0 top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-5 lg:flex">
        <div className="flex items-center justify-between gap-3 px-2 pb-5">
          <BrandLogo className="text-[var(--primary)]" href="/" label={labels.title} subtitle={labels.subtitle} />
        </div>

        <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 shadow-[var(--shadow-panel)]">
          <div className="flex items-center gap-3">
            <Avatar name={displayName} size="md" src={user?.avatarUrl || (role === "tutor" ? profile?.avatarUrl : null)} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Xin chào</p>
              <p className="truncate text-sm font-black text-[var(--on-surface)]">{displayName}</p>
            </div>
          </div>
          <Badge className="mt-3 max-w-full" tone={role === "admin" ? "warning" : role === "tutor" ? "success" : "info"}>
            <span className="truncate">{roleText}</span>
          </Badge>
        </div>

        <nav aria-label={`Điều hướng ${labels.subtitle}`} className="flex flex-1 flex-col gap-1.5">
          {navItems.map((item) => (
            <NavLink active={active === item.key || (active === "approvals" && item.key === "tutors")} item={item} key={item.key} />
          ))}
        </nav>

        <div className="mt-5 border-t border-[var(--outline-variant)] pt-4">
          {labels.action ? (
            <Link
              className={[
                "mb-3 flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-bold transition-[background-color,color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)]",
                labels.action.variant === "payment"
                  ? "bg-[var(--secondary-container)] text-[var(--on-secondary-container)] shadow-[var(--shadow-panel)] hover:bg-[var(--secondary)] hover:text-[var(--on-secondary)]"
                  : "bg-[var(--primary)] text-[var(--on-primary)] shadow-[var(--shadow-panel)] hover:bg-[var(--primary-container)]",
              ].join(" ")}
              href={labels.action.href}
            >
              <Icon name={labels.action.icon} />
              {labels.action.label}
            </Link>
          ) : null}
          <Link
            className="flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-bold text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
            href="#"
          >
            <Icon name="help" />
            Trung tâm hỗ trợ
          </Link>
          <Button className="mt-1 w-full justify-start px-3" leftIcon={<Icon name="logout" />} onClick={handleLogout} variant="danger">
            Đăng xuất
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
        <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--outline-variant)] bg-[var(--surface)]/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1">
              <BrandLogo className="text-[var(--primary)] lg:hidden" href="/" label={labels.title} subtitle={labels.subtitle} />
              <div className="relative hidden max-w-xl lg:block">
                <Icon className="absolute left-3 top-1/2 text-[var(--outline)] -translate-y-1/2" name="search" />
                <input
                  aria-label="Tìm kiếm trong không gian làm việc"
                  className="min-h-11 w-full rounded-[var(--radius-full)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-2 pl-10 pr-4 text-sm font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
                  placeholder={searchPlaceholder || labels.search}
                  type="search"
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {role === "admin" ? (
                <TopbarIconLink href="/admin/tutors" label="Duyệt hồ sơ" name="verified_user" />
              ) : (
                <TopbarIconLink href="/messages" label="Tin nhắn" name="chat" />
              )}
              <div
                className="relative"
                onKeyDown={(event) => {
                  if (event.key === "Escape" && notificationsOpen) {
                    event.preventDefault();
                    setNotificationsOpen(false);
                  }
                }}
              >
                <button
                  aria-controls={notificationsOpen ? `${role}-notifications-panel` : undefined}
                  aria-expanded={notificationsOpen}
                  aria-label="Thông báo"
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)] focus-visible:shadow-[var(--focus-ring)]"
                  data-testid={`${role}-notifications-button`}
                  onClick={handleToggleNotifications}
                  type="button"
                >
                  <Icon name="notifications" />
                  {unreadNotifications ? (
                    <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-full)] bg-[var(--error)] px-1 text-[10px] font-black leading-none text-white">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  ) : null}
                </button>
                {notificationsOpen ? (
                  <>
                    <button
                      aria-label="Đóng thông báo"
                      className="fixed inset-0 z-[var(--z-dropdown)] cursor-default bg-black/10 sm:bg-transparent"
                      onClick={() => setNotificationsOpen(false)}
                      type="button"
                    />
                  <section
                    aria-label="Thông báo"
                    className="absolute right-0 top-14 z-[calc(var(--z-dropdown)+1)] w-[min(92vw,400px)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[var(--shadow-popover)]"
                    data-testid={`${role}-notifications-panel`}
                    id={`${role}-notifications-panel`}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-[var(--outline-variant)] px-4 py-3">
                      <div className="min-w-0">
                        <h2 className="text-sm font-black text-[var(--on-surface)]">Thông báo</h2>
                        <p className="mt-0.5 text-xs font-semibold text-[var(--on-surface-variant)]">{unreadNotifications ? `${unreadNotifications} chưa đọc` : "Không có thông báo mới"}</p>
                      </div>
                      <button
                        className="rounded-[var(--radius-md)] px-3 py-2 text-xs font-black text-[var(--primary)] transition hover:bg-[var(--surface-container-low)] disabled:opacity-50"
                        disabled={!unreadNotifications || notificationsLoading}
                        onClick={handleReadAllNotifications}
                        type="button"
                      >
                        Đọc tất cả
                      </button>
                    </div>
                    {notificationsError ? <p className="m-3 rounded-[var(--radius-md)] bg-[var(--error-container)] p-3 text-xs font-bold text-[var(--error)]">{notificationsError}</p> : null}
                    <div className="max-h-[min(60vh,420px)] overflow-y-auto">
                      {notificationsLoading && !notifications.length ? (
                        <p className="p-5 text-sm font-semibold text-[var(--on-surface-variant)]">Đang tải thông báo...</p>
                      ) : notifications.length ? (
                        notifications.map((item) => (
                          <button
                            className={[
                              "flex w-full gap-3 border-b border-[var(--outline-variant)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[var(--surface-container-low)]",
                              item.readAt ? "bg-white" : "bg-[var(--primary-fixed)]/45",
                            ].join(" ")}
                            key={item.id}
                            onClick={() => handleReadNotification(item)}
                            type="button"
                          >
                            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? "bg-[var(--outline-variant)]" : "bg-[var(--primary)]"}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black text-[var(--on-surface)]">{item.title}</span>
                              <span className="mt-1 block line-clamp-2 text-xs leading-5 text-[var(--on-surface-variant)]">{item.body}</span>
                              <span className="mt-2 block text-[11px] font-bold text-[var(--outline)]">{formatNotificationTime(item.createdAt)}</span>
                            </span>
                            {item.actionUrl ? <Icon className="mt-4 text-base text-[var(--outline)]" name="chevron_right" /> : null}
                          </button>
                        ))
                      ) : (
                        <p className="p-5 text-sm font-semibold text-[var(--on-surface-variant)]">Chưa có thông báo nào.</p>
                      )}
                    </div>
                  </section>
                  </>
                ) : null}
              </div>
              <div className="hidden h-8 w-px bg-[var(--outline-variant)] sm:block" />
              <div className="hidden min-w-0 text-right sm:block">
                <p className="max-w-40 truncate text-sm font-black leading-none text-[var(--on-surface)]">{displayName}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--outline)]">{roleText}</p>
              </div>
              <Avatar name={displayName} size="md" src={user?.avatarUrl || (role === "tutor" ? profile?.avatarUrl : null)} />
            </div>
          </div>
        </header>
        <div className={active === "messages" ? "w-full flex-1" : "w-full flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8"}>{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-[var(--outline-variant)] bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[var(--shadow-bottom-nav)] backdrop-blur lg:hidden">
        <div className={["mx-auto grid gap-1", mobileNavItems.length > 5 ? "max-w-xl grid-cols-6" : "max-w-lg grid-cols-5"].join(" ")}>
          {mobileNavItems.slice(0, 6).map((item) => {
            const isActive = active === item.key || (active === "approvals" && item.key === "tutors");

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] px-1 py-2 text-[10px] font-black leading-tight transition",
                  isActive ? "bg-[var(--primary)] text-white shadow-[var(--shadow-panel)]" : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]",
                ].join(" ")}
                href={item.href}
                key={item.key}
              >
                <Icon className="text-[20px]" fill={isActive} name={item.icon} />
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
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

function formatNotificationTime(value: string) {
  const createdAt = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));

  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function NavLink({ active, item }: { active: boolean; item: NavItem }) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={[
        "flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-bold transition-[background-color,color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)]",
        active ? "bg-[var(--primary)] text-white shadow-[var(--shadow-panel)]" : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]",
      ].join(" ")}
      href={item.href}
    >
      <Icon fill={active} name={item.icon} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function TopbarIconLink({ href, label, name }: { href: string; label: string; name: string }) {
  return (
    <Link
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)] focus-visible:shadow-[var(--focus-ring)]"
      href={href}
    >
      <Icon name={name} />
    </Link>
  );
}

export { Avatar, Icon };
