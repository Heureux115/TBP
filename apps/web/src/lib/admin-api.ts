const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export type AdminBookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
export type AdminPaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
export type AdminPaymentProvider = "MOCK" | "VNPAY" | "MOMO";
export type AdminPayoutStatus = "HELD" | "RELEASED" | "CANCELLED" | "REFUNDED";
export type AdminWithdrawalStatus = "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED";

export type AdminBooking = {
  id: string;
  status: AdminBookingStatus;
  startsAt: string;
  endsAt: string;
  studentNote: string | null;
  cancellationReason: string | null;
  teachingMode: "ONLINE" | "OFFLINE" | "BOTH";
  createdAt: string;
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
    subjects: Array<{
      id: string;
      level: string;
      subject: {
        id: string;
        name: string;
        slug: string;
        category: string | null;
      };
    }>;
  };
  payment: {
    id: string;
    amount: string;
    currency: string;
    provider: AdminPaymentProvider;
    status: AdminPaymentStatus;
    payoutStatus: AdminPayoutStatus;
    paidAt: string | null;
    refundedAt: string | null;
    revenueReleasedAt: string | null;
    createdAt: string;
  } | null;
};

export type AdminPayment = {
  id: string;
  bookingId: string;
  amount: string;
  platformFeeAmount: string;
  tutorPayoutAmount: string;
  currency: string;
  provider: AdminPaymentProvider;
  status: AdminPaymentStatus;
  payoutStatus: AdminPayoutStatus;
  providerTxnRef: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  revenueReleasedAt: string | null;
  createdAt: string;
  payer: {
    id: string;
    fullName: string;
    email: string;
  };
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
  };
  booking: {
    id: string;
    status: AdminBookingStatus;
    startsAt: string;
    endsAt: string;
  };
};

export type AdminWithdrawal = {
  id: string;
  walletId: string;
  tutorProfileId: string;
  amount: string;
  currency: string;
  status: AdminWithdrawalStatus;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  requestedAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
  tutor: {
    id: string;
    fullName: string;
    email: string;
  };
};

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: "STUDENT" | "TUTOR" | "ADMIN" | "SUPER_ADMIN";
  status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "SUSPENDED";
  emailVerifiedAt: string | null;
  createdAt: string;
  bookingCount: number;
  paymentCount: number;
};

export type AdminSummary = {
  users: {
    total: number;
    students: number;
    tutors: number;
    admins: number;
    active: number;
    suspended: number;
  };
  tutors: {
    totalProfiles: number;
    approved: number;
    pendingReview: number;
    rejected: number;
    draft: number;
  };
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  payments: {
    grossPaid: string;
    platformFees: string;
    tutorPayouts: string;
    heldPayouts: string;
    releasedPayouts: string;
    pendingAmount: string;
    refundedAmount: string;
    paidCount: number;
    pendingCount: number;
    refundedCount: number;
  };
};

async function request<T>(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : "Request failed.";
    throw new Error(message);
  }

  return body as T;
}

export function getAdminBookings(token: string) {
  return request<AdminBooking[]>("/admin/bookings", token);
}

export function getAdminPayments(token: string) {
  return request<AdminPayment[]>("/admin/payments", token);
}

export function getAdminUsers(token: string, role?: string) {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  return request<AdminUser[]>(`/admin/users${query}`, token);
}

export function getAdminSummary(token: string) {
  return request<AdminSummary>("/admin/summary", token);
}

export function refundAdminPayment(token: string, id: string, reason?: string) {
  return request<AdminPayment>(`/admin/payments/${id}/refund`, token, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function getAdminWithdrawals(token: string) {
  return request<AdminWithdrawal[]>("/admin/withdrawals", token);
}

export function markAdminWithdrawalProcessing(token: string, id: string) {
  return request<AdminWithdrawal>(`/admin/withdrawals/${id}/processing`, token, {
    method: "PATCH",
  });
}

export function markAdminWithdrawalPaid(token: string, id: string) {
  return request<AdminWithdrawal>(`/admin/withdrawals/${id}/paid`, token, {
    method: "PATCH",
  });
}

export function rejectAdminWithdrawal(token: string, id: string, reason: string) {
  return request<AdminWithdrawal>(`/admin/withdrawals/${id}/reject`, token, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}
