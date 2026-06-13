"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PublicShell } from "./public-shell";
import type { BookingTeachingMode } from "@/lib/booking-api";
import {
  getPublicTutor,
  getPublicTutorAvailability,
  PublicTutorDetail,
  TutorAvailabilitySlot,
} from "@/lib/discovery-api";
import { createBooking } from "@/lib/booking-api";
import {
  createReview,
  getEligibleReviewBookings,
  getTutorReviews,
  type EligibleReviewBooking,
  type Review,
} from "@/lib/review-api";
import { useAuthStore } from "@/lib/auth-store";
import { useHasMounted } from "@/lib/use-has-mounted";
import { Avatar, Badge, Button, Card, Dialog, FeedbackState, Icon, Skeleton, StatusBadge } from "@/components/ui";

type DetailState = "loading" | "ready" | "not-found" | "error";

function formatMoney(value: string | null) {
  const amount = Number(value || 0);
  if (!amount) return "Liên hệ";
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

function teachingModeLabel(mode: string) {
  if (mode === "ONLINE") return "Online";
  if (mode === "OFFLINE") return "Trực tiếp";
  return "Online & trực tiếp";
}

const levelLabels: Record<string, string> = {
  PRIMARY: "Tiểu học",
  LOWER_SECONDARY: "Cấp 2",
  HIGH_SCHOOL: "Cấp 3",
  UNIVERSITY: "Đại học",
  BASIC: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
  EXAM_PREP: "Luyện thi",
};

function documentLabel(type: string) {
  const labels: Record<string, string> = {
    NATIONAL_ID_FRONT: "CCCD mặt trước",
    NATIONAL_ID_BACK: "CCCD mặt sau",
    DEGREE: "Bằng cấp",
    CERTIFICATE: "Chứng chỉ",
    BACKGROUND_CHECK: "Xác minh lý lịch",
    OTHER: "Tài liệu khác",
  };
  return labels[type] || type;
}

function weekStart(date = new Date()) {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = current.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  current.setUTCDate(current.getUTCDate() + offset);
  return current;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function TutorDetailScreen({ id }: { id: string }) {
  const hasMounted = useHasMounted();
  const [forcedState, setForcedState] = useState<DetailState | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [tutor, setTutor] = useState<PublicTutorDetail | null>(null);
  const [slots, setSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eligibleBookings, setEligibleBookings] = useState<EligibleReviewBooking[]>([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [showBookingConfirm, setShowBookingConfirm] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState("");
  const [selectedTeachingMode, setSelectedTeachingMode] = useState<Exclude<BookingTeachingMode, "BOTH">>("ONLINE");
  const [selectedReviewBookingId, setSelectedReviewBookingId] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [week, setWeek] = useState(weekStart());
  const [error, setError] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const auth = useAuthStore();
  const effectiveState = forcedState && forcedState !== "ready" ? forcedState : state;
  const selectedSlots = useMemo(
    () =>
      slots
        .filter((slot) => selectedSlotIds.includes(slot.id))
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [selectedSlotIds, slots],
  );

  useEffect(() => {
    const stateParam = new URLSearchParams(window.location.search).get("state") as DetailState | null;
    queueMicrotask(() => {
      setForcedState(stateParam);
      if (stateParam && stateParam !== "ready") {
        setState(stateParam);
      }
    });
  }, []);

  async function handleCreateBooking() {
    if (!selectedSlotIds.length) return;
    if (!auth.token) {
      window.location.href = `/auth/login?next=${encodeURIComponent(`/tutors/${id}`)}`;
      return;
    }
    if (auth.user?.role !== "STUDENT") {
      setBookingMessage("Chỉ tài khoản học sinh mới có thể đặt lịch.");
      return;
    }

    setIsBooking(true);
    setBookingMessage("");
    setCreatedBookingId("");
    try {
      const createdBookings = [];
      for (const slotId of selectedSlotIds) {
        const booking = await createBooking(auth.token, slotId, selectedTeachingMode);
        createdBookings.push(booking);
      }
      setBookingMessage(
        createdBookings.length === 1
          ? "Đã gửi yêu cầu đặt lịch. Gia sư cần xác nhận trước khi bạn thanh toán."
          : `Đã gửi ${createdBookings.length} yêu cầu đặt lịch. Gia sư cần xác nhận từng buổi trước khi bạn thanh toán.`,
      );
      setCreatedBookingId(createdBookings[0]?.id || "");
      setSelectedSlotIds([]);
      setShowBookingConfirm(false);
      const availability = await getPublicTutorAvailability(id, week.toISOString());
      setSlots(availability.slots);
    } catch (requestError) {
      setBookingMessage(requestError instanceof Error ? requestError.message : "Không thể đặt lịch.");
    } finally {
      setIsBooking(false);
    }
  }

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    if (forcedState && forcedState !== "ready") {
      return;
    }

    queueMicrotask(() => {
      setState("loading");
      setError("");
    });

    Promise.all([getPublicTutor(id), getPublicTutorAvailability(id, week.toISOString()), getTutorReviews(id)])
      .then(([profile, availability, tutorReviews]) => {
        setTutor(profile);
        setSlots(availability.slots);
        setReviews(tutorReviews);
        setState("ready");
      })
      .catch((requestError: Error) => {
        setError(requestError.message);
        setState(requestError.message.toLowerCase().includes("not found") ? "not-found" : "error");
      });
  }, [forcedState, hasMounted, id, week]);

  useEffect(() => {
    queueMicrotask(() => {
      if (tutor?.teachingMode === "OFFLINE") {
        setSelectedTeachingMode("OFFLINE");
      }

      if (tutor?.teachingMode === "ONLINE") {
        setSelectedTeachingMode("ONLINE");
      }
    });
  }, [tutor?.teachingMode]);

  useEffect(() => {
    if (!auth.token || auth.user?.role !== "STUDENT") {
      queueMicrotask(() => setEligibleBookings([]));
      return;
    }

    getEligibleReviewBookings(auth.token, id)
      .then((bookings) => {
        setEligibleBookings(bookings);
        setSelectedReviewBookingId(bookings[0]?.id || "");
      })
      .catch(() => setEligibleBookings([]));
  }, [auth.token, auth.user?.role, id]);

  async function handleCreateReview() {
    if (!auth.token || !selectedReviewBookingId) return;

    setIsReviewing(true);
    setReviewMessage("");

    try {
      await createReview(auth.token, {
        bookingId: selectedReviewBookingId,
        rating: reviewRating,
        comment: reviewComment,
      });
      setReviewComment("");
      setReviewRating(5);
      setReviewMessage("Cảm ơn bạn đã gửi đánh giá.");
      const [updatedReviews, updatedEligible] = await Promise.all([
        getTutorReviews(id),
        getEligibleReviewBookings(auth.token, id),
      ]);
      setReviews(updatedReviews);
      setEligibleBookings(updatedEligible);
      setSelectedReviewBookingId(updatedEligible[0]?.id || "");
    } catch (requestError) {
      setReviewMessage(requestError instanceof Error ? requestError.message : "Không thể gửi đánh giá.");
    } finally {
      setIsReviewing(false);
    }
  }

  const location = useMemo(() => {
    if (!tutor) return "";
    return [tutor.locationDistrict, tutor.locationCity].filter(Boolean).join(", ") || "Chưa cập nhật";
  }, [tutor]);

  if (!hasMounted) {
    return (
      <PublicShell>
        <main className="w-full px-4 pb-12 pt-28 sm:px-6 lg:px-8">
          <DetailSkeleton />
        </main>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <main className="w-full px-4 pb-28 pt-28 sm:px-6 lg:px-8 lg:pb-12">
        <Link className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] px-2 text-sm font-bold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]" href="/tutors">
          <Icon className="text-[20px]" name="arrow_back" />
          Quay lại danh sách
        </Link>

        {effectiveState === "loading" ? <DetailSkeleton /> : null}
        {effectiveState === "error" ? <StatePanel icon="cloud_off" title="Không tải được hồ sơ" message={error || "Vui lòng thử lại sau."} /> : null}
        {effectiveState === "not-found" ? (
          <StatePanel
            icon="person_off"
            title="Không tìm thấy gia sư"
            message="Hồ sơ có thể chưa được duyệt, đã tạm ẩn hoặc đường dẫn không chính xác."
          />
        ) : null}

        {effectiveState === "ready" && tutor ? (
          <>
            <HeroProfile location={location} reviewCount={reviews.length} tutor={tutor} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-6">
                <TrustSummary tutor={tutor} />
                <AboutSection tutor={tutor} />
                <SubjectsAndDocuments tutor={tutor} />
                <ReviewsSection
                  authRole={auth.user?.role}
                  eligibleBookings={eligibleBookings}
                  isReviewing={isReviewing}
                  onCreateReview={handleCreateReview}
                  reviewComment={reviewComment}
                  reviewMessage={reviewMessage}
                  reviewRating={reviewRating}
                  reviews={reviews}
                  selectedReviewBookingId={selectedReviewBookingId}
                  setReviewComment={setReviewComment}
                  setReviewRating={setReviewRating}
                  setSelectedReviewBookingId={setSelectedReviewBookingId}
                  tutor={tutor}
                />
              </div>

              <aside className="space-y-6 lg:col-span-6">
                <BookingPanel
                  bookingMessage={bookingMessage}
                  createdBookingId={createdBookingId}
                  isBooking={isBooking}
                  onOpenConfirm={() => setShowBookingConfirm(true)}
                  selectedSlotIds={selectedSlotIds}
                  selectedSlots={selectedSlots}
                  selectedTeachingMode={selectedTeachingMode}
                  setSelectedSlotIds={setSelectedSlotIds}
                  setSelectedTeachingMode={setSelectedTeachingMode}
                  setWeek={setWeek}
                  slots={slots}
                  tutor={tutor}
                  week={week}
                />
              </aside>
            </div>

            <MobileBookingBar
              isBooking={isBooking}
              onOpenConfirm={() => setShowBookingConfirm(true)}
              selectedCount={selectedSlotIds.length}
              tutor={tutor}
            />
          </>
        ) : null}
      </main>
      {showBookingConfirm && tutor && selectedSlots.length ? (
        <BookingConfirmModal
          busy={isBooking}
          mode={selectedTeachingMode}
          onCancel={() => setShowBookingConfirm(false)}
          onConfirm={handleCreateBooking}
          slots={selectedSlots}
          tutor={tutor}
        />
      ) : null}
    </PublicShell>
  );
}

function HeroProfile({
  location,
  reviewCount,
  tutor,
}: {
  location: string;
  reviewCount: number;
  tutor: PublicTutorDetail;
}) {
  return (
    <Card className="mb-6 p-5 sm:p-6">
      <section className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)_minmax(220px,auto)] lg:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative shrink-0">
            <Avatar className="h-24 w-24 border-4 border-[var(--surface-container-highest)] text-3xl sm:h-32 sm:w-32" name={tutor.fullName} size="xl" src={tutor.avatarUrl} />
            {tutor.verified ? (
              <span className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[var(--tertiary-container)] text-white">
                <Icon className="text-[18px]" fill name="verified" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 lg:hidden">
            <ProfileHeading tutor={tutor} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="hidden lg:block">
            <ProfileHeading tutor={tutor} />
          </div>
          <div className="mt-4 grid gap-3 text-sm font-semibold text-[var(--on-surface-variant)] sm:grid-cols-3">
            <InfoPill icon="star" tone="warning">
              <strong>{Number(tutor.ratingAvg).toFixed(1)}</strong>
              <span>{reviewCount ? `${reviewCount} đánh giá` : `${tutor.totalSessions} buổi học`}</span>
            </InfoPill>
            <InfoPill icon="location_on">{location}</InfoPill>
            <InfoPill icon="laptop_mac">{teachingModeLabel(tutor.teachingMode)}</InfoPill>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
          <p className="text-xs font-bold text-[var(--outline)]">Học phí</p>
          <p className="mt-1 text-3xl font-black leading-tight text-[var(--primary)]">
            {formatMoney(tutor.hourlyRate)}
            <span className="ml-1 text-sm font-semibold text-[var(--outline)]">/giờ</span>
          </p>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <a className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--secondary-container)] px-4 py-2.5 text-sm font-black text-[var(--on-secondary-container)] transition hover:bg-[var(--secondary)] hover:text-[var(--on-secondary)]" href="#availability">
              Xem lịch rảnh
            </a>
            <Link
              aria-label="Nhắn tin với gia sư"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white text-[var(--primary)] transition hover:bg-[var(--surface-container-low)]"
              href="/messages"
            >
              <Icon name="mail" />
            </Link>
          </div>
        </div>
      </section>
    </Card>
  );
}

