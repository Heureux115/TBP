"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Card, CardDescription, CardHeader, CardTitle, Dialog, FeedbackState, Icon, Skeleton, StatusBadge } from "@/components/ui";
import { getCurrentUser, PublicUser } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import { Booking, BookingStatus, cancelBooking, completeBooking, confirmBooking, getBooking } from "@/lib/booking-api";
import { ensureConversation, getMessages, Message } from "@/lib/message-api";
import { createPayment, getMyPayments, mockConfirmPayment, Payment } from "@/lib/payment-api";
import { createReview } from "@/lib/review-api";
import { useHasMounted } from "@/lib/use-has-mounted";

type PaymentLike = Payment | Booking["payment"];
type BookingTone = "danger" | "info" | "neutral" | "success" | "warning";

const bookingStatusMeta: Record<BookingStatus, { label: string; tone: BookingTone }> = {
  PENDING: { label: "Chờ gia sư xác nhận", tone: "warning" },
  CONFIRMED: { label: "Đã xác nhận", tone: "info" },
  CANCELLED: { label: "Đã hủy", tone: "danger" },
  COMPLETED: { label: "Đã hoàn thành", tone: "success" },
};

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

function paymentStatusText(payment: PaymentLike) {
  if (!payment) return "Chưa thanh toán";
  if (payment.status === "PAID") return "Đã thanh toán";
  if (payment.status === "REFUNDED") return "Đã hoàn tiền";
  if (payment.status === "CANCELLED") return "Thanh toán đã hủy";
  if (payment.status === "FAILED") return "Thanh toán thất bại";
  return "Chờ thanh toán";
}

function paymentTone(payment: PaymentLike): BookingTone {
  if (!payment) return "neutral";
  if (payment.status === "PAID" || payment.status === "REFUNDED") return "success";
  if (payment.status === "FAILED" || payment.status === "CANCELLED") return "danger";
  return "warning";
}

function getCompleteUnavailableReason(booking: Booking, paid: boolean) {
  if (booking.status === "COMPLETED") return "";
  if (booking.status !== "CONFIRMED") return "Chỉ lịch học đã xác nhận mới có thể hoàn thành.";
  if (!paid) return "Cần thanh toán thành công trước khi hoàn thành buổi học.";
  if (new Date(booking.startsAt) > new Date()) return "Nút hoàn thành sẽ mở sau khi đến giờ bắt đầu buổi học.";
  return "";
}

function getStatusDescription({ booking, paid, role }: { booking: Booking; paid: boolean; role?: PublicUser["role"] }) {
  if (booking.status === "PENDING") {
    return role === "TUTOR"
      ? "Học viên đã gửi yêu cầu. Hãy xác nhận nếu khung giờ này phù hợp."
      : "Yêu cầu đã được gửi. Gia sư cần xác nhận trước khi bạn thanh toán.";
  }

  if (booking.status === "CONFIRMED" && !paid) {
    return role === "STUDENT"
      ? "Gia sư đã xác nhận. Thanh toán để giữ chỗ và chuẩn bị buổi học."
      : "Lịch đã xác nhận. Hệ thống đang chờ học viên thanh toán.";
  }

  if (booking.status === "CONFIRMED" && paid) {
    return "Lịch học đã sẵn sàng. Hai bên có thể nhắn tin để thống nhất chi tiết trước buổi học.";
  }

  if (booking.status === "COMPLETED") {
    return "Buổi học đã hoàn thành. Thông tin thanh toán và ghi nhận buổi học được lưu lại tại đây.";
  }

  return "Lịch học đã bị hủy. Kiểm tra phần thanh toán để biết trạng thái hoàn tiền nếu có.";
}

