"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicShell } from "./public-shell";
import { getPublicTutor, type PublicTutorDetail } from "@/lib/discovery-api";
import { getTutorReviews, type Review } from "@/lib/review-api";
import { createSearchMatcher } from "@/lib/search-text";
import { Badge, Card, FeedbackState, Icon, Skeleton, StatusBadge } from "@/components/ui";

type SortMode = "newest" | "oldest" | "highest" | "lowest";
type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";

function formatReviewDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function reviewLessonDate(review: Review) {
  return new Date(review.booking.startsAt).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function TutorReviewsScreen({ id }: { id: string }) {
  const [tutor, setTutor] = useState<PublicTutorDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<RatingFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [keyword, setKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getPublicTutor(id), getTutorReviews(id)])
      .then(([profile, tutorReviews]) => {
        setTutor(profile);
        setReviews(tutorReviews);
        setError("");
      })
      .catch((requestError: Error) => setError(requestError.message || "Không thể tải đánh giá."))
      .finally(() => setIsLoading(false));
  }, [id]);

  const ratingCounts = useMemo(
    () =>
      reviews.reduce<Record<number, number>>((acc, review) => {
        acc[review.rating] = (acc[review.rating] || 0) + 1;
        return acc;
      }, {}),
    [reviews],
  );

  const filteredReviews = useMemo(() => {
    const matchesQuery = createSearchMatcher(keyword);

    return reviews
      .filter((review) => {
        if (rating !== "all" && review.rating !== Number(rating)) return false;
        return matchesQuery(`${review.student.fullName} ${review.comment || ""}`);
      })
      .sort((a, b) => {
        if (sort === "highest") return b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sort === "lowest") return a.rating - b.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [keyword, rating, reviews, sort]);

  const averageRating = Number(tutor?.ratingAvg || 0);

  return (
    <PublicShell>
      <main className="w-full px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <Link className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] px-2 text-sm font-bold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]" href={`/tutors/${id}`}>
          <Icon className="text-[20px]" name="arrow_back" />
          Quay lại hồ sơ gia sư
        </Link>

        {isLoading ? (
          <ReviewsSkeleton />
        ) : error ? (
          <FeedbackState
            action={
              <button className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--on-primary)]" onClick={() => window.location.reload()} type="button">
                Tải lại
              </button>
            }
            description={error}
            title="Không tải được đánh giá"
            tone="error"
          />
        ) : tutor ? (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[var(--outline)]">Gia sư</p>
                    <h1 className="mt-1 text-2xl font-black leading-tight text-[var(--on-surface)]">{tutor.fullName}</h1>
                    <p className="mt-1 text-sm font-bold text-[var(--primary)]">{tutor.headline || "Gia sư TutorConnect"}</p>
                  </div>
                  {tutor.verified ? <StatusBadge tone="success">Đã xác thực</StatusBadge> : null}
                </div>

                <div className="mt-5 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-4">
                  <p className="text-xs font-bold text-[var(--outline)]">Điểm đánh giá</p>
                  <p className="mt-1 text-4xl font-black text-[var(--primary)]">{averageRating.toFixed(1)}</p>
                  <p className="mt-1 text-sm font-bold text-[var(--secondary)]">{"★".repeat(Math.round(averageRating))}{"☆".repeat(5 - Math.round(averageRating))}</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface-variant)]">{reviews.length} đánh giá công khai</p>
                </div>

                <div className="mt-5 space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = ratingCounts[star] || 0;
                    const percent = reviews.length ? Math.round((count / reviews.length) * 100) : 0;

                    return (
                      <button className="grid w-full grid-cols-[42px_1fr_38px] items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs font-bold hover:bg-[var(--surface-container-low)]" key={star} onClick={() => setRating(String(star) as RatingFilter)} type="button">
                        <span>{star} sao</span>
                        <span className="h-2 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
                          <span className="block h-full rounded-full bg-[var(--secondary-container)]" style={{ width: `${percent}%` }} />
                        </span>
                        <span className="text-right text-[var(--outline)]">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="text-base font-black text-[var(--on-surface)]">Bộ lọc</h2>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-bold text-[var(--on-surface-variant)]">Tìm trong đánh giá</span>
                  <input className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--primary)]" onChange={(event) => setKeyword(event.target.value)} placeholder="Tên học viên, nội dung..." value={keyword} />
                </label>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-bold text-[var(--on-surface-variant)]">Số sao</span>
                  <select className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--primary)]" onChange={(event) => setRating(event.target.value as RatingFilter)} value={rating}>
                    <option value="all">Tất cả đánh giá</option>
                    {[5, 4, 3, 2, 1].map((star) => (
                      <option key={star} value={String(star)}>
                        {star} sao
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-bold text-[var(--on-surface-variant)]">Sắp xếp</span>
                  <select className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--primary)]" onChange={(event) => setSort(event.target.value as SortMode)} value={sort}>
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="highest">Điểm cao nhất</option>
                    <option value="lowest">Điểm thấp nhất</option>
                  </select>
                </label>
              </Card>
            </aside>

            <section className="min-w-0">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <h2 className="flex items-center gap-2 text-3xl font-black text-[var(--on-surface)]">
                    <Icon className="text-[var(--secondary)]" fill name="star" />
                    Tất cả đánh giá
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface-variant)]">
                    Đang hiển thị {filteredReviews.length} / {reviews.length} đánh giá.
                  </p>
                </div>
                {(rating !== "all" || keyword) ? (
                  <button className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-4 text-sm font-black text-[var(--primary)]" onClick={() => { setRating("all"); setKeyword(""); }} type="button">
                    Xóa bộ lọc
                  </button>
                ) : null}
              </div>

              {filteredReviews.length ? (
                <div className="space-y-3">
                  {filteredReviews.map((review) => (
                    <article className="rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-white p-5 shadow-[var(--shadow-panel)]" key={review.id}>
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <p className="font-black text-[var(--on-surface)]">{review.student.fullName}</p>
                          <p className="mt-1 text-xs font-bold text-[var(--outline)]">
                            Buổi học {reviewLessonDate(review)} · gửi ngày {formatReviewDate(review.createdAt)}
                          </p>
                        </div>
                        <Badge tone={review.rating >= 4 ? "success" : review.rating === 3 ? "warning" : "danger"}>
                          {review.rating} sao
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm font-black text-[var(--secondary)]">
                        {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                      </p>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--on-surface-variant)]">
                        {review.comment || "Học viên không để lại nhận xét chi tiết."}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <FeedbackState
                  className="min-h-[360px]"
                  description="Thử bỏ bộ lọc số sao hoặc từ khóa để xem thêm đánh giá khác."
                  title="Không có đánh giá phù hợp"
                  tone="not-found"
                />
              )}
            </section>
          </div>
        ) : null}
      </main>
    </PublicShell>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]" role="status" aria-label="Đang tải đánh giá">
      <Card className="space-y-4 p-5">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
      <div className="space-y-3">
        <Skeleton className="h-12 w-1/2" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-36 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}
