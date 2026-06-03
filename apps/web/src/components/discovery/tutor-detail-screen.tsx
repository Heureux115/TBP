"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicShell, Icon } from "./public-shell";
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

type DetailState = "loading" | "ready" | "not-found" | "error";

const profileImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDI0zJSdYqsekNGFXWm73rG_kt28T6edrrERWh1TzUeLB_jnwUrQMrJ-ppCzBNUVVVEQw9eW95Mq-kIbEnNNMDs4wVD6rz_xFJ_R60paSjgJjgZAvQV5z0ncxcnpxS3qQW08aEdbs5JPhaH6zJwY3kZ65nKqsiapmpMoL088wdNY6PZCmRRWwOGWFAk8J4iAg6JtV2_lpFO-W6pWyvajv3wU_mYd_8AEAdS68qlJ-7fbyt6fXGbpWZpUk4s-f9aRQ-wg9X5wNVXwTo";

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
  const [state, setState] = useState<DetailState>(forcedState && forcedState !== "ready" ? "loading" : "ready");
  const [tutor, setTutor] = useState<PublicTutorDetail | null>(null);
  const [slots, setSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eligibleBookings, setEligibleBookings] = useState<EligibleReviewBooking[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
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
  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.id === selectedSlotId) || null,
    [selectedSlotId, slots],
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
    if (!selectedSlotId) return;
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
      const booking = await createBooking(auth.token, selectedSlotId, selectedTeachingMode);
      setBookingMessage("Đã gửi yêu cầu đặt lịch. Gia sư cần xác nhận trước khi bạn thanh toán.");
      setCreatedBookingId(booking.id);
      setSelectedSlotId(null);
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
        <main className="w-full px-5 pb-12 pt-28 sm:px-8 lg:px-12 2xl:px-16">
          <DetailSkeleton />
        </main>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <main className="w-full px-5 pb-12 pt-28 sm:px-8 lg:px-12 2xl:px-16">
        <Link className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--primary)]" href="/tutors">
          <Icon className="text-[20px]" name="arrow_back" />
          Quay lại danh sách
        </Link>

        {effectiveState === "loading" ? <DetailSkeleton /> : null}
        {effectiveState === "error" ? <StatePanel icon="cloud_off" title="Không tải được hồ sơ" message={error || "Vui lòng thử lại sau."} /> : null}
        {effectiveState === "not-found" ? (
          <StatePanel
            icon="person_off"
            title="Không tìm thấy gia sư"
            message="Hồ sơ có thể chưa được duyệt, đã tạm ẩn hoặc đưđường dẫn không chính xác."
          />
        ) : null}

        {effectiveState === "ready" && tutor ? (
          <>
            <section className="mb-6 rounded-xl border border-[var(--outline-variant)] bg-white/90 p-6 shadow-sm">
              <div className="flex flex-col gap-6 md:flex-row md:items-center">
                <div className="relative shrink-0">
                  <img
                    alt={tutor.fullName}
                    className="h-36 w-36 rounded-full border-4 border-[var(--surface-container-highest)] object-cover shadow-sm md:h-40 md:w-40"
                    src={tutor.avatarUrl || profileImage}
                  />
                  <div className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[var(--primary-container)] text-white">
                    <Icon className="text-[18px]" fill name="verified" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-4xl font-bold tracking-tight text-[var(--primary)]">{tutor.fullName}</h1>
                    <span className="rounded-full border border-[var(--primary-container)]/20 bg-[var(--primary-container)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary-container)]">
                      Đã xác thực
                    </span>
                  </div>
                  <p className="mt-2 text-xl font-semibold text-[var(--on-surface-variant)]">
                    {tutor.headline || "Gia sư chuyên môn cao"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--on-surface-variant)]">
                    <span className="flex items-center gap-1 text-[var(--secondary)]">
                      <Icon className="text-[18px]" fill name="star" />
                      <strong>{Number(tutor.ratingAvg).toFixed(1)}</strong> ({tutor.totalSessions} buổi)
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon className="text-[18px]" name="location_on" />
                      {location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon className="text-[18px]" name="laptop_mac" />
                      {teachingModeLabel(tutor.teachingMode)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[var(--outline-variant)] pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Học phí</p>
                  <p className="text-3xl font-bold text-[var(--primary)]">
                    {formatMoney(tutor.hourlyRate)}
                    <span className="text-sm font-normal text-[var(--outline)]">/giờ</span>
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button className="rounded-xl border border-[var(--outline-variant)] p-3 text-[var(--error)] transition hover:bg-[var(--surface-container)]" type="button">
                      <Icon name="favorite" />
                    </button>
                    <button className="rounded-xl border border-[var(--outline-variant)] p-3 text-[var(--primary)] transition hover:bg-[var(--surface-container)]" type="button">
                      <Icon name="mail" />
                    </button>
                    <a className="rounded-xl bg-[var(--secondary-container)] px-5 py-3 text-sm font-bold text-[var(--on-surface)] transition hover:opacity-90" href="#availability">
                      Đặt lịch ngay
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-8">
                <section className="rounded-xl border border-[var(--outline-variant)] bg-white/90 p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold text-[var(--primary)]">
                    <Icon name="person_book" />
                    Giới thiệu bản thân
                  </h2>
                  <p className="whitespace-pre-line text-lg leading-8 text-[var(--on-surface-variant)]">
                    {tutor.bio || tutor.bioExcerpt || "Gia sư chưa cập nhật phần giới thiệu chi tiết."}
                  </p>
                </section>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <section className="rounded-xl border border-[var(--outline-variant)] bg-white/90 p-6 shadow-sm">
                    <h2 className="mb-4 text-xl font-semibold text-[var(--primary)]">Môn học</h2>
                    <div className="flex flex-wrap gap-2">
                      {tutor.subjects.length ? (
                        tutor.subjects.map((item) => (
                          <span className="rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-high)] px-4 py-2 text-sm font-semibold" key={item.id}>
                            {item.subject.name} ? {levelLabels[item.level] || item.level}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-[var(--on-surface-variant)]">Chưa cập nhật môn học.</span>
                      )}
                    </div>
                  </section>

                  <section className="rounded-xl border border-[var(--outline-variant)] bg-white/90 p-6 shadow-sm">
                    <h2 className="mb-4 text-xl font-semibold text-[var(--primary)]">Kinh nghiệm</h2>
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--primary-container)]/10 text-[var(--primary)]">
                        <Icon className="text-[32px]" name="workspace_premium" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold">{tutor.experienceYears || 0} năm</p>
                        <p className="text-sm text-[var(--outline)]">Kinh nghiệm giảng dạy</p>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="rounded-xl border border-[var(--outline-variant)] bg-white/90 p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold text-[var(--primary)]">
                    <Icon name="verified_user" />
                    Tài liệu đã xác minh
                  </h2>
                  <div className="space-y-3">
                    {tutor.verifiedDocuments.length ? (
                      tutor.verifiedDocuments.map((document) => (
                        <div className="flex items-center gap-3 rounded-lg border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] p-3" key={document.id}>
                          <Icon className="text-[var(--tertiary)]" fill name="check_circle" />
                          <div>
                            <p className="font-semibold">{documentLabel(document.type)}</p>
                            <p className="text-sm text-[var(--on-surface-variant)]">Đã được TutorConnect kiểm duyệt</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--on-surface-variant)]">Hồ sơ đã duyệt, tài liệu không hiển thị công khai.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--outline-variant)] bg-white/90 p-6 shadow-sm">
                  <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <h2 className="flex items-center gap-2 text-2xl font-semibold text-[var(--primary)]">
                      <Icon fill name="star" />
                      Đánh giá từ học viên
                    </h2>
                    <span className="text-sm font-semibold text-[var(--on-surface-variant)]">
                      {Number(tutor.ratingAvg).toFixed(1)} / 5 từ {reviews.length} đánh giá
                    </span>
                  </div>

                  {reviews.length ? (
                    <div className="space-y-3">
                      {reviews.map((review) => (
                        <article className="rounded-lg border border-[var(--outline-variant)]/60 bg-[var(--surface-container-low)] p-4" key={review.id}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-bold">{review.student.fullName}</p>
                            <span className="text-sm font-bold text-[var(--secondary)]">
                              {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                            </span>
                          </div>
                          {review.comment ? <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">{review.comment}</p> : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--on-surface-variant)]">Chưa có đánh giá công khai.</p>
                  )}

                  {auth.user?.role === "STUDENT" && eligibleBookings.length ? (
                    <div className="mt-5 rounded-lg border border-[var(--outline-variant)] bg-white p-4">
                      <h3 className="mb-3 text-base font-bold">Gửi đánh giá sau buổi học</h3>
                      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                        <select
                          className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                          onChange={(event) => setSelectedReviewBookingId(event.target.value)}
                          value={selectedReviewBookingId}
                        >
                          {eligibleBookings.map((booking) => (
                            <option key={booking.id} value={booking.id}>
                              {new Date(booking.startsAt).toLocaleString("vi-VN")}
                            </option>
                          ))}
                        </select>
                        <select
                          className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
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
                        className="mt-3 min-h-24 w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                        maxLength={1000}
                        onChange={(event) => setReviewComment(event.target.value)}
                        placeholder="Chia sẻ trải nghiệm học của bạn"
                        value={reviewComment}
                      />
                      <button
                        className="mt-3 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                        disabled={isReviewing || !selectedReviewBookingId}
                        onClick={handleCreateReview}
                        type="button"
                      >
                        {isReviewing ? "Đang gửi..." : "Gửi đánh giá"}
                      </button>
                      {reviewMessage ? <p className="mt-2 text-sm font-semibold text-[var(--on-surface-variant)]">{reviewMessage}</p> : null}
                    </div>
                  ) : null}
                </section>
              </div>

              <aside className="space-y-6 lg:col-span-4">
                <section className="sticky top-24 rounded-xl border border-[var(--outline-variant)] bg-white/95 p-5 shadow-lg" id="availability">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-[var(--primary)]">Lịch rảnh</h2>
                    <span className="text-xs font-semibold text-[var(--outline)]">GMT+7</span>
                  </div>
                  <div className="mb-4 flex items-center justify-between border-y border-[var(--outline-variant)]/50 py-2">
                    <button
                      className="rounded-full p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                      onClick={() => setWeek((current) => addDays(current, -7))}
                      type="button"
                    >
                      <Icon name="chevron_left" />
                    </button>
                    <span className="text-sm font-semibold">
                      {week.toLocaleDateString("vi-VN")} - {addDays(week, 6).toLocaleDateString("vi-VN")}
                    </span>
                    <button
                      className="rounded-full p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                      onClick={() => setWeek((current) => addDays(current, 7))}
                      type="button"
                    >
                      <Icon name="chevron_right" />
                    </button>
                  </div>

                  <AvailabilityGrid
                    selectedSlotId={selectedSlotId}
                    setSelectedSlotId={setSelectedSlotId}
                    slots={slots}
                    week={week}
                  />

                  {tutor ? (
                    <LessonModeSelector
                      mode={selectedTeachingMode}
                      onChange={setSelectedTeachingMode}
                      tutorMode={tutor.teachingMode}
                    />
                  ) : null}

                  <button
                    className="mt-5 w-full rounded-xl bg-[var(--primary)] py-4 text-base font-bold text-white shadow-sm transition hover:bg-[var(--primary-container)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedSlotId || isBooking}
                    onClick={() => setShowBookingConfirm(true)}
                    type="button"
                  >
                    {isBooking ? "Dang dat lich..." : "Dat lich hoc"}
                  </button>
                  {bookingMessage ? (
                    <p className="mt-3 rounded-lg bg-[var(--surface-container-low)] p-3 text-sm font-semibold text-[var(--on-surface-variant)]">
                      {bookingMessage}
                      {createdBookingId ? (
                        <Link className="ml-2 font-black text-[var(--primary)] hover:underline" href={`/bookings/${createdBookingId}`}>
                          Xem lịch học
                        </Link>
                      ) : null}
                    </p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="rounded-xl border border-[var(--outline-variant)] py-3 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--surface-container)]" type="button">
                      Nhắn tin
                    </button>
                    <button className="rounded-xl border border-[var(--outline-variant)] py-3 text-sm font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]" type="button">
                      Lưu gia sư
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </main>
      {showBookingConfirm && tutor && selectedSlot ? (
        <BookingConfirmModal
          busy={isBooking}
          mode={selectedTeachingMode}
          onCancel={() => setShowBookingConfirm(false)}
          onConfirm={handleCreateBooking}
          slot={selectedSlot}
          tutor={tutor}
        />
      ) : null}
    </PublicShell>
  );
}

function BookingConfirmModal({
  busy,
  mode,
  onCancel,
  onConfirm,
  slot,
  tutor,
}: {
  busy: boolean;
  mode: Exclude<BookingTeachingMode, "BOTH">;
  onCancel: () => void;
  onConfirm: () => void;
  slot: TutorAvailabilitySlot;
  tutor: PublicTutorDetail;
}) {
  const hourlyRate = Number(tutor.hourlyRate || 0);
  const startsAt = new Date(slot.startsAt);
  const endsAt = new Date(slot.endsAt);
  const durationHours = Math.max(0, (endsAt.getTime() - startsAt.getTime()) / 3_600_000);
  const tuition = Math.round(hourlyRate * durationHours);
  const platformFee = Math.round(tuition * 0.15);
  const total = tuition;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 py-6">
      <section className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="bg-[var(--primary)] px-6 py-5 text-white">
          <h2 className="text-xl font-black">Xác nhận đặt lịch</h2>
          <p className="mt-1 text-sm text-white/80">Gia sư sẽ xác nhận trước khi học sinh thanh toán.</p>
        </header>
        <div className="space-y-4 p-6">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">Gia sư</p>
            <p className="mt-1 text-lg font-black">{tutor.fullName}</p>
            <p className="text-sm text-[var(--on-surface-variant)]">{teachingModeLabel(mode)}</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-container-low)] p-4">
            <p className="font-bold">{startsAt.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</p>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              {startsAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - {endsAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-[var(--outline-variant)] p-4 text-sm">
            <SummaryRow label="Học phí dự kiến" value={formatMoney(String(tuition))} />
            <SummaryRow label="Phí nền tảng đã bao gồm" value={formatMoney(String(platformFee))} />
            <hr className="border-[var(--outline-variant)]" />
            <SummaryRow strong label="Tổng giữ chỗ" value={formatMoney(String(total))} />
          </div>
          <p className="rounded-lg bg-[var(--secondary-container)]/40 p-3 text-xs font-semibold leading-5 text-[var(--on-surface-variant)]">
            Sau khi gia sư xác nhận, bạn sẽ thanh toán ở trang chi tiết lịch học. Tiền được giữ bởi hệ thống và chỉ chuyển cho gia sư khi buổi học hoàn thành.
          </p>
        </div>
        <footer className="grid grid-cols-2 gap-3 bg-[var(--surface-container-low)] p-4">
          <button className="rounded-lg border border-[var(--outline-variant)] py-3 text-sm font-black text-[var(--on-surface-variant)]" disabled={busy} onClick={onCancel} type="button">
            Hủy
          </button>
          <button className="rounded-lg bg-[var(--primary)] py-3 text-sm font-black text-white disabled:opacity-60" disabled={busy} onClick={onConfirm} type="button">
            {busy ? "Đang gửi..." : "Gửi yêu cầu"}
          </button>
        </footer>
      </section>
    </div>
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
  selectedSlotId,
  setSelectedSlotId,
  slots,
  week,
}: {
  selectedSlotId: string | null;
  setSelectedSlotId: (id: string | null) => void;
  slots: TutorAvailabilitySlot[];
  week: Date;
}) {
  const days = Array.from({ length: 7 }).map((_, index) => addDays(week, index));
  const groups = [
    { label: "Sáng", icon: "light_mode", start: 5, end: 12 },
    { label: "Chiều", icon: "wb_sunny", start: 12, end: 18 },
    { label: "Tối", icon: "bedtime", start: 18, end: 24 },
  ];

  function slotFor(day: Date, start: number, end: number) {
    return slots.find((slot) => {
      const date = new Date(slot.startsAt);
      return (
        date.getUTCFullYear() === day.getUTCFullYear() &&
        date.getUTCMonth() === day.getUTCMonth() &&
        date.getUTCDate() === day.getUTCDate() &&
        date.getUTCHours() >= start &&
        date.getUTCHours() < end
      );
    });
  }

  return (
    <div>
      <div className="grid grid-cols-8 gap-2 text-center text-xs font-semibold text-[var(--outline)]">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()}>
            <div>{["T2", "T3", "T4", "T5", "T6", "T7", "CN"][days.indexOf(day)]}</div>
            <div className="text-[10px]">{day.getUTCDate()}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-8 gap-2">
        {groups.map((group) => (
          <div className="contents" key={group.label}>
            <div className="flex min-h-12 flex-col items-center justify-center rounded-lg bg-[var(--surface-container-low)] py-2 text-[10px] font-semibold">
              <Icon className="text-[16px]" name={group.icon} />
              {group.label}
            </div>
            {days.map((day) => {
              const slot = slotFor(day, group.start, group.end);
              const selected = slot?.id === selectedSlotId;
              const disabled = !slot || slot.isBooked;

              return (
                <button
                  className={[
                    "min-h-12 rounded border px-1 py-1 text-[10px] font-semibold transition",
                    selected
                      ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm"
                      : disabled
                        ? "border-[var(--outline-variant)]/30 bg-[var(--surface-container-high)]/60 text-[var(--outline)]"
                        : "border-[var(--primary)] bg-white text-[var(--primary)] hover:bg-[var(--primary)]/5",
                  ].join(" ")}
                  disabled={disabled}
                  key={`${day.toISOString()}-${group.label}`}
                  onClick={() => setSelectedSlotId(selected ? null : slot?.id || null)}
                  type="button"
                >
                  {slot ? new Date(slot.startsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--"}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 border-t border-[var(--outline-variant)]/50 pt-4 text-xs text-[var(--on-surface-variant)]">
        <span className="flex items-center gap-1">
          <span className="h-4 w-4 rounded border border-[var(--primary)] bg-white" />
          Rảnh
        </span>
        <span className="flex items-center gap-1">
          <span className="h-4 w-4 rounded bg-[var(--primary)]" />
          Đã chọn
        </span>
        <span className="flex items-center gap-1">
          <span className="h-4 w-4 rounded bg-[var(--surface-container-high)]" />
          Bận
        </span>
      </div>
    </div>
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
    <div className="mt-5 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <p className="mb-3 text-sm font-bold text-[var(--primary)]">Hình thức học</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          className={[
            "flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-bold transition",
            mode === "ONLINE" ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--outline-variant)] bg-white text-[var(--on-surface-variant)]",
          ].join(" ")}
          disabled={!supportsOnline}
          onClick={() => onChange("ONLINE")}
          type="button"
        >
          <Icon className="text-[18px]" name="videocam" />
          Online
        </button>
        <button
          className={[
            "flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-bold transition",
            mode === "OFFLINE" ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--outline-variant)] bg-white text-[var(--on-surface-variant)]",
          ].join(" ")}
          disabled={!supportsOffline}
          onClick={() => onChange("OFFLINE")}
          type="button"
        >
          <Icon className="text-[18px]" name="location_on" />
          Offline
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-[var(--on-surface-variant)]">
        {tutorMode === "BOTH" ? "Gia sư hỗ trợ cả online và offline." : tutorMode === "ONLINE" ? "Gia sư chỉ nhận lớp online." : "Gia sư chỉ nhận lớp offline."}
      </p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm">
        <div className="flex gap-6">
          <div className="skeleton-shimmer h-40 w-40 rounded-full" />
          <div className="flex-1 space-y-4">
            <div className="skeleton-shimmer h-9 w-1/2 rounded" />
            <div className="skeleton-shimmer h-6 w-2/3 rounded" />
            <div className="skeleton-shimmer h-20 w-full rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="skeleton-shimmer h-96 rounded-xl lg:col-span-8" />
        <div className="skeleton-shimmer h-96 rounded-xl lg:col-span-4" />
      </div>
    </div>
  );
}

function StatePanel({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-[var(--outline-variant)] bg-white p-8 text-center shadow-sm">
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--surface-container-low)]">
          <Icon className="text-[52px] text-[var(--primary)]" name={icon} />
        </div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-[var(--on-surface-variant)]">{message}</p>
        <Link className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href="/tutors">
          Về danh sách gia sư
        </Link>
      </div>
    </div>
  );
}
