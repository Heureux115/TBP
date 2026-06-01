const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
export type PaymentProvider = "MOCK" | "VNPAY" | "MOMO";
export type PayoutStatus = "HELD" | "RELEASED" | "CANCELLED" | "REFUNDED";

export type Payment = {
  id: string;
  bookingId: string;
  amount: string;
  platformFeeAmount: string;
  tutorPayoutAmount: string;
  currency: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  payoutStatus: PayoutStatus;
  checkoutUrl: string | null;
  providerTxnRef: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  revenueReleasedAt: string | null;
  createdAt: string;
  booking: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  };
  tutor: {
    id: string;
    fullName: string;
  };
  payer: {
    id: string;
    fullName: string;
  };
};

async function request<T>(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : "Request failed.";
    throw new Error(message);
  }

  return body as T;
}

export function createPayment(token: string, bookingId: string, provider: PaymentProvider = "MOCK") {
  return request<Payment>("/payments", token, {
    method: "POST",
    body: JSON.stringify({ bookingId, provider }),
  });
}

export function getMyPayments(token: string) {
  return request<Payment[]>("/payments/me", token);
}

export function getPayment(token: string, id: string) {
  return request<Payment>(`/payments/${id}`, token);
}

export function mockConfirmPayment(token: string, id: string) {
  return request<Payment>(`/payments/${id}/mock-confirm`, token, {
    method: "PATCH",
  });
}
