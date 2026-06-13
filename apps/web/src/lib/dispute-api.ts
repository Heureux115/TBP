import type { AdminDispute } from "./admin-api";

import { applyAuthHeaders } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

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

export function createDispute(token: string, bookingId: string, reason: string) {
  return request<AdminDispute>("/disputes", token, {
    method: "POST",
    body: JSON.stringify({ bookingId, reason }),
  });
}

export function getMyDisputes(token: string) {
  return request<AdminDispute[]>("/disputes/me", token);
}

export function getDispute(token: string, disputeId: string) {
  return request<AdminDispute>(`/disputes/${disputeId}`, token);
}

export async function addDisputeMessage(token: string, disputeId: string, body: string, files: File[]) {
  const headers = new Headers();
  await applyAuthHeaders(headers, token, "POST");
  const formData = new FormData();
  formData.append("body", body);
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_URL}/disputes/${disputeId}/messages`, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(", ") : typeof payload?.message === "string" ? payload.message : "Request failed.";
    throw new Error(message);
  }

  return payload as AdminDispute;
}
