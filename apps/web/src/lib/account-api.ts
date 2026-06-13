import { PublicUser } from "./api";
import { applyAuthHeaders } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

async function jsonRequest<T>(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  await applyAuthHeaders(headers, token, options.method || "GET");

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(", ") : typeof body?.message === "string" ? body.message : "Request failed.";
    throw new Error(message);
  }

  return body as T;
}

async function formRequest<T>(path: string, token: string, formData: FormData) {
  const headers = new Headers();
  await applyAuthHeaders(headers, token, "POST");

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(", ") : typeof body?.message === "string" ? body.message : "Request failed.";
    throw new Error(message);
  }

  return body as T;
}

export function updateAccountProfile(token: string, payload: { fullName: string; phone?: string }) {
  return jsonRequest<{ user: PublicUser }>("/account/profile", token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function uploadAccountAvatar(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return formRequest<{ avatarUrl: string; user: PublicUser }>("/account/avatar", token, formData);
}

export function changeAccountPassword(token: string, payload: { currentPassword: string; newPassword: string }) {
  return jsonRequest<{ message: string }>("/account/password", token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
