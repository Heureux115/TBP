"use client";

import { ReactNode } from "react";
import { Icon, RoleDashboardShell, type DashboardSection } from "@/components/layouts/role-dashboard-shell";

type TutorShellSection = Extract<DashboardSection, "profile" | "approvals" | "dashboard" | "messages" | "payments" | "bookings">;

export function DashboardShell({
  active,
  children,
  mode = "tutor",
}: {
  active: TutorShellSection;
  children: ReactNode;
  mode?: "tutor" | "admin";
}) {
  const role = mode === "admin" ? "admin" : "tutor";
  const normalizedActive = active === "approvals" ? "tutors" : active;

  return (
    <RoleDashboardShell active={normalizedActive} role={role}>
      {children}
    </RoleDashboardShell>
  );
}

export { Icon };
