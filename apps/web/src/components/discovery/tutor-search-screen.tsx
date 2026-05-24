"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicShell, Icon } from "./public-shell";
import {
  PublicSubjectLevel,
  PublicTeachingMode,
  PublicTutorCard,
  searchPublicTutors,
  TutorSearchSort,
} from "@/lib/discovery-api";
import { getSubjects, Subject } from "@/lib/tutor-api";

type ScreenState = "loading" | "ready" | "empty" | "error";

const fallbackImages = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDcOJCYD-cecHaKiBsF5vcmu795IVN7VwJXxvo4z72tiLV6X9rjnQybKnSNLlGe1bWO_Xxy0mrhdhS2dJrBVkDhA2ArNReRtkv-Ka-va3LSeM97KAQInq9tcjPx1VuycoLbvbXqsoVEGtsCjMSz99XyVRV33J0u4KF5CdMoGG7j25ethox32DVYx4fMYmRL_M8w-ff_Jkg7rjdtY02842GwRs4SjfO2P7e__ldm17BbFQ8f_lDUs8_OzSGM24RLEIafNtckMpB36To",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDU5NXiKfHm9weqFSiA-2IR57r5m5H2_PSHnVJrGUmxWhiY21ucGx6VmSsHxNIFgu3QjjBhAkY9ZSwU1PQN2m21oHJ1auIWH8ch8waXX71odVgGjFP4rjnNaIwFXoYbNLcULJnnK7y7H0UExyD-tAfUyq0wdYlOxopretROuZ3diSydJ1u7OwACGF6qsc7zbVcEZ4Lmp5rhj_eGbxkJPhPi55B85UzLoMMK1IDL8AHd-LqZqqXEtlDCqIAJnLLxAeiYaPkjtix01NI",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCPq9VcU5rtuM9R8_k0HLCDQ5Ep8zz5TKVprkiRof4fr5tRGToPSxqarpLKp9ItXgEvJ0uvrl1FzxOo5FMGtdWMr8RmSavPQGBhHvsJ8SaCacmvIjaC88aeP4-KOBFcOu9j51tTe56pDf-WCvNuQtjtokiE0KWjxl2i0tw0JdFupB0hk6V9mxVvKiuvooWeuoJKB0Sjdq6sR7liF9GaDtxM_PqmuDdamUu4akkMvIoBJrYgjsldgac7z1coflgDdQCbop4YTqcj6Rs",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDmRDQoF0bq_7OyzNnodmZ1kwG3OepsBaIGiGjsiXXf-VOoOYZv6T0LkQKUGKFqJjUDyYQvFzfnNvXG67lObPQYz47mdU3pEcbRlTwr39Qnmvdm9wUgtYHi2QqrrTAJGXyYzy7FSfuJIOnRNG7ybR9RevruC0LC81--xZEt389CP8SmMt6vssusNTPuZZy-FPengrk7wfHLIo9mdkeAhamdJrDUpPQ7sm-FBxUy1KGH0l4N55W5RZzg2ODU2JtMF44FWoyFkNhCvMU",
];

const levelLabels: Record<PublicSubjectLevel, string> = {
  PRIMARY: "Tiểu học",
  LOWER_SECONDARY: "Cấp 2",
  HIGH_SCHOOL: "Cấp 3",
  UNIVERSITY: "Đại học",
  BASIC: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
  EXAM_PREP: "Luyện thi",
};

