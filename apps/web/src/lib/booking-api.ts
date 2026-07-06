import { applyAuthHeaders } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
export type BookingTeachingMode = "ONLINE" | "OFFLINE" | "BOTH";

export type Booking = {
  id: string;
  status: BookingStatus;
  teachingMode: BookingTeachingMode;
  startsAt: string;
  endsAt: string;
  hourlyRateSnapshot: string;
  grossAmountSnapshot: string;
  studentNote: string | null;
  cancellationReason: string | null;
  student: {
    id: string;
    fullName: string;
    email: string;
  };
  tutor: {
    id: string;
    fullName: string;
    email: string;
    headline: string | null;
    avatarUrl: string | null;
  };
  availabilitySlotId: string;
  payment: {
    id: string;
    amount: string;
    platformFeeAmount: string;
    tutorPayoutAmount: string;
    currency: string;
    status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
    payoutStatus: "HELD" | "RELEASED" | "CANCELLED" | "REFUNDED";
    paidAt: string | null;
    refundedAt: string | null;
    refundReason: string | null;
    revenueReleasedAt: string | null;
  } | null;
  review: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  } | null;
  createdAt: string;
};

async function request<T>(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  await applyAuthHeaders(headers, token, options.method || "GET");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
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

export function createBooking(token: string, availabilitySlotId: string, teachingMode?: Exclude<BookingTeachingMode, "BOTH">, studentNote?: string) {
  return request<Booking>("/bookings", token, {
    method: "POST",
    body: JSON.stringify({ availabilitySlotId, teachingMode, studentNote }),
  });
}

export function getMyBookings(token: string) {
  return request<Booking[]>("/bookings/me", token);
}

export function getBooking(token: string, id: string) {
  return request<Booking>(`/bookings/${id}`, token);
}

export function cancelBooking(token: string, id: string, reason?: string) {
  return request<Booking>(`/bookings/${id}/cancel`, token, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function confirmBooking(token: string, id: string) {
  return request<Booking>(`/bookings/${id}/confirm`, token, {
    method: "PATCH",
  });
}

export function completeBooking(token: string, id: string) {
  return request<Booking>(`/bookings/${id}/complete`, token, {
    method: "PATCH",
  });
}
