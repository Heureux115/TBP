"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { Booking, getMyBookings } from "@/lib/booking-api";

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    getCurrentUser(token)
      .then(async ({ user }) => {
        if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
          router.replace("/admin/dashboard");
          return;
        }

        if (user.role === "TUTOR") {
          router.replace("/tutor/dashboard");
          return;
        }

        setBookings(await getMyBookings(token));
      })
      .catch(() => {
        clearTokens();
        router.replace("/auth/login");
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  return (
    <main className="min-h-screen bg-[var(--surface)] px-5 py-8 text-[var(--on-surface)] md:px-10">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link className="text-2xl font-black text-[var(--primary)]" href="/">
              TutorConnect
            </Link>
            <h1 className="mt-8 text-3xl font-bold">Dashboard học viên</h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              Theo dõi lịch học đã đặt và tiếp tục tìm gia sư phù hợp.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white"
            href="/tutors"
          >
            Tìm gia sư
          </Link>
        </header>

        <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold">Lịch học của bạn</h2>
            <span className="rounded-full bg-[var(--surface-container)] px-3 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
              {bookings.length} lịch
            </span>
          </div>

          {isLoading ? (
            <p className="text-sm text-[var(--on-surface-variant)]">Đang tải lịch học...</p>
          ) : bookings.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bookings.map((booking) => (
                <article
                  className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4"
                  key={booking.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{booking.tutor.fullName}</h3>
                      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                        {booking.tutor.headline ?? "Gia sư TutorConnect"}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--secondary-fixed)] px-3 py-1 text-xs font-bold text-[var(--on-secondary-fixed)]">
                      {booking.status}
                    </span>
                  </div>
                  <div className="mt-4 rounded-lg bg-[var(--surface-container)] p-3 text-sm font-semibold">
                    {formatDate(booking.startsAt)} - {formatDate(booking.endsAt)}
                  </div>
                  <Link
                    className="mt-4 inline-flex text-sm font-bold text-[var(--primary)] hover:underline"
                    href={`/tutors/${booking.tutor.id}`}
                  >
                    Xem hồ sơ gia sư
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-8 text-center">
              <h3 className="text-lg font-bold">Bạn chưa có lịch học nào</h3>
              <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                Chọn gia sư và đặt một khung giờ rảnh để bắt đầu.
              </p>
              <Link
                className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white"
                href="/tutors"
              >
                Tìm gia sư ngay
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