function formatMoney(value: string | null) {
  const amount = Number(value ?? 0);
  if (!amount) return "Liên hệ";
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

function teachingModeLabel(mode: PublicTeachingMode) {
  if (mode === "ONLINE") return "Online";
  if (mode === "OFFLINE") return "Trực tiếp";
  return "Online & trực tiếp";
}

export function TutorSearchScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcedState = searchParams.get("state") as ScreenState | null;
  const [state, setState] = useState<ScreenState>(forcedState ?? "loading");
  const [items, setItems] = useState<PublicTutorCard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  const query = searchParams.get("q") ?? "";
  const subjectId = searchParams.get("subjectId") ?? "";
  const level = (searchParams.get("level") as PublicSubjectLevel | null) ?? "";
  const city = searchParams.get("city") ?? "";
  const teachingMode = (searchParams.get("teachingMode") as PublicTeachingMode | null) ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const sort = (searchParams.get("sort") as TutorSearchSort | null) ?? "RELEVANCE";
  const effectiveState = forcedState && forcedState !== "ready" ? forcedState : state;

  useEffect(() => {
    getSubjects().then(setSubjects).catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    if (forcedState && forcedState !== "ready") {
      return;
    }

    queueMicrotask(() => {
      setState("loading");
      setError("");
    });

    searchPublicTutors({
      q: query,
      subjectId,
      level: level || undefined,
      city,
      teachingMode: teachingMode || undefined,
      minPrice,
      maxPrice,
      sort,
      pageSize: "50",
    })
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        setState(result.items.length ? "ready" : "empty");
      })
      .catch((requestError: Error) => {
        setError(requestError.message);
        setState("error");
      });
  }, [city, forcedState, level, maxPrice, minPrice, query, sort, subjectId, teachingMode]);

  const activeFilters = useMemo(
    () =>
      [
        query ? `Từ khóa: ${query}` : "",
        subjectId ? "Môn học đã chọn" : "",
        level ? `Trình độ: ${levelLabels[level]}` : "",
        city ? `Khu vực: ${city}` : "",
        teachingMode ? teachingModeLabel(teachingMode) : "",
        minPrice ? `Từ ${formatMoney(minPrice)}/giờ` : "",
        maxPrice ? `Tối đa ${formatMoney(maxPrice)}/giờ` : "",
      ].filter(Boolean),
    [city, level, maxPrice, minPrice, query, subjectId, teachingMode],
  );

  function updateFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    ["q", "subjectId", "level", "city", "teachingMode", "minPrice", "maxPrice", "sort"].forEach((key) => {
      const value = formData.get(key)?.toString();
      if (value) params.set(key, value);
    });

    router.push(`/tutors?${params.toString()}`);
  }

  return (
    <PublicShell>
      <main className="flex w-full gap-6 px-5 pb-12 pt-28 sm:px-8 lg:px-12 2xl:px-16">
        <aside className="hidden w-[300px] shrink-0 md:block 2xl:w-[340px]">
          <FilterPanel
            city={city}
            level={level}
            maxPrice={maxPrice}
            minPrice={minPrice}
            query={query}
            sort={sort}
            subjectId={subjectId}
            subjects={subjects}
            teachingMode={teachingMode}
            updateFilters={updateFilters}
          />
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-[var(--on-surface)]">Tìm gia sư giỏi</h1>
              <p className="mt-2 text-[var(--on-surface-variant)]">
                {effectiveState === "ready"
                  ? `Tìm thấy ${total} gia sư đã xác thực phù hợp với yêu cầu của bạn.`
                  : "Tìm kiếm gia sư theo môn học, trình độ, khu vực, học phí và lịch rảnh."}
              </p>
            </div>
            <form className="flex items-center gap-2" onSubmit={updateFilters}>
              <input name="q" type="hidden" value={query} />
              <input name="subjectId" type="hidden" value={subjectId} />
              <input name="level" type="hidden" value={level} />
              <input name="city" type="hidden" value={city} />
              <input name="teachingMode" type="hidden" value={teachingMode} />
              <input name="minPrice" type="hidden" value={minPrice} />
              <input name="maxPrice" type="hidden" value={maxPrice} />
              <span className="text-xs font-semibold text-[var(--outline)]">Sắp xếp</span>
              <select
                className="rounded-lg border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm font-semibold"
                defaultValue={sort}
                name="sort"
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
              >
                <option value="RELEVANCE">Phù hợp nhất</option>
                <option value="RATING_DESC">Đánh giá cao</option>
                <option value="PRICE_ASC">Giá thấp đến cao</option>
                <option value="PRICE_DESC">Giá cao đến thấp</option>
                <option value="NEWEST">Mới nhất</option>
              </select>
            </form>
          </div>

          {activeFilters.length ? (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--on-surface-variant)]">
                Bộ lọc đang chọn:
              </span>
              {activeFilters.map((filter) => (
                <span
                  className="rounded-full bg-[var(--primary-container)] px-3 py-1 text-xs font-semibold text-white"
                  key={filter}
                >
                  {filter}
                </span>
              ))}
            </div>
          ) : null}

          {effectiveState === "loading" ? <SearchSkeleton /> : null}
          {effectiveState === "error" ? <ErrorState message={error} /> : null}
          {effectiveState === "empty" ? <EmptyState /> : null}
          {effectiveState === "ready" ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {items.map((tutor, index) => (
                <TutorCard image={fallbackImages[index % fallbackImages.length]} key={tutor.id} tutor={tutor} />
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </PublicShell>
  );
}

function FilterPanel({
  city,
  level,
  maxPrice,
  minPrice,
  query,
  sort,
  subjectId,
  subjects,
  teachingMode,
  updateFilters,
}: {
  city: string;
  level: string;
  maxPrice: string;
  minPrice: string;
  query: string;
  sort: string;
  subjectId: string;
  subjects: Subject[];
  teachingMode: string;
  updateFilters: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="sticky top-28 rounded-xl border border-[var(--outline-variant)] bg-white p-5 shadow-sm"
      onSubmit={updateFilters}
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Icon name="tune" />
          Bộ lọc
        </h2>
        <Link className="text-xs font-semibold text-[var(--primary)] hover:underline" href="/tutors">
          Xóa tất cả
        </Link>
      </div>

      <div className="space-y-5">
        <label className="block">
          <span className="text-sm font-semibold text-[var(--on-surface-variant)]">Từ khóa</span>
          <div className="mt-2 flex items-center rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2">
            <Icon className="text-[20px] text-[var(--outline)]" name="search" />
            <input
              className="ml-2 w-full border-0 bg-transparent text-sm outline-none"
              defaultValue={query}
              name="q"
              placeholder="Tên gia sư, môn học..."
            />
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[var(--on-surface-variant)]">Môn học</span>
          <select
            className="mt-2 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-sm outline-none"
            defaultValue={subjectId}
            name="subjectId"
          >
            <option value="">Tất cả môn học</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[var(--on-surface-variant)]">Trình độ</span>
          <select
            className="mt-2 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-sm outline-none"
            defaultValue={level}
            name="level"
          >
            <option value="">Tất cả trình độ</option>
            <option value="PRIMARY">Tiểu học</option>
            <option value="LOWER_SECONDARY">Cấp 2</option>
            <option value="HIGH_SCHOOL">Cấp 3</option>
            <option value="UNIVERSITY">Đại học</option>
            <option value="EXAM_PREP">Luyện thi</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[var(--on-surface-variant)]">Khu vực</span>
          <input
            className="mt-2 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-sm outline-none"
            defaultValue={city}
            name="city"
            placeholder="Hà Nội, TP.HCM..."
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[var(--on-surface-variant)]">Hình thức học</span>
          <select
            className="mt-2 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-sm outline-none"
            defaultValue={teachingMode}
            name="teachingMode"
          >
            <option value="">Tất cả</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Trực tiếp</option>
            <option value="BOTH">Online & trực tiếp</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--on-surface-variant)]">Giá tối thiểu</span>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-sm outline-none"
              defaultValue={minPrice}
              min="0"
              name="minPrice"
              placeholder="100000"
              step="50000"
              type="number"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--on-surface-variant)]">Giá tối đa</span>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-sm outline-none"
              defaultValue={maxPrice}
              min="0"
              name="maxPrice"
              placeholder="500000"
              step="50000"
              type="number"
            />
          </label>
        </div>

        <input name="sort" type="hidden" value={sort} />
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-container)]">
          <Icon className="text-[20px]" name="filter_list" />
          Áp dụng bộ lọc
        </button>
      </div>
    </form>
  );
}

