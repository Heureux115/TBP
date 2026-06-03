import { applyAuthHeaders } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export type Withdrawal = {
  id: string;
  amount: string;
  currency: string;
  status: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED";
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  requestedAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
};

export type TutorWallet = {
  id: string;
  tutorProfileId: string;
  availableBalance: string;
  withdrawnBalance: string;
  currency: string;
  withdrawals: Withdrawal[];
};

async function request<T>(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  await applyAuthHeaders(headers, token, options.method || "GET");

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : typeof body?.message === "string"
        ? body.message
        : "Request failed.";
    throw new Error(message);
  }

  return body as T;
}

export function getMyWallet(token: string) {
  return request<TutorWallet>("/wallet/me", token);
}

export function createWithdrawal(
  token: string,
  payload: {
    amount: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
  },
) {
  return request<TutorWallet>("/wallet/withdrawals", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