function ProfileHeading({ tutor }: { tutor: PublicTutorDetail }) {
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h1 className="max-w-full truncate text-2xl font-black leading-tight text-[var(--on-surface)] sm:text-4xl" title={tutor.fullName}>
          {tutor.fullName}
        </h1>
        {tutor.verified ? <StatusBadge tone="success">Đã xác thực</StatusBadge> : <StatusBadge tone="neutral">Đang cập nhật</StatusBadge>}
      </div>
      <p className="mt-2 max-w-3xl text-base font-bold leading-6 text-[var(--primary)] sm:text-lg">
        {tutor.headline || "Gia sư chuyên môn cao"}
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--on-surface-variant)]">
        {tutor.bioExcerpt || "Xem lịch rảnh, môn học và đánh giá để quyết định đặt buổi học phù hợp."}
      </p>
    </>
  );
}

function InfoPill({ children, icon, tone = "neutral" }: { children: ReactNode; icon: string; tone?: "neutral" | "warning" }) {
  return (
    <span className="flex min-h-11 min-w-0 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] px-3">
      <Icon className={tone === "warning" ? "text-[var(--secondary)]" : "text-[var(--outline)]"} fill={tone === "warning"} name={icon} />
      <span className="flex min-w-0 items-center gap-1 truncate">{children}</span>
    </span>
  );
}

