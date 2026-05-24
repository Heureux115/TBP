const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

export type Booking = {
  id: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
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
  createdAt: string;
};

async function request<T>(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
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

export function createBooking(token: string, availabilitySlotId: string, studentNote?: string) {
  return request<Booking>("/bookings", token, {
    method: "POST",
    body: JSON.stringify({ availabilitySlotId, studentNote }),
  });
}

export function getMyBookings(token: string) {
  return request<Booking[]>("/bookings/me", token);
}

export function cancelBooking(token: string, id: string, reason?: string) {
  return request<Booking>(`/bookings/${id}/cancel`, token, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}
