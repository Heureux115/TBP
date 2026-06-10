"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUser, PublicUser } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import { Booking, BookingStatus, cancelBooking, completeBooking, confirmBooking, getBooking } from "@/lib/booking-api";
import { ensureConversation, getMessages, Message } from "@/lib/message-api";
import { createPayment, getMyPayments, mockConfirmPayment, Payment } from "@/lib/payment-api";
import { createDispute } from "@/lib/dispute-api";
import { useHasMounted } from "@/lib/use-has-mounted";

function Icon({ name, fill = false, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return <span className={["material-symbols-outlined", fill ? "icon-fill" : "", className].join(" ")}>{name}</span>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatTimeRange(booking: Booking) {
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  return `${start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatMoney(value: string | null | undefined) {
  const amount = Number(value || 0);
  return amount ? `${new Intl.NumberFormat("vi-VN").format(amount)}đ` : "Chưa thanh toán";
}

function durationMinutes(booking: Booking) {
  return Math.max(0, Math.round((new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60000));
}

function bookingSubject(booking: Booking) {
  return booking.tutor.headline?.split("-")[0]?.trim() || "Buổi học TutorConnect";
}

function teachingModeLabel(mode: Booking["teachingMode"]) {
  if (mode === "ONLINE") return "Online";
  if (mode === "OFFLINE") return "Offline";
  return "Online/Offline";
}

function paymentStatusText(payment: Payment | Booking["payment"]) {
  if (!payment) return "Chưa thanh toán";
  if (payment.status === "PAID") return "Thanh toán thành công";
  if (payment.status === "REFUNDED") return "Đã hoàn tiền";
  if (payment.status === "CANCELLED") return "Thanh toán đã hủy";
  if (payment.status === "FAILED") return "Thanh toán thất bại";
  return "Chờ thanh toán";
}

function getCompleteUnavailableReason(booking: Booking, paid: boolean) {
  if (booking.status === "COMPLETED") return "";
  if (booking.status !== "CONFIRMED") return "Chỉ lịch học đã xác nhận mới có thể hoàn thành.";
  if (!paid) return "Cần thanh toán thành công trước khi hoàn thành buổi học.";
  if (new Date(booking.startsAt) > new Date()) return "Nút hoàn thành sẽ mở sau khi đến giờ bắt đầu buổi học.";
  return "";
}

export function BookingDetailScreen({ id }: { id: string }) {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<Payment | Booking["payment"]>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasMounted) return;
    const token = getAccessToken();
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    Promise.all([getCurrentUser(token), getBooking(token, id), getMyPayments(token)])
      .then(([current, bookingItem, paymentItems]) => {
        setUser(current.user);
        setBooking(bookingItem);
        setPayment(paymentItems.find((item) => item.bookingId === bookingItem.id) || bookingItem.payment);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Không thể tải chi tiết lịch hẹn.");
      });
  }, [hasMounted, id, router]);

  useEffect(() => {
    if (!booking || !hasMounted) return;
    const token = getAccessToken();
    if (!token) return;

    ensureConversation(token, booking.id)
      .then((conversation) => getMessages(token, conversation.id))
      .then((items) => setMessages(items.slice(-2)))
      .catch(() => undefined);
  }, [booking, hasMounted]);

  const role = user?.role;
  const otherName = useMemo(() => {
    if (!booking) return "";
    return role === "TUTOR" ? booking.student.fullName : booking.tutor.fullName;
  }, [booking, role]);

  async function openChat() {
    const token = getAccessToken();
    if (!token || !booking) return;
    setBusy(true);
    try {
      const conversation = await ensureConversation(token, booking.id);
      router.push(`/messages?conversationId=${conversation.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể mở tin nhắn.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    const token = getAccessToken();
    if (!token || !booking) return;
    if (payment?.status === "PAID" && !window.confirm("Lịch này đã thanh toán. Hủy lịch sẽ hoàn tiền cho học sinh. Tiếp tục?")) {
      return;
    }
    setBusy(true);
    try {
      const updated = await cancelBooking(token, booking.id, "Người dùng hủy từ trang chi tiết lịch hẹn.");
      setBooking(updated);
      setPayment(updated.payment);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể hủy lịch hẹn.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePay() {
    const token = getAccessToken();
    if (!token || !booking) return;
    setBusy(true);
    setError("");
    try {
      const pending = payment?.status === "PENDING" ? payment : await createPayment(token, booking.id);
      const paidPayment = await mockConfirmPayment(token, pending.id);
      setPayment(paidPayment);
      setBooking({ ...booking, status: paidPayment.booking.status });
      router.push(`/payments/success?paymentId=${paidPayment.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể thanh toán lịch học.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    const token = getAccessToken();
    if (!token || !booking) return;
    setBusy(true);
    setError("");
    try {
      const updated = await confirmBooking(token, booking.id);
      setBooking(updated);
      setPayment(updated.payment);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể xác nhận đặt lịch.");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    const token = getAccessToken();
    if (!token || !booking) return;
    setBusy(true);
    setError("");
    try {
      const updated = await completeBooking(token, booking.id);
      setBooking(updated);
      setPayment(updated.payment);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể hoàn thành buổi học.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenDispute() {
    const token = getAccessToken();
    if (!token || !booking) return;
    const reason = window.prompt("Lý do khiếu nại/dispute:", "Tôi cần admin hỗ trợ kiểm tra buổi học này.");
    if (!reason) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await createDispute(token, booking.id, reason);
      setNotice("Dispute đã được gửi tới admin để xử lý.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể tạo dispute.");
    } finally {
      setBusy(false);
    }
  }

  if (!hasMounted) return <DetailSkeleton />;

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-5">
        <div className="max-w-md rounded-xl border border-[var(--outline-variant)] bg-white p-6 text-center shadow-sm">
          <Icon className="text-4xl text-[var(--error)]" fill name="error" />
          <h1 className="mt-3 text-xl font-black">Không thể mở lịch hẹn</h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">{error}</p>
          <Link className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white" href="/bookings">Quay lại lịch học</Link>
        </div>
      </main>
    );
  }

  if (!booking) return <DetailSkeleton />;

  const paid = payment?.status === "PAID";
  const refunded = payment?.status === "REFUNDED";
  const canCancel = booking.status !== "CANCELLED" && booking.status !== "COMPLETED";
  const canConfirm = role === "TUTOR" && booking.status === "PENDING";
  const canPay = role === "STUDENT" && booking.status === "CONFIRMED" && (!payment || payment.status === "PENDING");
  const canOpenDispute = role === "STUDENT" && paid && booking.status !== "CANCELLED" && booking.status !== "COMPLETED";
  const canComplete = role === "TUTOR" && paid && booking.status === "CONFIRMED" && new Date(booking.startsAt) <= new Date();
  const showCompleteAction = role === "TUTOR" && (booking.status === "CONFIRMED" || booking.status === "COMPLETED");
  const completeReason = getCompleteUnavailableReason(booking, paid);
  const serviceFee = payment ? Number(payment.platformFeeAmount) : 0;
  const sessionFee = payment ? Number(payment.tutorPayoutAmount) : Number(booking.grossAmountSnapshot || 0);

  return (
    <main className="min-h-screen bg-[var(--surface-bright)] px-5 py-8 text-[var(--on-surface)] md:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-6 flex items-center justify-between">
          <Link className="inline-flex items-center gap-1 text-sm font-bold text-[var(--primary)] hover:-translate-x-1" href="/bookings">
            <Icon name="arrow_back" /> Quay lại lịch học
          </Link>
          <p className="text-sm font-semibold text-[var(--on-surface-variant)]">Mã lịch học: <span className="font-black text-[var(--primary)]">#{booking.id.slice(0, 8).toUpperCase()}</span></p>
        </div>

        <section className="mb-8 flex flex-col justify-between gap-5 rounded-xl border border-[var(--primary-container)]/20 bg-[var(--primary-container)]/10 p-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-black text-[var(--primary)]">{bookingSubject(booking)}</h1>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">Lịch học ngày {formatDate(booking.startsAt)}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {canConfirm ? (
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60" type="button" onClick={handleConfirm} disabled={busy}>
                <Icon fill name="event_available" /> Xác nhận đặt lịch
              </button>
            ) : null}
            {canPay ? (
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60" type="button" onClick={handlePay} disabled={busy}>
                <Icon fill name="payments" /> Thanh toán
              </button>
            ) : null}
            {canComplete ? (
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--tertiary)] px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60" type="button" onClick={handleComplete} disabled={busy}>
                <Icon fill name="task_alt" /> Hoàn thành buổi học
              </button>
            ) : null}
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--secondary-container)] px-5 py-3 text-sm font-bold text-[var(--on-secondary-container)] shadow-sm" type="button">
              <Icon fill name="video_call" /> Vào lớp trực tuyến
            </button>
            <button className="rounded-lg border border-[var(--primary)] px-5 py-3 text-sm font-bold text-[var(--primary)]" type="button" onClick={openChat} disabled={busy}>Nhắn tin</button>
            {canOpenDispute ? (
              <button className="rounded-lg border border-[var(--error)]/30 px-5 py-3 text-sm font-bold text-[var(--error)] disabled:opacity-60" type="button" onClick={handleOpenDispute} disabled={busy}>Mở dispute</button>
            ) : null}
          </div>
        </section>

        {notice ? (
          <p className="mb-6 rounded-lg border border-[var(--tertiary)]/20 bg-[var(--tertiary)]/10 p-3 text-sm font-bold text-[var(--tertiary)]">
            {notice}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-6 lg:col-span-8">
            <GlassCard>
              <h2 className="mb-6 flex items-center gap-2 text-xl font-black"><Icon className="text-[var(--primary)]" name="timeline" />Trạng thái lịch học</h2>
              <Timeline payment={payment} status={booking.status} />
            </GlassCard>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <InfoCard border="primary" label="Ngày và giờ" title={formatDate(booking.startsAt)} value={formatTimeRange(booking)} note="GMT+07:00 Giờ Việt Nam" />
              <InfoCard border="secondary" label="Chi tiết buổi học" title={`${durationMinutes(booking)} phút`} value={bookingSubject(booking)} note={`Hình thức: ${teachingModeLabel(booking.teachingMode)}`} />
            </div>

            <GlassCard>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-black"><Icon className="text-[var(--primary)]" name="chat_bubble" />Tin nhắn gần đây</h2>
                <button className="text-sm font-bold text-[var(--primary)] hover:underline" onClick={openChat} type="button">Mở chat</button>
              </div>
              <div className="space-y-4">
                {messages.length ? messages.map((message) => <RecentMessage key={message.id} message={message} />) : <p className="rounded-lg bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">Chưa có tin nhắn trong lịch hẹn này.</p>}
              </div>
            </GlassCard>
          </section>

          <aside className="flex flex-col gap-6 lg:col-span-4">
            <GlassCard>
              <h2 className="mb-5 text-xl font-black">Participants</h2>
              <Participant label={role === "TUTOR" ? "Học sinh" : "Gia sư"} name={otherName} subtitle={role === "TUTOR" ? booking.student.email : booking.tutor.email} />
              <hr className="my-5 border-[var(--outline-variant)]" />
              <Participant label={role === "TUTOR" ? "Gia sư (bạn)" : "Học sinh (bạn)"} name={user?.fullName || "Bạn"} subtitle={user?.email || ""} />
            </GlassCard>

            <GlassCard className="bg-[var(--surface-container-high)]/40">
              <h2 className="mb-5 text-xl font-black">Tóm tắt thanh toán</h2>
              <div className="space-y-4">
                <SummaryLine label={`Học phí (${durationMinutes(booking)} phút)`} value={formatMoney(String(sessionFee))} />
                <SummaryLine label="Phí nền tảng" value={formatMoney(String(serviceFee))} />
                <hr className="border-[var(--outline-variant)]" />
                <SummaryLine
                  strong
                  label={refunded ? "Tổng đã hoàn tiền" : paid ? "Tổng đã thanh toán" : "Trạng thái thanh toán"}
                  value={refunded || paid ? formatMoney(payment?.amount) : paymentStatusText(payment)}
                />
                <div className={`mt-4 flex items-center justify-between rounded-lg border p-3 ${paid ? "border-[var(--tertiary)]/20 bg-[var(--tertiary)]/10 text-[var(--tertiary)]" : refunded ? "border-[var(--primary)]/20 bg-[var(--primary-container)]/10 text-[var(--primary)]" : "border-[var(--secondary)]/20 bg-[var(--secondary-fixed)]/30 text-[var(--secondary)]"}`}>
                  <span className="flex items-center gap-2 text-sm font-black">
                    <Icon fill name={paid ? "verified_user" : refunded ? "assignment_return" : "pending"} />
                    {paymentStatusText(payment)}
                  </span>
                  <Icon name="expand_more" />
                </div>
                {refunded ? (
                  <p className="rounded-lg bg-[var(--primary-container)]/10 p-3 text-xs font-semibold text-[var(--primary)]">
                    Tiền đã được hoàn lại cho học sinh{payment?.refundedAt ? ` lúc ${formatDateTime(payment.refundedAt)}` : ""}.
                    {payment?.refundReason ? ` Lý do: ${payment.refundReason}` : ""}
                  </p>
                ) : null}
              </div>
            </GlassCard>

            {showCompleteAction ? (
              <GlassCard>
                <h2 className="mb-3 flex items-center gap-2 text-xl font-black">
                  <Icon className="text-[var(--tertiary)]" fill name="task_alt" />
                  Hoàn thành buổi học
                </h2>
                {booking.status === "COMPLETED" ? (
                  <p className="rounded-lg bg-[var(--tertiary)]/10 p-3 text-sm font-bold text-[var(--tertiary)]">
                    Buổi học đã được đánh dấu hoàn thành.
                  </p>
                ) : (
                  <>
                    <p className="mb-4 text-sm leading-6 text-[var(--on-surface-variant)]">
                      Sau khi buổi học kết thúc, gia sư xác nhận hoàn thành để hệ thống mở đánh giá và ghi nhận thu nhập cho gia sư.
                    </p>
                    <button
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--tertiary)] px-5 py-3 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canComplete || busy}
                      onClick={handleComplete}
                      type="button"
                    >
                      <Icon fill name="task_alt" />
                      Hoàn thành buổi học
                    </button>
                    {completeReason ? (
                      <p className="mt-3 rounded-lg bg-[var(--surface-container-low)] p-3 text-xs font-semibold text-[var(--on-surface-variant)]">
                        {completeReason}
                      </p>
                    ) : null}
                  </>
                )}
              </GlassCard>
            ) : null}

            {canCancel ? (
              <div className="flex flex-col gap-2">
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--error)]/30 py-4 text-sm font-bold text-[var(--error)] hover:bg-[var(--error)]/5 disabled:opacity-60" disabled={busy} onClick={handleCancel} type="button">
                  <Icon name="cancel" /> Hủy lịch học
                </button>
                <p className="text-center text-xs font-semibold text-[var(--on-surface-variant)]">Có thể hủy trước khi buổi học hoàn thành.</p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

function Timeline({ payment, status }: { payment: Payment | Booking["payment"] | null; status: BookingStatus }) {
  const cancelled = status === "CANCELLED";
  const completed = status === "COMPLETED";
  const confirmed = status === "CONFIRMED" || completed;
  const paid = payment?.status === "PAID" || payment?.status === "REFUNDED";
  const refunded = payment?.status === "REFUNDED";

  const steps = cancelled
    ? [
        { label: "Đã yêu cầu", done: true, note: "Đã tạo", tone: "primary" as const },
        { label: "Đã hủy", done: true, note: "Lịch học đã hủy", tone: "error" as const },
        {
          label: refunded ? "Đã hoàn tiền" : paid ? "Chờ hoàn tiền" : "Thanh toán",
          done: refunded || !paid,
          note: refunded ? "Tiền đã hoàn lại" : paid ? "Cần xử lý hoàn tiền" : "Không phát sinh thanh toán",
          tone: refunded ? ("primary" as const) : paid ? ("warning" as const) : ("muted" as const),
        },
      ]
    : [
        { label: "Đã yêu cầu", done: true, note: "Đã tạo", tone: "primary" as const },
        { label: "Đã xác nhận", done: confirmed, note: confirmed ? "Gia sư đã xác nhận" : "Chờ gia sư", tone: "primary" as const },
        { label: "Thanh toán", done: paid, note: paid ? "Đã thanh toán" : "Chờ thanh toán", tone: "primary" as const },
        { label: "Hoàn thành", done: completed, note: completed ? "Hoàn thành" : "--", tone: "primary" as const },
      ];

  const completedSegments = Math.max(0, steps.filter((step) => step.done).length - 1);
  const progressWidth = steps.length > 1 ? String((completedSegments / (steps.length - 1)) * 100) + "%" : "0%";

  return (
    <div className="relative flex items-start justify-between gap-3">
      <div className="absolute left-0 top-5 h-0.5 w-full bg-[var(--outline-variant)]" />
      <div className={["absolute left-0 top-5 h-0.5", cancelled ? "bg-[var(--error)]" : "bg-[var(--primary)]"].join(" ")} style={{ width: progressWidth }} />
      {steps.map((step) => {
        const activeClass = step.tone === "error" ? "bg-[var(--error)] text-white" : step.tone === "warning" ? "bg-[var(--secondary)] text-white" : step.tone === "muted" ? "bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)]" : "bg-[var(--primary)] text-white";
        const inactiveClass = "bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)]";
        const textClass = step.tone === "error" ? "text-[var(--error)]" : step.tone === "warning" ? "text-[var(--secondary)]" : step.done && step.tone !== "muted" ? "text-[var(--primary)]" : "";
        const icon = step.tone === "error" ? "cancel" : step.done ? "check" : "hourglass_empty";

        return (
          <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-2" key={step.label}>
            <div className={["flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm", step.done ? activeClass : inactiveClass].join(" ")}>
              <Icon name={icon} />
            </div>
            <div className="min-w-0 text-center">
              <p className={["break-words text-sm font-black", textClass].join(" ")}>{step.label}</p>
              <p className="break-words text-xs text-[var(--on-surface-variant)]">{step.note}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-white/50 bg-white/80 p-6 shadow-sm backdrop-blur ${className}`}>{children}</section>;
}

function InfoCard({ border, label, note, title, value }: { border: "primary" | "secondary"; label: string; note: string; title: string; value: string }) {
  return (
    <section className={`rounded-xl border border-white/50 bg-white/80 p-6 shadow-sm backdrop-blur ${border === "primary" ? "border-l-4 border-l-[var(--primary)]" : "border-l-4 border-l-[var(--secondary)]"}`}>
      <p className="mb-1 text-xs font-black uppercase tracking-widest text-[var(--on-surface-variant)]">{label}</p>
      <h3 className="text-2xl font-black">{title}</h3>
      <p className={`mt-1 font-black ${border === "primary" ? "text-[var(--primary)]" : "text-[var(--secondary)]"}`}>{value}</p>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{note}</p>
    </section>
  );
}

function Participant({ label, name, subtitle }: { label: string; name: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} />
      <div className="min-w-0">
        <p className="text-xs font-bold text-[var(--on-surface-variant)]">{label}</p>
        <p className="truncate text-lg font-black">{name}</p>
        <p className="truncate text-sm text-[var(--on-surface-variant)]">{subtitle}</p>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  return <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-xl font-black text-[var(--primary)]">{initial}</div>;
}

function SummaryLine({ label, strong = false, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "text-lg font-black" : "text-sm text-[var(--on-surface-variant)]"}>{label}</span>
      <span className={strong ? "text-xl font-black text-[var(--primary)]" : "font-semibold"}>{value}</span>
    </div>
  );
}

function RecentMessage({ message }: { message: Message }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-[var(--surface-container-low)] p-3">
      <Avatar name={message.sender.fullName} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-black">{message.mine ? "Bạn" : message.sender.fullName}</p>
          <span className="text-xs text-[var(--on-surface-variant)]">{formatDateTime(message.createdAt)}</span>
        </div>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{message.body}</p>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return <main className="min-h-screen bg-[var(--surface)] px-5 py-8 md:px-10"><section className="mx-auto min-h-[620px] max-w-[1280px] rounded-xl border border-[var(--outline-variant)] bg-white" /></main>;
}