function TrustSummary({ tutor }: { tutor: PublicTutorDetail }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard icon="workspace_premium" label="Kinh nghiệm" value={tutor.experienceYears ? `${tutor.experienceYears} năm` : "Mới"} />
      <MetricCard icon="event_available" label="Buổi học" value={`${tutor.totalSessions}`} />
      <MetricCard icon="shield" label="Xác minh" value={tutor.verified ? "Đã duyệt" : "Đang cập nhật"} />
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-fixed)] text-[var(--primary)]">
          <Icon name={icon} />
        </span>
        <div>
          <p className="text-xs font-bold text-[var(--outline)]">{label}</p>
          <p className="text-lg font-black text-[var(--on-surface)]">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function AboutSection({ tutor }: { tutor: PublicTutorDetail }) {
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-2xl font-black text-[var(--on-surface)]">
        <Icon className="text-[var(--primary)]" name="person_book" />
        Giới thiệu
      </h2>
      <p className="mt-4 whitespace-pre-line text-base leading-8 text-[var(--on-surface-variant)]">
        {tutor.bio || tutor.bioExcerpt || "Gia sư chưa cập nhật phần giới thiệu chi tiết."}
      </p>
    </Card>
  );
}

function SubjectsAndDocuments({ tutor }: { tutor: PublicTutorDetail }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <h2 className="text-xl font-black text-[var(--on-surface)]">Môn học</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {tutor.subjects.length ? (
            tutor.subjects.map((item) => (
              <Badge key={item.id} tone="neutral">
                <span className="truncate">
                  {item.subject.name} · {levelLabels[item.level] || item.level}
                </span>
              </Badge>
            ))
          ) : (
            <p className="text-sm text-[var(--on-surface-variant)]">Chưa cập nhật môn học.</p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 text-xl font-black text-[var(--on-surface)]">
          <Icon className="text-[var(--tertiary)]" fill name="verified_user" />
          Tài liệu xác minh
        </h2>
        <div className="mt-4 space-y-3">
          {tutor.verifiedDocuments.length ? (
            tutor.verifiedDocuments.map((document) => (
              <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-3" key={document.id}>
                <Icon className="mt-0.5 text-[var(--tertiary)]" fill name="check_circle" />
                <div>
                  <p className="font-bold text-[var(--on-surface)]">{documentLabel(document.type)}</p>
                  <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Đã được TutorConnect kiểm duyệt</p>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-3 text-sm font-semibold text-[var(--on-surface-variant)]">
              Hồ sơ đã duyệt, tài liệu không hiển thị công khai.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function ReviewsSection({
  authRole,
  eligibleBookings,
  isReviewing,
  onCreateReview,
  reviewComment,
  reviewMessage,
  reviewRating,
  reviews,
  selectedReviewBookingId,
  setReviewComment,
  setReviewRating,
  setSelectedReviewBookingId,
  tutor,
}: {
  authRole?: string;
  eligibleBookings: EligibleReviewBooking[];
  isReviewing: boolean;
  onCreateReview: () => void;
  reviewComment: string;
  reviewMessage: string;
  reviewRating: number;
  reviews: Review[];
  selectedReviewBookingId: string;
  setReviewComment: (value: string) => void;
  setReviewRating: (value: number) => void;
  setSelectedReviewBookingId: (value: string) => void;
  tutor: PublicTutorDetail;
}) {
  return (
    <Card>
      <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black text-[var(--on-surface)]">
            <Icon className="text-[var(--secondary)]" fill name="star" />
            Đánh giá từ học viên
          </h2>
          <p className="mt-1 text-sm font-semibold text-[var(--on-surface-variant)]">
            {Number(tutor.ratingAvg).toFixed(1)} / 5 từ {reviews.length} đánh giá công khai
          </p>
        </div>
      </div>

      {reviews.length ? (
        <div className="space-y-3">
          {reviews.slice(0, 3).map((review) => (
            <article className="rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4" key={review.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-[var(--on-surface)]">{review.student.fullName}</p>
                <span className="text-sm font-black text-[var(--secondary)]">
                  {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                </span>
              </div>
              {review.comment ? <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">{review.comment}</p> : null}
            </article>
          ))}
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--primary)] bg-white px-4 py-2.5 text-sm font-black text-[var(--primary)] transition hover:bg-[var(--primary-fixed)]"
            href={`/tutors/${tutor.id}/reviews`}
          >
            Xem tất cả đánh giá
            <Icon className="text-[18px]" name="arrow_forward" />
          </Link>
        </div>
      ) : (
        <FeedbackState
          className="min-h-48"
          description="Gia sư chưa có đánh giá công khai. Bạn vẫn có thể dựa vào xác minh hồ sơ, môn học và lịch rảnh để ra quyết định."
          title="Chưa có đánh giá"
          tone="empty"
        />
      )}

      {authRole === "STUDENT" && eligibleBookings.length ? (
        <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
          <h3 className="text-base font-black text-[var(--on-surface)]">Gửi đánh giá sau buổi học</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <select
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              onChange={(event) => setSelectedReviewBookingId(event.target.value)}
              value={selectedReviewBookingId}
            >
              {eligibleBookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {new Date(booking.startsAt).toLocaleDateString("vi-VN")} · {new Date(booking.startsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </option>
              ))}
            </select>
            <select
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              onChange={(event) => setReviewRating(Number(event.target.value))}
              value={reviewRating}
            >
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} sao
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="mt-3 min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            maxLength={1000}
            onChange={(event) => setReviewComment(event.target.value)}
            placeholder="Chia sẻ trải nghiệm học của bạn"
            value={reviewComment}
          />
          <Button className="mt-3" disabled={!selectedReviewBookingId} isLoading={isReviewing} onClick={onCreateReview}>
            Gửi đánh giá
          </Button>
          {reviewMessage ? <p className="mt-2 text-sm font-semibold text-[var(--on-surface-variant)]">{reviewMessage}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

function BookingPanel({
  bookingMessage,
  createdBookingId,
  isBooking,
  onOpenConfirm,
  selectedSlotIds,
  selectedSlots,
  selectedTeachingMode,
  setSelectedSlotIds,
  setSelectedTeachingMode,
  setWeek,
  slots,
  tutor,
  week,
}: {
  bookingMessage: string;
  createdBookingId: string;
  isBooking: boolean;
  onOpenConfirm: () => void;
  selectedSlotIds: string[];
  selectedSlots: TutorAvailabilitySlot[];
  selectedTeachingMode: Exclude<BookingTeachingMode, "BOTH">;
  setSelectedSlotIds: (ids: string[]) => void;
  setSelectedTeachingMode: (mode: Exclude<BookingTeachingMode, "BOTH">) => void;
  setWeek: (updater: (current: Date) => Date) => void;
  slots: TutorAvailabilitySlot[];
  tutor: PublicTutorDetail;
  week: Date;
}) {
  return (
    <Card className="sticky top-24 p-5" id="availability">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[var(--on-surface)]">Lịch rảnh</h2>
          <p className="mt-1 text-xs font-bold text-[var(--outline)]">GMT+7 · Gia sư xác nhận trước khi thanh toán</p>
        </div>
        <Badge tone="info">{selectedSlotIds.length ? `${selectedSlotIds.length} đã chọn` : "Chọn lịch"}</Badge>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-2 py-2">
        <button
          aria-label="Tuần trước"
          className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-[var(--on-surface-variant)] hover:bg-white focus:shadow-[var(--focus-ring)] focus:outline-none"
          onClick={() => {
            setSelectedSlotIds([]);
            setWeek((current) => addDays(current, -7));
          }}
          type="button"
        >
          <Icon name="chevron_left" />
        </button>
        <span className="text-center text-sm font-black text-[var(--on-surface)]">
          {week.toLocaleDateString("vi-VN")} - {addDays(week, 6).toLocaleDateString("vi-VN")}
        </span>
        <button
          aria-label="Tuần sau"
          className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-[var(--on-surface-variant)] hover:bg-white focus:shadow-[var(--focus-ring)] focus:outline-none"
          onClick={() => {
            setSelectedSlotIds([]);
            setWeek((current) => addDays(current, 7));
          }}
          type="button"
        >
          <Icon name="chevron_right" />
        </button>
      </div>

      <AvailabilityGrid selectedSlotIds={selectedSlotIds} setSelectedSlotIds={setSelectedSlotIds} slots={slots} week={week} />

      <LessonModeSelector mode={selectedTeachingMode} onChange={setSelectedTeachingMode} tutorMode={tutor.teachingMode} />

      <BookingSummary selectedSlots={selectedSlots} tutor={tutor} />

      <Button
        className="mt-4 w-full"
        disabled={!selectedSlotIds.length}
        isLoading={isBooking}
        onClick={onOpenConfirm}
        size="lg"
      >
        {selectedSlotIds.length > 1 ? `Đặt ${selectedSlotIds.length} lịch học` : "Đặt lịch học"}
      </Button>

      {bookingMessage ? (
        <p className="mt-3 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-3 text-sm font-semibold text-[var(--on-surface-variant)]">
          {bookingMessage}
          {createdBookingId ? (
            <Link className="ml-2 font-black text-[var(--primary)] hover:underline" href={`/bookings/${createdBookingId}`}>
              Xem lịch học
            </Link>
          ) : null}
        </p>
      ) : null}

      <PaymentPolicy />
    </Card>
  );
}

function BookingSummary({ selectedSlots, tutor }: { selectedSlots: TutorAvailabilitySlot[]; tutor: PublicTutorDetail }) {
  if (!selectedSlots.length) {
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--outline-variant)] p-3 text-sm font-semibold text-[var(--on-surface-variant)]">
        Chọn một hoặc nhiều khung giờ để xem học phí dự kiến.
      </div>
    );
  }

  const hours = selectedSlots.reduce((sum, slot) => {
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(slot.endsAt);
    return sum + Math.max(0, (endsAt.getTime() - startsAt.getTime()) / 3_600_000);
  }, 0);
  const tuition = Math.round(Number(tutor.hourlyRate || 0) * hours);

  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3 text-sm">
      <SummaryRow label="Lịch đã chọn" value={`${selectedSlots.length} buổi`} />
      <SummaryRow label="Thời lượng dự kiến" value={`${hours || selectedSlots.length} giờ`} />
      <SummaryRow strong label="Học phí dự kiến" value={formatMoney(String(tuition))} />
    </div>
  );
}

function PaymentPolicy() {
  return (
    <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--secondary-container)]/35 p-3 text-xs font-semibold leading-5 text-[var(--on-surface-variant)]">
      <p className="font-black text-[var(--on-surface)]">Thanh toán an toàn</p>
      <p className="mt-1">Gia sư xác nhận trước khi bạn thanh toán. Học phí được hệ thống giữ và chỉ chuyển sau khi buổi học hoàn thành.</p>
    </div>
  );
}

function MobileBookingBar({
  isBooking,
  onOpenConfirm,
  selectedCount,
  tutor,
}: {
  isBooking: boolean;
  onOpenConfirm: () => void;
  selectedCount: number;
  tutor: PublicTutorDetail;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-[var(--outline-variant)] bg-white/95 px-4 py-3 shadow-[var(--shadow-bottom-nav)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[560px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[var(--outline)]">Học phí</p>
          <p className="truncate text-lg font-black text-[var(--primary)]">{formatMoney(tutor.hourlyRate)}/giờ</p>
        </div>
        {selectedCount ? (
          <Button disabled={isBooking} isLoading={isBooking} onClick={onOpenConfirm}>
            Đặt {selectedCount} lịch
          </Button>
        ) : (
          <a className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-[var(--on-primary)]" href="#availability">
            Xem lịch
          </a>
        )}
      </div>
    </div>
  );
}

function BookingConfirmModal({
  busy,
  mode,
  onCancel,
  onConfirm,
  slots,
  tutor,
}: {
  busy: boolean;
  mode: Exclude<BookingTeachingMode, "BOTH">;
  onCancel: () => void;
  onConfirm: () => void;
  slots: TutorAvailabilitySlot[];
  tutor: PublicTutorDetail;
}) {
  const hourlyRate = Number(tutor.hourlyRate || 0);
  const orderedSlots = [...slots].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const durationHours = orderedSlots.reduce((sum, slot) => {
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(slot.endsAt);
    return sum + Math.max(0, (endsAt.getTime() - startsAt.getTime()) / 3_600_000);
  }, 0);
  const tuition = Math.round(hourlyRate * durationHours);
  const platformFee = Math.round(tuition * 0.15);
  const total = tuition;

  return (
    <Dialog
      className="max-w-lg"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      description="Gia sư sẽ xác nhận trước khi học sinh thanh toán."
      onClose={onCancel}
      open
      title="Xác nhận đặt lịch"
    >
      <div className="space-y-4 p-6">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">Gia sư</p>
          <p className="mt-1 text-lg font-black">{tutor.fullName}</p>
          <p className="text-sm text-[var(--on-surface-variant)]">{teachingModeLabel(mode)}</p>
        </div>
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-4">
          {orderedSlots.map((slot) => {
            const startsAt = new Date(slot.startsAt);
            const endsAt = new Date(slot.endsAt);

            return (
              <div className="rounded-[var(--radius-md)] bg-white px-3 py-2" key={slot.id}>
                <p className="font-bold">{startsAt.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</p>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  {startsAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - {endsAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            );
          })}
        </div>
        <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--outline-variant)] p-4 text-sm">
          <SummaryRow label="Số buổi đã chọn" value={`${orderedSlots.length} buổi`} />
          <SummaryRow label="Học phí dự kiến" value={formatMoney(String(tuition))} />
          <SummaryRow label="Phí nền tảng đã bao gồm" value={formatMoney(String(platformFee))} />
          <hr className="border-[var(--outline-variant)]" />
          <SummaryRow strong label="Tổng giữ chỗ" value={formatMoney(String(total))} />
        </div>
        <PaymentPolicy />
      </div>
      <footer className="grid grid-cols-2 gap-3 bg-[var(--surface-container-low)] p-4">
        <Button disabled={busy} onClick={onCancel} variant="outline">
          Hủy
        </Button>
        <Button isLoading={busy} onClick={onConfirm}>
          Gửi yêu cầu
        </Button>
      </footer>
    </Dialog>
  );
}

function SummaryRow({ label, strong = false, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "font-black" : "text-[var(--on-surface-variant)]"}>{label}</span>
      <span className={strong ? "text-lg font-black text-[var(--primary)]" : "font-bold"}>{value}</span>
    </div>
  );
}

function AvailabilityGrid({
  selectedSlotIds,
  setSelectedSlotIds,
  slots,
  week,
}: {
  selectedSlotIds: string[];
  setSelectedSlotIds: (ids: string[]) => void;
  slots: TutorAvailabilitySlot[];
  week: Date;
}) {
  const days = Array.from({ length: 7 }).map((_, index) => addDays(week, index));
  const groups = [
    { label: "Sáng", icon: "light_mode", start: 5, end: 12 },
    { label: "Chiều", icon: "wb_sunny", start: 12, end: 18 },
    { label: "Tối", icon: "bedtime", start: 18, end: 24 },
  ];

  function slotsFor(day: Date, start = 0, end = 24) {
    return slots
      .filter((slot) => {
        const date = new Date(slot.startsAt);
        return (
          date.getFullYear() === day.getFullYear() &&
          date.getMonth() === day.getMonth() &&
          date.getDate() === day.getDate() &&
          date.getHours() >= start &&
          date.getHours() < end
        );
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  function toggleSlot(slotId: string) {
    setSelectedSlotIds(
      selectedSlotIds.includes(slotId)
        ? selectedSlotIds.filter((id) => id !== slotId)
        : [...selectedSlotIds, slotId],
    );
  }

  function timeRange(slot: TutorAvailabilitySlot) {
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(slot.endsAt);
    return `${startsAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - ${endsAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  }

  return (
    <div>
      <div className="space-y-3 lg:hidden">
        {days.map((day) => {
          const daySlots = slotsFor(day);

          return (
            <details className="rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)]" key={day.toISOString()} open={daySlots.length > 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-black text-[var(--on-surface)]">
                <span>{day.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                <span className="text-xs font-bold text-[var(--outline)]">{daySlots.length ? `${daySlots.length} lịch` : "Chưa có lịch"}</span>
              </summary>
              <div className="grid grid-cols-2 gap-2 border-t border-[var(--outline-variant)] p-3">
                {daySlots.length ? (
                  daySlots.map((slot) => <SlotButton key={slot.id} selected={selectedSlotIds.includes(slot.id)} slot={slot} timeRange={timeRange(slot)} toggleSlot={toggleSlot} />)
                ) : (
                  <p className="col-span-2 text-sm font-semibold text-[var(--on-surface-variant)]">Gia sư chưa mở lịch ngày này.</p>
                )}
              </div>
            </details>
          );
        })}
      </div>

      <div className="hidden lg:block">
        <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1.5 text-center text-xs font-bold text-[var(--outline)]">
          <div />
          {days.map((day, index) => (
            <div key={day.toISOString()}>
              <div>{["T2", "T3", "T4", "T5", "T6", "T7", "CN"][index]}</div>
              <div className="text-xs">{day.getUTCDate()}</div>
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1.5">
          {groups.map((group) => (
            <div className="contents" key={group.label}>
              <div className="flex min-h-12 min-w-0 flex-col items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-container-low)] px-1 py-2 text-xs font-bold">
                <Icon className="text-[16px]" name={group.icon} />
                {group.label}
              </div>
              {days.map((day) => {
                const daySlots = slotsFor(day, group.start, group.end);

                return (
                  <div className="flex min-h-14 min-w-0 flex-col gap-1 rounded-[var(--radius-sm)] border border-[var(--outline-variant)]/60 bg-[var(--surface-container-low)]/60 p-1" key={`${day.toISOString()}-${group.label}`}>
                    {daySlots.length ? (
                      daySlots.map((slot) => <SlotButton key={slot.id} selected={selectedSlotIds.includes(slot.id)} slot={slot} timeRange={timeRange(slot)} toggleSlot={toggleSlot} />)
                    ) : (
                      <div className="flex min-h-11 items-center justify-center rounded bg-[var(--surface-container-high)] text-xs font-semibold text-[var(--outline)]">--</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 border-t border-[var(--outline-variant)] pt-4 text-xs text-[var(--on-surface-variant)]">
        <Legend label="Rảnh" className="border border-[var(--primary)] bg-white" />
        <Legend label="Đã chọn" className="bg-[var(--primary)]" />
        <Legend label="Bận" className="bg-[var(--surface-container-high)]" />
      </div>
    </div>
  );
}

function SlotButton({
  selected,
  slot,
  timeRange,
  toggleSlot,
}: {
  selected: boolean;
  slot: TutorAvailabilitySlot;
  timeRange: string;
  toggleSlot: (slotId: string) => void;
}) {
  const disabled = slot.isBooked || !slot.isAvailable;
  const startsAt = new Date(slot.startsAt);
  const endsAt = new Date(slot.endsAt);

  return (
    <button
      aria-label={timeRange}
      className={[
        "flex min-h-12 w-full min-w-0 flex-col items-center justify-center rounded-[var(--radius-sm)] px-1 py-2 text-[11px] font-black leading-tight transition focus:shadow-[var(--focus-ring)] focus:outline-none",
        selected
          ? "bg-[var(--primary)] text-white shadow-[var(--shadow-panel)]"
          : disabled
            ? "bg-[var(--surface-container-high)] text-[var(--outline)]"
            : "border border-[var(--primary)] bg-white text-[var(--primary)] hover:bg-[var(--primary-fixed)]",
      ].join(" ")}
      disabled={disabled}
      onClick={() => toggleSlot(slot.id)}
      title={timeRange}
      type="button"
    >
      <CompactTime date={startsAt} />
      <span aria-hidden="true" className="text-[9px] leading-none opacity-75">-</span>
      <CompactTime date={endsAt} />
    </button>
  );
}

function CompactTime({ date }: { date: Date }) {
  const label = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  return (
    <span className="max-w-full whitespace-nowrap">
      {label}
    </span>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-4 w-4 rounded ${className}`} />
      {label}
    </span>
  );
}

function LessonModeSelector({
  mode,
  onChange,
  tutorMode,
}: {
  mode: Exclude<BookingTeachingMode, "BOTH">;
  onChange: (mode: Exclude<BookingTeachingMode, "BOTH">) => void;
  tutorMode: BookingTeachingMode;
}) {
  const supportsOnline = tutorMode === "ONLINE" || tutorMode === "BOTH";
  const supportsOffline = tutorMode === "OFFLINE" || tutorMode === "BOTH";

  return (
    <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <p className="mb-3 text-sm font-black text-[var(--on-surface)]">Hình thức học</p>
      <div className="grid grid-cols-2 gap-2">
        <ModeButton active={mode === "ONLINE"} disabled={!supportsOnline} icon="videocam" label="Online" onClick={() => onChange("ONLINE")} />
        <ModeButton active={mode === "OFFLINE"} disabled={!supportsOffline} icon="location_on" label="Offline" onClick={() => onChange("OFFLINE")} />
      </div>
      <p className="mt-2 text-xs font-semibold text-[var(--on-surface-variant)]">
        {tutorMode === "BOTH" ? "Gia sư hỗ trợ cả online và offline." : tutorMode === "ONLINE" ? "Gia sư chỉ nhận lớp online." : "Gia sư chỉ nhận lớp offline."}
      </p>
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45",
        active ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--outline-variant)] bg-white text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]",
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon className="text-[18px]" name={icon} />
      {label}
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Đang tải hồ sơ gia sư">
      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[auto_1fr_240px]">
          <Skeleton className="h-24 w-24 rounded-full sm:h-32 sm:w-32" />
          <div className="space-y-4">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-36 w-full" />
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-[520px] w-full lg:col-span-4" />
      </div>
    </div>
  );
}

function StatePanel({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <FeedbackState
      action={
        <Link className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--on-primary)]" href="/tutors">
          Về danh sách gia sư
        </Link>
      }
      description={message}
      icon={icon}
      title={title}
      tone={title.includes("Không tải") ? "error" : "not-found"}
    />
  );
}
