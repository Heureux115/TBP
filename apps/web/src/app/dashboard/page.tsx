"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RoleDashboardShell } from "@/components/layouts/role-dashboard-shell";
import { getCurrentUser, PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { Booking, getMyBookings } from "@/lib/booking-api";
import { ensureConversation } from "@/lib/message-api";
import { createPayment, getMyPayments, mockConfirmPayment, Payment } from "@/lib/payment-api";
import { PublicTutorCard, searchPublicTutors } from "@/lib/discovery-api";
import { useHasMounted } from "@/lib/use-has-mounted";

function Icon({ name, fill = false, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return (
    <span className={["material-symbols-outlined", fill ? "icon-fill" : "", className].join(" ")}>
      {name}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: string | null) {
  const amount = Number(value || 0);
  return amount ? `${new Intl.NumberFormat("vi-VN").format(amount)}đ` : "Liên hệ";
}

function bookingSubject(booking: Booking) {
  const first = booking.tutor.headline?.split("-")[0]?.trim();
  return first || "Buổi học TutorConnect";
}

export default function DashboardPage() {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [recommendedTutors, setRecommendedTutors] = useState<PublicTutorCard[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasMounted) return;

    const token = getAccessToken();

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    Promise.all([getCurrentUser(token), getMyBookings(token), getMyPayments(token), searchPublicTutors({ pageSize: "6" })])
      .then(([current, bookingItems, paymentItems, tutors]) => {
        if (current.user.role === "ADMIN" || current.user.role === "SUPER_ADMIN") {
          router.replace("/admin/dashboard");
          return;
        }

        if (current.user.role === "TUTOR") {
          router.replace("/tutor/dashboard");
          return;
        }

        setUser(current.user);
        setBookings(bookingItems);
        setPayments(
          paymentItems.reduce<Record<string, Payment>>((acc, payment) => {
            acc[payment.bookingId] = payment;
            return acc;
          }, {}),
        );
        setRecommendedTutors(tutors.items);
      })
      .catch(() => {
        clearTokens();
        router.replace("/auth/login");
      })
      .finally(() => setIsLoading(false));
  }, [hasMounted, router]);

  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status !== "CANCELLED" && new Date(booking.startsAt) >= new Date())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [bookings],
  );
  const nextBooking = upcomingBookings[0] || null;
  const paidCount = Object.values(payments).filter((payment) => payment.status === "PAID").length;
  const activeCount = bookings.filter((booking) => booking.status !== "CANCELLED").length;
  const learnedHours = bookings.filter((booking) => booking.status === "COMPLETED").length * 1.5;

  async function reloadBookings(token: string) {
    const [bookingItems, paymentItems] = await Promise.all([getMyBookings(token), getMyPayments(token)]);
    setBookings(bookingItems);
    setPayments(
      paymentItems.reduce<Record<string, Payment>>((acc, payment) => {
        acc[payment.bookingId] = payment;
        return acc;
      }, {}),
    );
  }

  async function handleMockPayment(bookingId: string) {
    const token = getAccessToken();
    if (!token) return;

    setMessage("");
    try {
      const payment = await createPayment(token, bookingId, "MOCK");
      const paidPayment = await mockConfirmPayment(token, payment.id);
      await reloadBookings(token);
      setMessage("Thanh toán thử nghiệm thành công.");
      router.push(`/payments/success?paymentId=${paidPayment.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể thanh toán.");
    }
  }

  async function handleMessageTutor(bookingId: string) {
    const token = getAccessToken();
    if (!token) return;

    setMessage("");
    try {
      const conversation = await ensureConversation(token, bookingId);
      router.push(`/messages?conversationId=${conversation.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể mở tin nhắn.");
    }
  }

  if (!hasMounted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] text-sm text-[var(--on-surface-variant)]">
        Đang mở dashboard...
      </main>
    );
  }

  return (
    <RoleDashboardShell active="dashboard" role="student">
      <aside className="hidden">
        <div className="mb-10 px-4">
          <Link className="text-2xl font-black text-[var(--primary)]" href="/">
            TutorConnect
          </Link>
        </div>

        <div className="mb-10 flex items-center gap-3 px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--outline-variant)] bg-[var(--primary-fixed)] text-[var(--primary)]">
            <Icon name="person" fill />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--on-surface-variant)]">Xin chào,</p>
            <p className="truncate text-sm font-bold">{user?.fullName || "Học viên"}</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          <StudentNavItem active href="/dashboard" icon="dashboard" label="Tổng quan" />
          <StudentNavItem href="/bookings" icon="event_available" label="Lịch học" />
          <StudentNavItem href="/messages" icon="mail" label="Tin nhắn" />
          <StudentNavItem href="/payments" icon="payments" label="Thanh toán" />
          <StudentNavItem href="/tutors" icon="school" label="Tìm gia sư" />
        </nav>

        <Link
          className="mx-4 mb-8 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--secondary-container)] px-4 py-3 text-sm font-bold text-[var(--on-secondary-container)] shadow-sm transition hover:scale-[1.02]"
          href="/tutors"
        >
          <Icon name="add_circle" />
          Đặt lịch học
        </Link>

        <div className="mt-auto space-y-1 border-t border-[var(--outline-variant)] pt-4">
          <StudentNavItem href="#" icon="help" label="Trung tâm hỗ trợ" />
          <button
            className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-[var(--error)] hover:bg-[var(--error-container)]"
            onClick={() => {
              clearTokens();
              router.replace("/auth/login");
            }}
            type="button"
          >
            <Icon name="logout" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="min-h-screen px-5 py-8 md:px-10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8">
          <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-[var(--primary)]">Tổng quan học viên</h1>
              <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                Theo dõi buổi học, thanh toán và gợi ý gia sư phù hợp.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link className="rounded-full p-2 hover:bg-[var(--surface-container-high)]" href="/messages" aria-label="Tin nhắn">
                <Icon name="chat" />
              </Link>
              <Link className="relative rounded-full p-2 hover:bg-[var(--surface-container-high)]" href="/payments" aria-label="Thông báo thanh toán">
                <Icon name="notifications" />
                {paidCount ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--error)]" /> : null}
              </Link>
            </div>
          </header>

          {message ? (
            <p className="rounded-lg bg-[var(--surface-container)] p-3 text-sm font-semibold text-[var(--on-surface-variant)]">
              {message}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="relative overflow-hidden rounded-xl bg-[var(--primary)] p-8 text-white shadow-sm lg:col-span-8">
              <div className="relative z-10">
                <span className="mb-4 inline-flex rounded-full bg-[var(--primary-container)] px-3 py-1 text-xs font-bold text-[var(--on-primary-container)]">
                  Buổi học tiếp theo
                </span>
                {nextBooking ? (
                  <>
                    <h2 className="text-3xl font-bold">{bookingSubject(nextBooking)}</h2>
                    <p className="mt-2 flex items-center gap-2 text-lg opacity-90">
                      <Icon name="person" />
                      {nextBooking.tutor.fullName}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-5 text-sm font-semibold">
                      <span className="flex items-center gap-2">
                        <Icon name="calendar_today" />
                        {formatDateTime(nextBooking.startsAt)}
                      </span>
                      <span className="flex items-center gap-2">
                        <Icon name="schedule" />
                        {new Date(nextBooking.startsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {new Date(nextBooking.endsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="mt-8 flex flex-wrap gap-3">
                      <button className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold text-[var(--primary)] shadow-sm transition hover:scale-105" type="button">
                        <Icon name="video_call" />
                        Vào lớp ngay
                      </button>
                      <button className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-6 py-3 text-sm font-bold text-white" onClick={() => handleMessageTutor(nextBooking.id)} type="button">
                        <Icon name="mail" />
                        Nhắn tin
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl font-bold">Chưa có buổi học sắp tới</h2>
                    <p className="mt-2 max-w-2xl text-lg opacity-90">
                      Tìm gia sư phù hợp và đặt khung giờ rảnh để bắt đầu học.
                    </p>
                    <Link className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold text-[var(--primary)] shadow-sm" href="/tutors">
                      <Icon name="search" />
                      Tìm gia sư
                    </Link>
                  </>
                )}
              </div>
              <Icon className="absolute -right-12 -top-16 text-[260px] opacity-10" name="auto_stories" />
            </section>

            <div className="grid gap-6 lg:col-span-4">
              <KpiCard icon="timer" label="Giờ đã học" value={learnedHours ? learnedHours.toFixed(1) : "0"} note="Tính theo buổi đã hoàn thành" />
              <KpiCard icon="book_online" label="Lịch đang hoạt động" value={String(activeCount)} note={nextBooking ? "Sắp đến buổi học tiếp theo" : "Chưa có lịch hoạt động"} accent="secondary" />
            </div>

            <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm lg:col-span-4">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">Tiến độ học tập</h2>
                <Link className="text-sm font-bold text-[var(--primary)] hover:underline" href="/tutors">
                  Xem tất cả
                </Link>
              </div>
              <ProgressRow label="Buổi đã đặt" value={Math.min(100, activeCount * 20)} color="var(--primary)" />
              <ProgressRow label="Buổi đã thanh toán" value={activeCount ? Math.round((paidCount / activeCount) * 100) : 0} color="var(--tertiary-container)" />
              <ProgressRow label="Hoạt động hồ sơ" value={recommendedTutors.length ? 70 : 20} color="var(--secondary-container)" />
              <div className="mt-8 flex items-center gap-4 rounded-lg bg-[var(--surface-container)] p-4">
                <Icon className="text-3xl text-[var(--primary)]" name="emoji_events" />
                <div>
                  <p className="font-bold">Weekly Milestone</p>
                  <p className="text-sm text-[var(--on-surface-variant)]">Bạn có {activeCount} lịch học đang hoạt động.</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm lg:col-span-8" id="bookings">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">Lịch học sắp tới</h2>
                <Link className="text-sm font-bold text-[var(--primary)] hover:underline" href="/tutors">
                  Xem lịch học
                </Link>
              </div>
              {isLoading ? (
                <p className="text-sm text-[var(--on-surface-variant)]">Đang tải lịch học...</p>
              ) : upcomingBookings.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="border-b border-[var(--outline-variant)] text-xs uppercase text-[var(--on-surface-variant)]">
                        <th className="py-4">Gia sư</th>
                        <th className="py-4">Môn học</th>
                        <th className="py-4">Ngày & giờ</th>
                        <th className="py-4">Thanh toán</th>
                        <th className="py-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--outline-variant)]">
                      {upcomingBookings.slice(0, 5).map((booking) => (
                        <tr className="hover:bg-[var(--surface-container-low)]" key={booking.id}>
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={booking.tutor.fullName} src={booking.tutor.avatarUrl} />
                              <div>
                                <p className="font-bold">{booking.tutor.fullName}</p>
                                <p className="text-sm text-[var(--on-surface-variant)]">{booking.tutor.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-sm font-semibold">{bookingSubject(booking)}</td>
                          <td className="py-4 text-sm">{formatDateTime(booking.startsAt)}</td>
                          <td className="py-4">
                            <span className="rounded-full bg-[var(--surface-container)] px-3 py-1 text-xs font-bold">
                              {payments[booking.id]?.status || "PENDING"}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Link className="rounded-lg border border-[var(--primary)] px-3 py-2 text-sm font-bold text-[var(--primary)]" href={`/tutors/${booking.tutor.id}`}>
                                Chi tiết
                              </Link>
                              <button className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm font-bold text-[var(--primary)]" onClick={() => handleMessageTutor(booking.id)} type="button">
                                Nhắn tin
                              </button>
                              {booking.status === "CONFIRMED" && payments[booking.id]?.status !== "PAID" ? (
                                <button className="rounded-lg bg-[var(--secondary-container)] px-3 py-2 text-sm font-bold text-[var(--on-secondary-container)]" onClick={() => handleMockPayment(booking.id)} type="button">
                                  Thanh toán
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyPanel />
              )}
            </section>

            <section className="lg:col-span-12">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">Gia sư gợi ý</h2>
                <Link className="text-sm font-bold text-[var(--primary)] hover:underline" href="/tutors">
                  Xem tất cả
                </Link>
              </div>
              <div className="flex gap-6 overflow-x-auto pb-4">
                {recommendedTutors.map((tutor) => (
                  <article className="min-w-[300px] rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-5 shadow-sm transition hover:-translate-y-1" key={tutor.id}>
                    <div className="mb-4 flex gap-4">
                      <Avatar name={tutor.fullName} src={tutor.avatarUrl} size="lg" />
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold">{tutor.fullName}</h3>
                        <div className="flex items-center gap-1 text-[var(--secondary)]">
                          <Icon className="text-sm" fill name="star" />
                          <span className="text-sm font-bold">{Number(tutor.ratingAvg).toFixed(1)} ({tutor.totalSessions})</span>
                        </div>
                      </div>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {tutor.subjects.slice(0, 2).map((item) => (
                        <span className="rounded-full bg-[var(--surface-variant)] px-3 py-1 text-xs font-semibold" key={item.id}>
                          {item.subject.name}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-[var(--outline-variant)] pt-4">
                      <p className="text-lg font-bold text-[var(--primary)]">
                        {formatMoney(tutor.hourlyRate)}
                        <span className="text-sm font-normal text-[var(--on-surface-variant)]">/giờ</span>
                      </p>
                      <Link className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white" href={`/tutors/${tutor.id}`}>
                        Đặt lịch
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </RoleDashboardShell>
  );
}

function StudentNavItem({ href, icon, label, active = false }: { href: string; icon: string; label: string; active?: boolean }) {
  return (
    <Link
      className={[
        "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition hover:translate-x-1",
        active ? "bg-[var(--primary)] text-white shadow-sm" : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]",
      ].join(" ")}
      href={href}
    >
      <Icon fill={active} name={icon} />
      {label}
    </Link>
  );
}

function KpiCard({ icon, label, value, note, accent = "tertiary" }: { icon: string; label: string; value: string; note: string; accent?: "tertiary" | "secondary" }) {
  const color = accent === "tertiary" ? "text-[var(--tertiary)]" : "text-[var(--secondary)]";
  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-6 shadow-sm transition hover:-translate-y-1">
      <div className="mb-2 flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">{label}</p>
        <Icon className={color} name={icon} />
      </div>
      <p className="text-4xl font-black">{value}</p>
      <p className="mt-2 text-xs font-semibold text-[var(--on-surface-variant)]">{note}</p>
    </div>
  );
}

function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex justify-between text-sm font-bold">
        <span>{label}</span>
        <span className="text-[var(--primary)]">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-variant)]">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "md" | "lg" }) {
  const dimension = size === "lg" ? "h-16 w-16" : "h-10 w-10";
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  return (
    <div className={`${dimension} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-fixed)] font-bold text-[var(--primary)]`}>
      {src ? <img alt={name} className="h-full w-full object-cover" src={src} /> : initial}
    </div>
  );
}

function EmptyPanel() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-8 text-center">
      <h3 className="text-lg font-bold">Bạn chưa có lịch học nào</h3>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">Chọn gia sư và đặt một khung giờ rảnh để bắt đầu.</p>
      <Link className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white" href="/tutors">
        Tìm gia sư ngay
      </Link>
    </div>
  );
}
