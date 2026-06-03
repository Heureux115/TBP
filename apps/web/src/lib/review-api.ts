import { applyAuthHeaders } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export type Review = {
  id: string;
  bookingId: string;
  tutorProfileId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  student: {
    id: string;
    fullName: string;
  };
  booking: {
    id: string;
    startsAt: string;
    endsAt: string;
  };
};

export type EligibleReviewBooking = {
  id: string;
  startsAt: string;
  endsAt: string;
};

async function request<T>(path: string, options: RequestInit & { token?: string } = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  await applyAuthHeaders(headers, options.token, options.method || "GET");

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

export function getTutorReviews(tutorId: string) {
  return request<Review[]>(`/tutors/${tutorId}/reviews`);
}

export function getEligibleReviewBookings(token: string, tutorId: string) {
  return request<EligibleReviewBooking[]>(`/reviews/eligible?tutorId=${encodeURIComponent(tutorId)}`, { token });
}

export function createReview(token: string, payload: { bookingId: string; rating: number; comment?: string }) {
  return request<Review>("/reviews", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}
