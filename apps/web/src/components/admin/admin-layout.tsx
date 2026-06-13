"use client";

import { ReactNode } from "react";
import { Avatar, Icon, RoleDashboardShell, type DashboardSection } from "@/components/layouts/role-dashboard-shell";

export type AdminSection = Extract<DashboardSection, "dashboard" | "tutors" | "students" | "bookings" | "payments" | "settings">;

export function AdminLayout({
  active,
  children,
  searchPlaceholder = "Tìm theo mã, người dùng hoặc nội dung...",
}: {
  active: AdminSection;
  children: ReactNode;
  searchPlaceholder?: string;
}) {
  return (
    <RoleDashboardShell active={active} role="admin" searchPlaceholder={searchPlaceholder}>
      {children}
    </RoleDashboardShell>
  );
}

export { Avatar, Icon };