function TutorCard({ tutor, image }: { tutor: PublicTutorCard; image: string }) {
  const location = [tutor.locationDistrict, tutor.locationCity].filter(Boolean).join(", ") || "Chưa cập nhật";

  return (
    <article className="group overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white/90 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-container-high)] shadow-sm sm:h-32 sm:w-32">
          <img alt={tutor.fullName} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" src={tutor.avatarUrl ?? image} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-[var(--on-surface)]" title={tutor.fullName}>
                {tutor.fullName}
              </h2>
              <p className="line-clamp-2 text-sm font-semibold text-[var(--primary)]">
                {tutor.headline ?? "Gia sư chuyên môn cao"}
              </p>
            </div>
            <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--tertiary-fixed)] px-3 py-1 text-xs font-semibold text-[var(--tertiary)]">
              <Icon className="text-[14px]" fill name="verified" />
              <span>Đã xác thực</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tutor.subjects.slice(0, 3).map((item) => (
              <span
                className="rounded bg-[var(--surface-container-high)] px-2 py-1 text-xs font-semibold text-[var(--on-surface-variant)]"
                key={item.id}
              >
                {item.subject.name} · {levelLabels[item.level]}
              </span>
            ))}
          </div>
          <div className="grid gap-2 text-sm text-[var(--on-surface-variant)] sm:grid-cols-2">
            <span className="flex items-center gap-1">
              <Icon className="text-[18px]" name="location_on" />
              {location}
            </span>
            <span className="flex items-center gap-1">
              <Icon className="text-[18px]" name="laptop_chromebook" />
              {teachingModeLabel(tutor.teachingMode)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--outline-variant)] pt-3">
            <div>
              <p className="flex items-center gap-1 text-sm">
                <Icon className="text-[18px] text-[var(--secondary)]" fill name="star" />
                <strong>{Number(tutor.ratingAvg).toFixed(1)}</strong>
                <span className="text-[var(--outline)]">({tutor.totalSessions} buổi)</span>
              </p>
              <p className="text-xl font-semibold text-[var(--primary)]">
                {formatMoney(tutor.hourlyRate)}
                <span className="text-xs font-normal text-[var(--outline)]">/giờ</span>
              </p>
            </div>
            <Link
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-container)]"
              href={`/tutors/${tutor.id}`}
            >
              Xem hồ sơ
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function SearchSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="rounded-xl border border-[var(--outline-variant)] bg-white p-4 shadow-sm" key={index}>
          <div className="flex gap-4">
            <div className="skeleton-shimmer h-32 w-32 rounded-xl" />
            <div className="flex-1 space-y-3">
              <div className="skeleton-shimmer h-5 w-2/3 rounded" />
              <div className="skeleton-shimmer h-4 w-4/5 rounded" />
              <div className="flex gap-2">
                <div className="skeleton-shimmer h-6 w-20 rounded" />
                <div className="skeleton-shimmer h-6 w-24 rounded" />
              </div>
              <div className="skeleton-shimmer h-10 w-full rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-[var(--outline-variant)] bg-white p-8 text-center shadow-sm">
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--surface-container-low)]">
          <Icon className="text-[52px] text-[var(--primary)]" name="search_off" />
        </div>
        <h2 className="text-2xl font-semibold">Không tìm thấy gia sư phù hợp</h2>
        <p className="mt-2 text-[var(--on-surface-variant)]">
          Hãy thử bỏ bớt bộ lọc, mở rộng khu vực hoặc chọn hình thức học online.
        </p>
        <Link className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href="/tutors">
          Xóa bộ lọc
        </Link>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-[var(--error-container)] bg-white p-8 text-center shadow-sm">
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--error-container)]">
          <Icon className="text-[52px] text-[var(--error)]" name="cloud_off" />
        </div>
        <h2 className="text-2xl font-semibold">Không tải được danh sách gia sư</h2>
        <p className="mt-2 text-[var(--on-surface-variant)]">{message || "Vui lòng kiểm tra API hoặc thử lại sau."}</p>
        <button
          className="mt-5 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white"
          onClick={() => window.location.reload()}
          type="button"
        >
          Tải lại
        </button>
      </div>
    </div>
  );
}
