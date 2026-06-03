import { applyAuthHeaders } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationResponse = {
  unreadCount: number;
  items: NotificationItem[];
};

async function request<T>(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  await applyAuthHeaders(headers, token, options.method || "GET");

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : "Request failed.";
    throw new Error(message);
  }

  return body as T;
}

export function getMyNotifications(token: string) {
  return request<NotificationResponse>("/notifications/me", token);
}

export function markNotificationRead(token: string, id: string) {
  return request<NotificationItem>(`/notifications/${id}/read`, token, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead(token: string) {
  return request<NotificationResponse>("/notifications/me/read-all", token, {
    method: "PATCH",
  });
}