export function BookingDetailScreen({ id }: { id: string }) {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<PaymentLike>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [review, setReview] = useState<Booking["review"]>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

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
        setReview(bookingItem.review);
        setPayment(paymentItems.find((item) => item.bookingId === bookingItem.id) || bookingItem.payment);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Không thể tải chi tiết lịch học.");
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
  const bookingsBackHref = role === "TUTOR" ? "/tutor/schedule" : "/bookings";
  const bookingsBackLabel = role === "TUTOR" ? "Quay lại lịch dạy" : "Quay lại lịch học";
  const otherName = useMemo(() => {
    if (!booking) return "";
    return role === "TUTOR" ? booking.student.fullName : booking.tutor.fullName;
  }, [booking, role]);

  async function openChat() {
    const token = getAccessToken();
    if (!token || !booking) return;
    setBusy(true);
    setError("");
    try {
      const conversation = await ensureConversation(token, booking.id);
      router.push(`/messages?conversationId=${conversation.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể mở tin nhắn.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    const token = getAccessToken();
    if (!token || !booking) return;
    setBusy(true);
    setError("");
    try {
      const updated = await cancelBooking(token, booking.id, "Người dùng hủy từ trang chi tiết lịch học.");
      setBooking(updated);
      setPayment(updated.payment);
      setCancelDialogOpen(false);
      setNotice("Lịch học đã được hủy.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể hủy lịch học.");
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
      setNotice("Lịch học đã được xác nhận.");
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
      setReview(updated.review);
      setPayment(updated.payment);
      setNotice("Buổi học đã được đánh dấu hoàn thành.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể hoàn thành buổi học.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateReview() {
    const token = getAccessToken();
    if (!token || !booking || role !== "STUDENT") return;

    setReviewBusy(true);
    setReviewMessage("");
    setError("");

    try {
      const created = await createReview(token, {
        bookingId: booking.id,
        rating: reviewRating,
        comment: reviewComment,
      });
      const nextReview = {
        id: created.id,
        rating: created.rating,
        comment: created.comment,
        createdAt: created.createdAt,
      };
      setReview(nextReview);
      setBooking({ ...booking, review: nextReview });
      setReviewComment("");
      setReviewRating(5);
      setNotice("Cảm ơn bạn đã gửi đánh giá buổi học.");
    } catch (requestError) {
      setReviewMessage(requestError instanceof Error ? requestError.message : "Không thể gửi đánh giá.");
    } finally {
      setReviewBusy(false);
    }
  }

  if (!hasMounted) return <DetailSkeleton />;

  if (error && !booking) {
    return (
      <main className="min-h-screen bg-[var(--surface)] px-5 py-8 text-[var(--on-surface)] md:px-10">
        <div className="mx-auto max-w-[720px] pt-12">
          <FeedbackState
            action={
              <Link className="inline-flex" href={bookingsBackHref}>
                <span className="rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--primary)]">
                  {bookingsBackLabel}
                </span>
              </Link>
            }
            description={error}
            title="Không thể mở lịch học"
            tone="error"
          />
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
  const canComplete = role === "TUTOR" && paid && booking.status === "CONFIRMED" && new Date(booking.startsAt) <= new Date();
  const canReview = role === "STUDENT" && booking.status === "COMPLETED" && !review;
  const showStudentReview = role === "STUDENT" && booking.status === "COMPLETED";
  const showCompleteAction = role === "TUTOR" && (booking.status === "CONFIRMED" || booking.status === "COMPLETED");
  const completeReason = getCompleteUnavailableReason(booking, paid);
  const serviceFee = payment ? Number(payment.platformFeeAmount) : 0;
  const sessionFee = payment ? Number(payment.tutorPayoutAmount) : Number(booking.grossAmountSnapshot || 0);
  const statusMeta = bookingStatusMeta[booking.status];
  const statusDescription = getStatusDescription({ booking, paid, role });
  const isOnlineCapable = booking.teachingMode === "ONLINE" || booking.teachingMode === "BOTH";

  return (
    <main className="min-h-screen bg-[var(--surface)] px-5 py-6 pb-28 text-[var(--on-surface)] md:px-10 lg:pb-10">
      <div className="flex w-full flex-col gap-6">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <Link className="inline-flex items-center gap-1 text-sm font-bold text-[var(--primary)] transition hover:text-[var(--primary-container)]" href={bookingsBackHref}>
              <Icon className="text-base" name="arrow_back" />
              {bookingsBackLabel}
            </Link>
            <p className="text-sm font-semibold text-[var(--on-surface-variant)]">
              Mã lịch học: <span className="font-black text-[var(--primary)]">#{booking.id.slice(0, 8).toUpperCase()}</span>
            </p>
          </div>

          <section className="rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5 shadow-[var(--shadow-panel)] sm:p-6">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
                  <StatusBadge tone={paymentTone(payment)}>{paymentStatusText(payment)}</StatusBadge>
                </div>
                <h1 className="max-w-3xl text-2xl font-black leading-tight text-[var(--primary)] sm:text-3xl">{bookingSubject(booking)}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--on-surface-variant)]">{statusDescription}</p>
              </div>
              <PrimaryActions
                busy={busy}
                canComplete={canComplete}
                canConfirm={canConfirm}
                canPay={canPay}
                isOnlineCapable={isOnlineCapable}
                onChat={openChat}
                onComplete={handleComplete}
                onConfirm={handleConfirm}
                onPay={handlePay}
              />
            </div>
          </section>
        </header>

        {notice ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm font-bold text-[var(--status-success-text)]" role="status">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-bold text-[var(--status-danger-text)]" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-6 lg:col-span-8">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="text-[var(--primary)]" name="timeline" />
                    Tiến trình lịch học
                  </CardTitle>
                  <CardDescription>Nhìn nhanh booking đang ở bước nào và việc tiếp theo là gì.</CardDescription>
                </div>
              </CardHeader>
              <BookingTimeline payment={payment} status={booking.status} />
            </Card>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailFact icon="event" label="Ngày học" value={formatDate(booking.startsAt)} note="GMT+07:00, giờ Việt Nam" />
              <DetailFact icon="schedule" label="Khung giờ" value={formatTimeRange(booking)} note={`${durationMinutes(booking)} phút`} />
              <DetailFact icon={booking.teachingMode === "OFFLINE" ? "location_on" : "video_call"} label="Hình thức" value={teachingModeLabel(booking.teachingMode)} note={isOnlineCapable ? "Trao đổi link lớp trong tin nhắn." : "Gia sư và học viên thống nhất địa điểm."} />
              <DetailFact icon="school" label="Nội dung" value={bookingSubject(booking)} note={booking.studentNote || "Chưa có ghi chú từ học viên."} />
            </section>

            <ParticipantsCard booking={booking} currentUser={user} otherName={otherName} role={role} />

            <Card>
              <CardHeader
                action={
                  <Button onClick={openChat} size="sm" variant="outline">
                    Mở chat
                  </Button>
                }
              >
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="text-[var(--primary)]" name="chat_bubble" />
                    Tin nhắn gần đây
                  </CardTitle>
                  <CardDescription>Những trao đổi mới nhất liên quan đến lịch học này.</CardDescription>
                </div>
              </CardHeader>
              <div className="space-y-3">
                {messages.length ? (
                  messages.map((message) => <RecentMessage key={message.id} message={message} />)
                ) : (
                  <InlineEmpty icon="chat" text="Chưa có tin nhắn trong lịch học này. Hãy nhắn để thống nhất tài liệu, địa điểm hoặc link lớp." />
                )}
              </div>
            </Card>
          </section>

          <aside className="flex flex-col gap-6 lg:col-span-4">
            <PaymentSummary
              booking={booking}
              payment={payment}
              refunded={refunded}
              serviceFee={serviceFee}
              sessionFee={sessionFee}
            />

            {showStudentReview ? (
              <LessonReviewCard
                canReview={canReview}
                comment={reviewComment}
                isBusy={reviewBusy}
                message={reviewMessage}
                onCommentChange={setReviewComment}
                onRatingChange={setReviewRating}
                onSubmit={handleCreateReview}
                rating={reviewRating}
                review={review}
              />
            ) : null}

            {showCompleteAction ? (
              <Card tone={booking.status === "COMPLETED" ? "subtle" : "default"}>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="text-[var(--tertiary)]" fill name="task_alt" />
                  Hoàn thành buổi học
                </CardTitle>
                {booking.status === "COMPLETED" ? (
                  <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--status-success-bg)] p-3 text-sm font-bold text-[var(--status-success-text)]">
                    Buổi học đã được đánh dấu hoàn thành.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                      Sau khi buổi học kết thúc, gia sư xác nhận hoàn thành để hệ thống ghi nhận buổi học và mở bước đánh giá.
                    </p>
                    <Button className="mt-4 w-full" disabled={!canComplete || busy} isLoading={busy && canComplete} onClick={handleComplete} variant="success">
                      Hoàn thành buổi học
                    </Button>
                    {completeReason ? (
                      <p className="mt-3 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-3 text-xs font-semibold text-[var(--on-surface-variant)]">
                        {completeReason}
                      </p>
                    ) : null}
                  </>
                )}
              </Card>
            ) : null}

            <Card tone="subtle">
              <CardTitle className="text-lg">Hỗ trợ và chính sách</CardTitle>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                <p>Thanh toán thành công được giữ để bảo vệ cả học viên và gia sư cho đến khi buổi học được xử lý.</p>
                <p>Nếu cần hủy lịch, hãy sử dụng thao tác bên dưới. Trạng thái hoàn tiền sẽ được cập nhật trong phần thanh toán.</p>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                {canCancel ? (
                  <Button onClick={() => setCancelDialogOpen(true)} variant="danger">
                    Hủy lịch học
                  </Button>
                ) : null}
              </div>
            </Card>
          </aside>
        </div>
      </div>

      <MobileActionBar
        booking={booking}
        busy={busy}
        canComplete={canComplete}
        canConfirm={canConfirm}
        canPay={canPay}
        onComplete={handleComplete}
        onConfirm={handleConfirm}
        onPay={handlePay}
        payment={payment}
      />

      <CancelBookingDialog
        busy={busy}
        onCancel={() => setCancelDialogOpen(false)}
        onConfirm={confirmCancel}
        open={cancelDialogOpen}
        paid={paid}
      />

    </main>
  );
}

function PrimaryActions({
  busy,
  canComplete,
  canConfirm,
  canPay,
  isOnlineCapable,
  onChat,
  onComplete,
  onConfirm,
  onPay,
}: {
  busy: boolean;
  canComplete: boolean;
  canConfirm: boolean;
  canPay: boolean;
  isOnlineCapable: boolean;
  onChat: () => void;
  onComplete: () => void;
  onConfirm: () => void;
  onPay: () => void;
}) {
  const primary = canConfirm
    ? { label: "Xác nhận lịch", onClick: onConfirm, variant: "primary" as const }
    : canPay
      ? { label: "Thanh toán", onClick: onPay, variant: "payment" as const }
      : canComplete
        ? { label: "Hoàn thành buổi học", onClick: onComplete, variant: "success" as const }
        : null;

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[240px]">
      {primary ? (
        <Button className="hidden w-full lg:inline-flex" isLoading={busy} onClick={primary.onClick} size="lg" variant={primary.variant}>
          {primary.label}
        </Button>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button disabled={busy} onClick={onChat} variant="outline">
          Nhắn tin
        </Button>
        <Button disabled={!isOnlineCapable} title={isOnlineCapable ? "Trao đổi link lớp trong tin nhắn." : "Lịch này không phải buổi học online."} variant="secondary">
          {isOnlineCapable ? "Vào lớp" : "Offline"}
        </Button>
      </div>
    </div>
  );
}

function BookingTimeline({ payment, status }: { payment: PaymentLike; status: BookingStatus }) {
  const cancelled = status === "CANCELLED";
  const completed = status === "COMPLETED";
  const confirmed = status === "CONFIRMED" || completed;
  const paid = payment?.status === "PAID" || payment?.status === "REFUNDED";
  const refunded = payment?.status === "REFUNDED";

  const steps = cancelled
    ? [
        { label: "Đã yêu cầu", done: true, note: "Booking đã được tạo", tone: "info" as const },
        { label: "Đã hủy", done: true, note: "Lịch học không còn hiệu lực", tone: "danger" as const },
        {
          label: refunded ? "Đã hoàn tiền" : paid ? "Chờ hoàn tiền" : "Không phát sinh thanh toán",
          done: refunded || !paid,
          note: refunded ? "Tiền đã hoàn lại" : paid ? "Cần xử lý hoàn tiền" : "Không cần thanh toán",
          tone: refunded ? ("success" as const) : paid ? ("warning" as const) : ("neutral" as const),
        },
      ]
    : [
        { label: "Đã yêu cầu", done: true, note: "Học viên gửi yêu cầu", tone: "info" as const },
        { label: "Gia sư xác nhận", done: confirmed, note: confirmed ? "Đã xác nhận" : "Đang chờ", tone: "info" as const },
        { label: "Thanh toán", done: paid, note: paid ? "Đã thanh toán" : "Chờ thanh toán", tone: paid ? ("success" as const) : ("warning" as const) },
        { label: "Hoàn thành", done: completed, note: completed ? "Đã hoàn thành" : "Sau buổi học", tone: "success" as const },
      ];

  const completedSegments = Math.max(0, steps.filter((step) => step.done).length - 1);
  const progressWidth = steps.length > 1 ? `${(completedSegments / (steps.length - 1)) * 100}%` : "0%";

  return (
    <div className="space-y-4">
      <div className="hidden md:block">
        <div className="relative flex items-start justify-between gap-3">
          <div className="absolute left-0 top-5 h-0.5 w-full bg-[var(--outline-variant)]" />
          <div className={["absolute left-0 top-5 h-0.5", cancelled ? "bg-[var(--error)]" : "bg-[var(--primary)]"].join(" ")} style={{ width: progressWidth }} />
          {steps.map((step) => (
            <TimelineStep done={step.done} key={step.label} label={step.label} note={step.note} tone={step.tone} />
          ))}
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {steps.map((step, index) => (
          <div className="flex gap-3" key={step.label}>
            <div className="flex flex-col items-center">
              <TimelineDot done={step.done} tone={step.tone} />
              {index < steps.length - 1 ? <span className="mt-2 h-8 w-px bg-[var(--outline-variant)]" /> : null}
            </div>
            <div className="pb-2">
              <p className="font-black text-[var(--on-surface)]">{step.label}</p>
              <p className="text-sm text-[var(--on-surface-variant)]">{step.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineStep({ done, label, note, tone }: { done: boolean; label: string; note: string; tone: BookingTone }) {
  return (
    <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-2">
      <TimelineDot done={done} tone={tone} />
      <div className="min-w-0 text-center">
        <p className="break-words text-sm font-black text-[var(--on-surface)]">{label}</p>
        <p className="break-words text-xs text-[var(--on-surface-variant)]">{note}</p>
      </div>
    </div>
  );
}

function TimelineDot({ done, tone }: { done: boolean; tone: BookingTone }) {
  const toneClass = done
    ? tone === "danger"
      ? "bg-[var(--error)] text-white"
      : tone === "warning"
        ? "bg-[var(--secondary)] text-white"
        : tone === "success"
          ? "bg-[var(--tertiary)] text-white"
          : "bg-[var(--primary)] text-white"
    : "bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)]";

  return (
    <span className={["flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-[var(--shadow-panel)]", toneClass].join(" ")}>
      <Icon name={tone === "danger" ? "cancel" : done ? "check" : "hourglass_empty"} />
    </span>
  );
}

function DetailFact({ icon, label, note, value }: { icon: string; label: string; note: string; value: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-container-low)] text-[var(--primary)]">
          <Icon name={icon} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--on-surface-variant)]">{label}</p>
          <p className="mt-1 break-words text-base font-black text-[var(--on-surface)]">{value}</p>
          <p className="mt-1 break-words text-sm leading-5 text-[var(--on-surface-variant)]">{note}</p>
        </div>
      </div>
    </Card>
  );
}

function ParticipantsCard({
  booking,
  currentUser,
  otherName,
  role,
}: {
  booking: Booking;
  currentUser: PublicUser | null;
  otherName: string;
  role?: PublicUser["role"];
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Icon className="text-[var(--primary)]" name="group" />
            Người tham gia
          </CardTitle>
          <CardDescription>Thông tin liên hệ chính cho buổi học này.</CardDescription>
        </div>
      </CardHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Participant
          avatarUrl={role === "TUTOR" ? null : booking.tutor.avatarUrl}
          label={role === "TUTOR" ? "Học viên" : "Gia sư"}
          name={otherName}
          subtitle={role === "TUTOR" ? booking.student.email : booking.tutor.email}
        />
        <Participant
          avatarUrl={role === "TUTOR" ? booking.tutor.avatarUrl : null}
          label={role === "TUTOR" ? "Gia sư (bạn)" : "Học viên (bạn)"}
          name={currentUser?.fullName || "Bạn"}
          subtitle={currentUser?.email || ""}
        />
      </div>
    </Card>
  );
}

function Participant({ avatarUrl, label, name, subtitle }: { avatarUrl?: null | string; label: string; name: string; subtitle: string }) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
      <Avatar name={name} size="lg" src={avatarUrl} />
      <div className="min-w-0">
        <p className="text-xs font-bold text-[var(--on-surface-variant)]">{label}</p>
        <p className="truncate text-lg font-black">{name}</p>
        <p className="truncate text-sm text-[var(--on-surface-variant)]">{subtitle}</p>
      </div>
    </div>
  );
}

function LessonReviewCard({
  canReview,
  comment,
  isBusy,
  message,
  onCommentChange,
  onRatingChange,
  onSubmit,
  rating,
  review,
}: {
  canReview: boolean;
  comment: string;
  isBusy: boolean;
  message: string;
  onCommentChange: (value: string) => void;
  onRatingChange: (value: number) => void;
  onSubmit: () => void;
  rating: number;
  review: Booking["review"];
}) {
  return (
    <Card>
      <CardTitle className="flex items-center gap-2">
        <Icon className="text-[var(--secondary)]" fill name="star" />
        Đánh giá buổi học
      </CardTitle>
      {review ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4 text-[var(--status-success-text)]">
            <div className="flex items-center justify-between gap-3">
              <Stars rating={review.rating} />
              <span className="text-xs font-bold">{formatDateTime(review.createdAt)}</span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6">
              {review.comment || "Bạn đã gửi đánh giá sao cho buổi học này."}
            </p>
          </div>
          <p className="text-xs font-semibold leading-5 text-[var(--on-surface-variant)]">
            Mỗi buổi học chỉ được đánh giá một lần để giữ phản hồi nhất quán.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-[var(--on-surface-variant)]">
            Chia sẻ trải nghiệm của bạn sau buổi học. Đánh giá sẽ hiển thị công khai trên hồ sơ gia sư.
          </p>
          <StarRatingInput disabled={!canReview || isBusy} onChange={onRatingChange} value={rating} />
          <textarea
            className="min-h-28 w-full resize-y rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canReview || isBusy}
            maxLength={1000}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Bạn hài lòng điều gì? Gia sư có chuẩn bị tốt, giải thích dễ hiểu không?"
            value={comment}
          />
          <Button className="w-full" disabled={!canReview} isLoading={isBusy} leftIcon={<Icon name="rate_review" />} onClick={onSubmit}>
            Gửi đánh giá
          </Button>
          {message ? <p className="text-sm font-semibold text-[var(--error)]">{message}</p> : null}
        </div>
      )}
    </Card>
  );
}

function StarRatingInput({ disabled, onChange, value }: { disabled: boolean; onChange: (value: number) => void; value: number }) {
  const [hoverRating, setHoverRating] = useState(0);
  const previewRating = hoverRating || value;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[var(--on-surface-variant)]">Số sao</span>
        <span className="rounded-[var(--radius-full)] bg-[var(--surface-container-high)] px-3 py-1 text-xs font-black text-[var(--primary)]">
          {value} sao
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2" onMouseLeave={() => setHoverRating(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            aria-label={`${star} sao`}
            aria-pressed={value === star}
            className={[
              "inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border px-2 py-2 text-[var(--secondary)] transition focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60",
              star <= previewRating
                ? "border-[var(--secondary)] bg-[var(--secondary-container)] text-[var(--on-secondary-container)]"
                : "border-[var(--outline-variant)] bg-white hover:bg-[var(--surface-container-high)]",
            ].join(" ")}
            disabled={disabled}
            key={star}
            onClick={() => onChange(star)}
            onFocus={() => setHoverRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            type="button"
          >
            <Icon className="text-[22px]" fill={star <= previewRating} name="star" />
            <span className="text-[11px] font-black leading-none">{star}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div aria-label={`${rating} sao`} className="flex shrink-0 items-center gap-0.5 text-[var(--secondary)]">
      {[0, 1, 2, 3, 4].map((index) => (
        <Icon fill={index < rating} key={index} name="star" />
      ))}
    </div>
  );
}

function PaymentSummary({
  booking,
  payment,
  refunded,
  serviceFee,
  sessionFee,
}: {
  booking: Booking;
  payment: PaymentLike;
  refunded: boolean;
  serviceFee: number;
  sessionFee: number;
}) {
  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Icon className="text-[var(--secondary)]" fill name="payments" />
            Thanh toán
          </CardTitle>
          <CardDescription>Học phí, phí nền tảng và trạng thái thanh toán.</CardDescription>
        </div>
      </CardHeader>
      <div className="space-y-4">
        <SummaryLine label={`Học phí (${durationMinutes(booking)} phút)`} value={formatMoney(String(sessionFee))} />
        <SummaryLine label="Phí nền tảng" value={formatMoney(String(serviceFee))} />
        <hr className="border-[var(--outline-variant)]" />
        <SummaryLine
          strong
          label={refunded ? "Tổng đã hoàn tiền" : payment?.status === "PAID" ? "Tổng đã thanh toán" : "Tổng tiền"}
          value={payment ? formatMoney(payment.amount) : formatMoney(booking.grossAmountSnapshot)}
        />
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3">
          <StatusBadge tone={paymentTone(payment)}>{paymentStatusText(payment)}</StatusBadge>
          {payment?.paidAt ? <span className="text-xs font-semibold text-[var(--on-surface-variant)]">{formatDateTime(payment.paidAt)}</span> : null}
        </div>
        {refunded ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--status-info-bg)] p-3 text-xs font-semibold leading-5 text-[var(--status-info-text)]">
            Tiền đã được hoàn lại cho học viên{payment?.refundedAt ? ` lúc ${formatDateTime(payment.refundedAt)}` : ""}.
            {payment?.refundReason ? ` Lý do: ${payment.refundReason}` : ""}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function SummaryLine({ label, strong = false, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className={strong ? "font-black text-[var(--on-surface)]" : "text-sm text-[var(--on-surface-variant)]"}>{label}</span>
      <span className={strong ? "text-right text-xl font-black text-[var(--primary)]" : "text-right text-sm font-bold text-[var(--on-surface)]"}>{value}</span>
    </div>
  );
}

function RecentMessage({ message }: { message: Message }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-3">
      <Avatar name={message.sender.fullName} size="md" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-black">{message.mine ? "Bạn" : message.sender.fullName}</p>
          <span className="text-xs text-[var(--on-surface-variant)]">{formatDateTime(message.createdAt)}</span>
        </div>
        <p className="mt-1 break-words text-sm leading-6 text-[var(--on-surface-variant)]">{message.body}</p>
      </div>
    </div>
  );
}

function InlineEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-sm leading-6 text-[var(--on-surface-variant)]">
      <Icon className="mt-0.5 text-[var(--primary)]" name={icon} />
      <p>{text}</p>
    </div>
  );
}

function MobileActionBar({
  booking,
  busy,
  canComplete,
  canConfirm,
  canPay,
  onComplete,
  onConfirm,
  onPay,
  payment,
}: {
  booking: Booking;
  busy: boolean;
  canComplete: boolean;
  canConfirm: boolean;
  canPay: boolean;
  onComplete: () => void;
  onConfirm: () => void;
  onPay: () => void;
  payment: PaymentLike;
}) {
  const action = canConfirm
    ? { label: "Xác nhận", onClick: onConfirm, variant: "primary" as const }
    : canPay
      ? { label: "Thanh toán", onClick: onPay, variant: "payment" as const }
      : canComplete
        ? { label: "Hoàn thành", onClick: onComplete, variant: "success" as const }
        : null;

  if (!action) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-[var(--outline-variant)] bg-white px-4 py-3 shadow-[var(--shadow-nav)] lg:hidden">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{bookingSubject(booking)}</p>
          <p className="text-xs font-semibold text-[var(--on-surface-variant)]">{paymentStatusText(payment)}</p>
        </div>
        <Button isLoading={busy} onClick={action.onClick} variant={action.variant}>
          {action.label}
        </Button>
      </div>
    </div>
  );
}

function CancelBookingDialog({
  busy,
  onCancel,
  onConfirm,
  open,
  paid,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  paid: boolean;
}) {
  return (
    <Dialog
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      description={
        paid
          ? "Lịch này đã thanh toán. Hủy lịch có thể tạo hoàn tiền cho học viên và cập nhật trạng thái liên quan."
          : "Lịch sẽ bị hủy và hai bên sẽ không còn thấy lịch này là buổi học sắp tới."
      }
      onClose={onCancel}
      open={open}
      role="alertdialog"
      title="Hủy lịch học này?"
    >
      <div className="space-y-4 p-6">
        <div className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4 text-sm leading-6 text-[var(--status-danger-text)]">
          Hành động này ảnh hưởng đến lịch học và thanh toán. Chỉ tiếp tục khi bạn chắc chắn muốn hủy.
        </div>
      </div>
      <footer className="grid grid-cols-2 gap-3 bg-[var(--surface-container-low)] p-4">
        <Button data-dialog-initial-focus disabled={busy} onClick={onCancel} variant="outline">
          Giữ lịch
        </Button>
        <Button isLoading={busy} onClick={onConfirm} variant="danger">
          Xác nhận hủy
        </Button>
      </footer>
    </Dialog>
  );
}

function DetailSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--surface)] px-5 py-6 text-[var(--on-surface)] md:px-10">
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-8">
          <Card>
            <Skeleton className="h-7 w-44" />
            <Skeleton className="mt-4 h-10 w-3/4" />
            <Skeleton className="mt-3 h-5 w-full" />
          </Card>
          <Card>
            <Skeleton className="h-7 w-52" />
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </Card>
        </section>
        <aside className="space-y-6 lg:col-span-4">
          <Card>
            <Skeleton className="h-7 w-36" />
            <Skeleton className="mt-5 h-5 w-full" />
            <Skeleton className="mt-3 h-5 w-5/6" />
            <Skeleton className="mt-6 h-12 w-full" />
          </Card>
          <Card>
            <Skeleton className="h-7 w-44" />
            <Skeleton className="mt-5 h-28 w-full" />
          </Card>
        </aside>
      </div>
    </main>
  );
}
