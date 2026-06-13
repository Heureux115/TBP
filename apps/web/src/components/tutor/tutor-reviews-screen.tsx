"use client";

import { useEffect, useMemo, useState } from "react";
import { RoleDashboardShell } from "@/components/layouts/role-dashboard-shell";
import { Button, Card, FeedbackState, Icon, MetricCard, PageHeader, Skeleton } from "@/components/ui";
import { getAccessToken } from "@/lib/auth-storage";
import { getTutorReviews, type Review } from "@/lib/review-api";
import { createSearchMatcher } from "@/lib/search-text";
import { getMyTutorProfile, type TutorProfile } from "@/lib/tutor-api";

type RatingFilter = "ALL" | "5" | "4" | "3" | "2" | "1";
type SortMode = "newest" | "highest" | "lowest";

export function TutorReviewsScreen() {
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState<RatingFilter>("ALL");
  const [sort, setSort] = useState<SortMode>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.resolve()
      .then(async () => {
        const token = getAccessToken();
        if (!token) throw new Error("Bạn cần đăng nhập để xem đánh giá.");
        const currentProfile = await getMyTutorProfile(token);
        const items = await getTutorReviews(currentProfile.id);
        return { currentProfile, items };
      })
      .then(({ currentProfile, items }) => {
        if (cancelled) return;
        setProfile(currentProfile);
        setReviews(items);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Không thể tải đánh giá.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const matchesQuery = createSearchMatcher(query);

    return reviews
      .filter((review) => {
        const matchesRating = rating === "ALL" || review.rating === Number(rating);
        const haystack = `${review.student.fullName} ${review.comment || ""} ${review.bookingId}`;
        return matchesRating && matchesQuery(haystack);
      })
      .sort((a, b) => {
        if (sort === "highest") return b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sort === "lowest") return a.rating - b.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [query, rating, reviews, sort]);

  const hasFilters = Boolean(query.trim()) || rating !== "ALL" || sort !== "newest";

  function clearFilters() {
    setQuery("");
    setRating("ALL");
    setSort("newest");
  }

  return (
    <RoleDashboardShell active="reviews" role="tutor">
      <main className="tc-flow-safe flex w-full flex-col gap-6">
        <PageHeader
          description="Theo dõi toàn bộ đánh giá công khai từ học viên, lọc nhanh theo sao hoặc nội dung phản hồi."
          eyebrow={profile?.fullName ? `Gia sư ${profile.fullName}` : "Không gian gia sư"}
          title="Đánh giá từ học viên"
        />

        {error ? <FeedbackState className="min-h-[220px]" description={error} title="Không thể tải đánh giá" tone="error" /> : null}

        {loading ? (
          <section className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </section>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-3">
              <MetricCard icon="star" label="Điểm trung bình" note={reviews.length ? `${reviews.length} đánh giá công khai` : "Chưa có đánh giá"} tone="warning" value={averageRating ? averageRating.toFixed(1) : "-"} />
              <MetricCard icon="rate_review" label="Tổng đánh giá" note="Từ các buổi học đã hoàn tất" tone="info" value={reviews.length} />
              <MetricCard icon="verified" label="Hồ sơ" note={profile?.headline || "Thông tin gia sư"} tone="success" value={profile?.verificationStatus === "APPROVED" ? "Đã duyệt" : "Đang cập nhật"} />
            </section>

            <Card className="p-4 sm:p-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-xs font-bold text-[var(--on-surface-variant)]">Tìm kiếm</span>
                  <span className="relative block">
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--on-surface-variant)]" name="search" />
                    <input
                      className="w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white py-2.5 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Tên học viên, nội dung đánh giá, mã booking..."
                      type="search"
                      value={query}
                    />
                  </span>
                </label>
                <Select label="Số sao" onChange={(value) => setRating(value as RatingFilter)} options={[["ALL", "Tất cả"], ["5", "5 sao"], ["4", "4 sao"], ["3", "3 sao"], ["2", "2 sao"], ["1", "1 sao"]]} value={rating} />
                <Select label="Sắp xếp" onChange={(value) => setSort(value as SortMode)} options={[["newest", "Mới nhất"], ["highest", "Sao cao nhất"], ["lowest", "Sao thấp nhất"]]} value={sort} />
                <Button className="w-full lg:w-auto" disabled={!hasFilters} onClick={clearFilters} variant="outline">
                  Xóa lọc
                </Button>
              </div>
              <p className="mt-3 text-xs font-bold text-[var(--on-surface-variant)]">{filteredReviews.length}/{reviews.length} đánh giá đang hiển thị</p>
            </Card>

            {filteredReviews.length ? (
              <section className="flex w-full flex-col gap-4">
                {filteredReviews.map((review) => (
                  <Card className="p-5" key={review.id}>
                    <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <p className="tc-text-safe text-base font-black">{review.student.fullName}</p>
                        <p className="mt-1 text-xs font-bold text-[var(--on-surface-variant)]">{formatDate(review.createdAt)} · {formatDateTime(review.booking.startsAt)}</p>
                      </div>
                      <Stars rating={review.rating} />
                    </div>
                    <p className="tc-text-safe mt-4 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-4 text-sm leading-6 text-[var(--on-surface)]">
                      {review.comment || "Học viên chưa để lại nhận xét chi tiết."}
                    </p>
                  </Card>
                ))}
              </section>
            ) : (
              <FeedbackState
                actionLabel={hasFilters ? "Xóa bộ lọc" : undefined}
                description={hasFilters ? "Không có đánh giá nào khớp bộ lọc hiện tại." : "Khi học viên hoàn tất buổi học và gửi đánh giá, phản hồi sẽ xuất hiện tại đây."}
                onAction={hasFilters ? clearFilters : undefined}
                title={hasFilters ? "Không tìm thấy đánh giá" : "Chưa có đánh giá"}
                tone={hasFilters ? "not-found" : "empty"}
              />
            )}
          </>
        )}
      </main>
    </RoleDashboardShell>
  );
}

function Select({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-[var(--on-surface-variant)]">{label}</span>
      <select
        className="w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div aria-label={`${rating} sao`} className="flex shrink-0 items-center gap-0.5 text-[var(--warning)]">
      {Array.from({ length: 5 }).map((_, index) => (
        <Icon fill={index < rating} key={index} name="star" />
      ))}
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
