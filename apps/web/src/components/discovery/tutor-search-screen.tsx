"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicShell } from "./public-shell";
import {
  getPublicTutorAvailability,
  PublicSubjectLevel,
  PublicTeachingMode,
  PublicTutorCard,
  searchPublicTutors,
  TutorAvailabilitySlot,
  TutorSearchSort,
} from "@/lib/discovery-api";
import { getSubjects, Subject } from "@/lib/tutor-api";
import { matchesSearchTokens, normalizeSearchText, searchTokens } from "@/lib/search-text";
import { Avatar, Badge, Button, Card, FeedbackState, Icon, Skeleton, StatusBadge } from "@/components/ui";

type ScreenState = "loading" | "ready" | "empty" | "error";

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

const sortLabels: Record<TutorSearchSort, string> = {
  RELEVANCE: "Phù hợp nhất",
  RATING_DESC: "Đánh giá cao",
  PRICE_ASC: "Giá thấp đến cao",
  PRICE_DESC: "Giá cao đến thấp",
  NEWEST: "Mới nhất",
};

function formatMoney(value: string | null) {
  const amount = Number(value || 0);
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
  const [state, setState] = useState<ScreenState>("loading");
  const [items, setItems] = useState<PublicTutorCard[]>([]);
  const [availabilityPreview, setAvailabilityPreview] = useState<Record<string, TutorAvailabilitySlot[]>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  const query = searchParams.get("q") || "";
  const subjectId = searchParams.get("subjectId") || "";
  const level = (searchParams.get("level") as PublicSubjectLevel | null) || "";
  const city = searchParams.get("city") || "";
  const teachingMode = (searchParams.get("teachingMode") as PublicTeachingMode | null) || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const sort = (searchParams.get("sort") as TutorSearchSort | null) || "RELEVANCE";
  const effectiveState = forcedState && forcedState !== "ready" ? forcedState : state;

  useEffect(() => {
    getSubjects().then(setSubjects).catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    if (forcedState && forcedState !== "ready") {
      return;
    }

    let cancelled = false;

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
        if (cancelled) return;

        setItems(result.items);
        setTotal(result.total);
        setState(result.items.length ? "ready" : "empty");
        setAvailabilityPreview({});

        const previewTutors = result.items.slice(0, 8);
        if (!previewTutors.length) return;

        Promise.allSettled(
          previewTutors.map(async (tutor) => {
            const availability = await getPublicTutorAvailability(tutor.id);
            const slots = availability.slots
              .filter((slot) => slot.isAvailable && !slot.isBooked && new Date(slot.startsAt) >= new Date())
              .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
              .slice(0, 3);

            return [tutor.id, slots] as const;
          }),
        ).then((results) => {
          if (cancelled) return;

          setAvailabilityPreview(
            results.reduce<Record<string, TutorAvailabilitySlot[]>>((acc, item) => {
              if (item.status === "fulfilled") {
                const [tutorId, slots] = item.value;
                acc[tutorId] = slots;
              }
              return acc;
            }, {}),
          );
        });
      })
      .catch((requestError: Error) => {
        if (cancelled) return;

        setError(requestError.message);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [city, forcedState, level, maxPrice, minPrice, query, sort, subjectId, teachingMode]);

  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const activeFilters = useMemo(
    () =>
      [
        query ? `Từ khóa: ${query}` : "",
        subjectId ? `Môn: ${selectedSubject?.name || "Đã chọn"}` : "",
        level ? `Trình độ: ${levelLabels[level]}` : "",
        city ? `Khu vực: ${city}` : "",
        teachingMode ? teachingModeLabel(teachingMode) : "",
        minPrice ? `Từ ${formatMoney(minPrice)}/giờ` : "",
        maxPrice ? `Tối đa ${formatMoney(maxPrice)}/giờ` : "",
      ].filter(Boolean),
    [city, level, maxPrice, minPrice, query, selectedSubject?.name, subjectId, teachingMode],
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
      <main className="w-full px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
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
              tutors={items}
              updateFilters={updateFilters}
            />
          </aside>

          <section className="min-w-0">
            <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-[var(--shadow-panel)] sm:p-5 lg:bg-transparent lg:p-0 lg:shadow-none lg:border-0">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[var(--primary)]">
                    <Icon className="text-base" name="verified_user" />
                    Gia sư đã duyệt hồ sơ
                  </p>
                  <h1 className="text-3xl font-black leading-tight text-[var(--on-surface)] sm:text-4xl">
                    Tìm gia sư phù hợp với mục tiêu học tập
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--on-surface-variant)] sm:text-base">
                    {effectiveState === "ready"
                      ? `Tìm thấy ${total} gia sư phù hợp. So sánh môn học, mức phí, hình thức học và tín hiệu xác minh trước khi xem hồ sơ.`
                      : "Tìm kiếm theo môn học, trình độ, khu vực, học phí và hình thức học để chọn gia sư đáng tin."}
                  </p>
                </div>
                <SortForm
                  city={city}
                  level={level}
                  maxPrice={maxPrice}
                  minPrice={minPrice}
                  query={query}
                  sort={sort}
                  subjectId={subjectId}
                  teachingMode={teachingMode}
                  updateFilters={updateFilters}
                />
              </div>
            </div>

            <details className="mb-5 rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[var(--shadow-panel)] lg:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black text-[var(--on-surface)]">
                <span className="inline-flex items-center gap-2">
                  <Icon name="tune" />
                  Bộ lọc tìm kiếm
                </span>
                <span className="text-xs font-bold text-[var(--primary)]">{activeFilters.length ? `${activeFilters.length} đang chọn` : "Mở bộ lọc"}</span>
              </summary>
              <div className="border-t border-[var(--outline-variant)] p-4">
                <FilterPanel
                  city={city}
                  compact
                  level={level}
                  maxPrice={maxPrice}
                  minPrice={minPrice}
                  query={query}
                  sort={sort}
                  subjectId={subjectId}
                  subjects={subjects}
                  teachingMode={teachingMode}
                  tutors={items}
                  updateFilters={updateFilters}
                />
              </div>
            </details>

            {activeFilters.length ? (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[var(--on-surface-variant)]">Đang lọc:</span>
                {activeFilters.map((filter) => (
                  <Badge key={filter} tone="info">
                    {filter}
                  </Badge>
                ))}
                <Link className="ml-1 text-xs font-black text-[var(--primary)] hover:underline" href="/tutors">
                  Xóa tất cả
                </Link>
              </div>
            ) : null}

            {effectiveState === "loading" ? <SearchSkeleton /> : null}
            {effectiveState === "error" ? <ErrorState message={error} /> : null}
            {effectiveState === "empty" ? <EmptyState /> : null}
            {effectiveState === "ready" ? (
              <div className="space-y-4">
                {items.map((tutor) => (
                  <TutorCard key={tutor.id} slots={availabilityPreview[tutor.id] || []} tutor={tutor} />
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </PublicShell>
  );
}

function SortForm({
  city,
  level,
  maxPrice,
  minPrice,
  query,
  sort,
  subjectId,
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
  teachingMode: string;
  updateFilters: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="flex w-full items-center gap-2 sm:w-auto" onSubmit={updateFilters}>
      <input name="q" type="hidden" value={query} />
      <input name="subjectId" type="hidden" value={subjectId} />
      <input name="level" type="hidden" value={level} />
      <input name="city" type="hidden" value={city} />
      <input name="teachingMode" type="hidden" value={teachingMode} />
      <input name="minPrice" type="hidden" value={minPrice} />
      <input name="maxPrice" type="hidden" value={maxPrice} />
      <label className="sr-only" htmlFor="tutor-sort">
        Sắp xếp danh sách gia sư
      </label>
      <span className="hidden text-xs font-bold text-[var(--outline)] sm:inline">Sắp xếp</span>
      <select
        className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm font-bold text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)] sm:w-52"
        defaultValue={sort}
        id="tutor-sort"
        name="sort"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {(Object.keys(sortLabels) as TutorSearchSort[]).map((value) => (
          <option key={value} value={value}>
            {sortLabels[value]}
          </option>
        ))}
      </select>
    </form>
  );
}

function FilterPanel({
  city,
  compact = false,
  level,
  maxPrice,
  minPrice,
  query,
  sort,
  subjectId,
  subjects,
  teachingMode,
  tutors,
  updateFilters,
}: {
  city: string;
  compact?: boolean;
  level: string;
  maxPrice: string;
  minPrice: string;
  query: string;
  sort: string;
  subjectId: string;
  subjects: Subject[];
  teachingMode: string;
  tutors: PublicTutorCard[];
  updateFilters: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const body = (
    <form className="space-y-5" onSubmit={updateFilters}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-[var(--on-surface)]">
            <Icon name="tune" />
            Bộ lọc
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--on-surface-variant)]">
            Thu hẹp theo nhu cầu học thật, không chỉ theo giá.
          </p>
        </div>
        <Link className="shrink-0 text-xs font-black text-[var(--primary)] hover:underline" href="/tutors">
          Xóa
        </Link>
      </div>

      <SearchSuggestField key={query} query={query} subjects={subjects} tutors={tutors} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Field label="Môn học">
          <select className={inputClassName} defaultValue={subjectId} name="subjectId">
            <option value="">Tất cả môn học</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Trình độ">
          <select className={inputClassName} defaultValue={level} name="level">
            <option value="">Tất cả trình độ</option>
            <option value="PRIMARY">Tiểu học</option>
            <option value="LOWER_SECONDARY">Cấp 2</option>
            <option value="HIGH_SCHOOL">Cấp 3</option>
            <option value="UNIVERSITY">Đại học</option>
            <option value="EXAM_PREP">Luyện thi</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Field label="Khu vực">
          <input className={inputClassName} defaultValue={city} name="city" placeholder="Hà Nội, TP.HCM..." />
        </Field>

        <Field label="Hình thức học">
          <select className={inputClassName} defaultValue={teachingMode} name="teachingMode">
            <option value="">Tất cả</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Trực tiếp</option>
            <option value="BOTH">Online & trực tiếp</option>
          </select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-[var(--on-surface-variant)]">Học phí theo giờ</p>
        <div className="grid grid-cols-2 gap-3">
          <input className={inputClassName} defaultValue={minPrice} min="0" name="minPrice" placeholder="Từ" step="50000" type="number" />
          <input className={inputClassName} defaultValue={maxPrice} min="0" name="maxPrice" placeholder="Đến" step="50000" type="number" />
        </div>
        <p className="mt-2 text-xs font-semibold text-[var(--outline)]">Nhập VNĐ/giờ, ví dụ 200000.</p>
      </div>

      <input name="sort" type="hidden" value={sort} />
      <Button className="w-full" leftIcon={<Icon className="text-[20px]" name="filter_list" />} type="submit">
        Áp dụng bộ lọc
      </Button>
    </form>
  );

  if (compact) return body;

  return <Card className="sticky top-28 p-5">{body}</Card>;
}

type SearchSuggestion = {
  label: string;
  meta: string;
  value: string;
};

function SearchSuggestField({
  query,
  subjects,
  tutors,
}: {
  query: string;
  subjects: Subject[];
  tutors: PublicTutorCard[];
}) {
  const [value, setValue] = useState(query);
  const [isOpen, setIsOpen] = useState(false);

  const suggestions = useMemo(() => {
    const tokens = searchTokens(value);
    const candidates = buildSearchSuggestions(subjects, tutors);

    if (!tokens.length) {
      return candidates.slice(0, 6);
    }

    return candidates
      .filter((suggestion) => matchesSearchTokens(`${suggestion.label} ${suggestion.meta}`, tokens))
      .slice(0, 6);
  }, [subjects, tutors, value]);

  return (
    <div className="relative">
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[var(--on-surface-variant)]">Từ khóa</span>
        <span className="flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 transition focus-within:border-[var(--primary)] focus-within:shadow-[var(--focus-ring)]">
          <Icon className="text-[20px] text-[var(--outline)]" name="search" />
          <input
            autoComplete="off"
            className="ml-2 w-full border-0 bg-transparent text-sm font-medium text-[var(--on-surface)] outline-none placeholder:text-[var(--outline)]"
            name="q"
            onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
            onChange={(event) => {
              setValue(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Tên gia sư, môn học..."
            type="search"
            value={value}
          />
          {value ? (
            <button
              aria-label="Xóa từ khóa"
              className="ml-2 rounded-[var(--radius-sm)] p-1 text-[var(--outline)] hover:bg-white hover:text-[var(--primary)]"
              onClick={() => setValue("")}
              type="button"
            >
              <Icon className="text-[18px]" name="close" />
            </button>
          ) : null}
        </span>
      </label>

      {isOpen && suggestions.length ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-white shadow-[var(--shadow-popover)]">
          <div className="border-b border-[var(--outline-variant)] px-3 py-2 text-xs font-bold text-[var(--on-surface-variant)]">
            Gợi ý tìm kiếm
          </div>
          {suggestions.map((suggestion) => (
            <button
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--surface-container-low)] focus:bg-[var(--surface-container-low)] focus:outline-none"
              key={`${suggestion.meta}-${suggestion.value}`}
              onMouseDown={(event) => {
                event.preventDefault();
                const form = event.currentTarget.closest("form");
                setValue(suggestion.value);
                setIsOpen(false);
                window.setTimeout(() => form?.requestSubmit(), 0);
              }}
              type="button"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-container-low)] text-[var(--primary)]">
                <Icon className="text-[20px]" name={suggestionIcon(suggestion.meta)} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-[var(--on-surface)]">{suggestion.label}</span>
                <span className="block truncate text-xs font-semibold text-[var(--on-surface-variant)]">{suggestion.meta}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildSearchSuggestions(subjects: Subject[], tutors: PublicTutorCard[]) {
  const seen = new Set<string>();
  const suggestions: SearchSuggestion[] = [];

  function add(label: string | null | undefined, meta: string, value = label || "") {
    const normalized = normalizeSearchText(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    suggestions.push({ label: label || value, meta, value });
  }

  tutors.forEach((tutor) => {
    add(tutor.fullName, "Gia sư");
    add(tutor.headline, "Tiêu đề hồ sơ");
    add([tutor.locationDistrict, tutor.locationCity].filter(Boolean).join(", "), "Khu vực");
    tutor.subjects.forEach((item) => add(item.subject.name, "Môn học"));
  });

  subjects.forEach((subject) => add(subject.name, "Môn học"));
  ["Toán", "Tiếng Anh", "IELTS", "Online", "Hà Nội", "TP.HCM"].forEach((keyword) =>
    add(keyword, "Từ khóa phổ biến"),
  );

  return suggestions;
}

function suggestionIcon(meta: string) {
  if (meta === "Gia sư") return "person_search";
  if (meta === "Môn học") return "menu_book";
  if (meta === "Khu vực") return "location_on";
  return "search";
}

const inputClassName =
  "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-sm font-medium text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]";

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[var(--on-surface-variant)]">{label}</span>
      {children}
    </label>
  );
}

function TutorCard({ slots, tutor }: { slots: TutorAvailabilitySlot[]; tutor: PublicTutorCard }) {
  const location = [tutor.locationDistrict, tutor.locationCity].filter(Boolean).join(", ") || "Chưa cập nhật";
  const visibleSubjects = tutor.subjects.slice(0, 3);
  const extraSubjects = Math.max(0, tutor.subjects.length - visibleSubjects.length);
  const rating = Number(tutor.ratingAvg || 0).toFixed(1);
  const availableSlots = slots.slice(0, 3);

  return (
    <Card className="p-4 transition-[border-color,box-shadow] duration-[var(--duration-base)] hover:border-[var(--primary)] sm:p-5">
      <article className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(160px,auto)] md:items-start">
        <div className="flex items-start gap-3 md:block">
          <Avatar className="h-16 w-16 md:h-20 md:w-20" name={tutor.fullName} size="lg" src={tutor.avatarUrl} />
          <div className="min-w-0 md:hidden">
            <TutorIdentity tutor={tutor} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="hidden md:block">
            <TutorIdentity tutor={tutor} />
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--on-surface-variant)]">
            {tutor.bioExcerpt || tutor.headline || "Gia sư đang hoàn thiện phần giới thiệu, bạn có thể xem hồ sơ để kiểm tra môn học và lịch dạy."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {visibleSubjects.length ? (
              visibleSubjects.map((item) => (
                <Badge key={item.id} tone="neutral">
                  <span className="truncate">
                    {item.subject.name} · {levelLabels[item.level]}
                  </span>
                </Badge>
              ))
            ) : (
              <Badge tone="neutral">Chưa cập nhật môn học</Badge>
            )}
            {extraSubjects ? <Badge tone="info">+{extraSubjects} môn</Badge> : null}
          </div>

          <div className="mt-4 grid gap-2 text-sm font-semibold text-[var(--on-surface-variant)] sm:grid-cols-2">
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="text-[18px] text-[var(--outline)]" name="location_on" />
              <span className="truncate">{location}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="text-[18px] text-[var(--outline)]" name="laptop_chromebook" />
              <span className="truncate">{teachingModeLabel(tutor.teachingMode)}</span>
            </span>
          </div>

          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-black text-[var(--on-surface)]">
                <Icon className="text-[18px] text-[var(--primary)]" name="event_available" />
                Lịch rảnh gần nhất
              </p>
              <Link className="shrink-0 text-xs font-black text-[var(--primary)] hover:underline" href={`/tutors/${tutor.id}#availability`}>
                Xem lịch
              </Link>
            </div>
            {availableSlots.length ? (
              <div className="flex flex-wrap gap-2">
                {availableSlots.map((slot) => (
                  <span className="rounded-full border border-[var(--primary)] bg-white px-2.5 py-1 text-xs font-bold text-[var(--primary)]" key={slot.id}>
                    {formatSlotPreview(slot)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold leading-5 text-[var(--on-surface-variant)]">
                Vào hồ sơ để xem các khung giờ gia sư đang mở trong tuần.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 border-t border-[var(--outline-variant)] pt-4 md:min-w-44 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
            <Metric icon="star" label="Đánh giá" tone="warning" value={rating} />
            <Metric icon="school" label="Buổi học" value={`${tutor.totalSessions}`} />
            <Metric icon="work_history" label="Kinh nghiệm" value={tutor.experienceYears ? `${tutor.experienceYears} năm` : "Mới"} />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--outline)]">Học phí</p>
            <p className="text-2xl font-black leading-tight text-[var(--primary)]">
              {formatMoney(tutor.hourlyRate)}
              <span className="ml-1 text-xs font-semibold text-[var(--outline)]">/giờ</span>
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-[var(--on-primary)] shadow-[var(--shadow-panel)] transition hover:bg-[var(--primary-container)]"
            href={`/tutors/${tutor.id}`}
          >
            Xem hồ sơ
          </Link>
        </div>
      </article>
    </Card>
  );
}

function formatSlotPreview(slot: TutorAvailabilitySlot) {
  const startsAt = new Date(slot.startsAt);
  const endsAt = new Date(slot.endsAt);
  const day = startsAt.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
  const start = startsAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const end = endsAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  return `${day}, ${start}-${end}`;
}

function TutorIdentity({ tutor }: { tutor: PublicTutorCard }) {
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="truncate text-xl font-black text-[var(--on-surface)]" title={tutor.fullName}>
          {tutor.fullName}
        </h2>
        {tutor.verified ? <StatusBadge tone="success">Đã xác thực</StatusBadge> : <StatusBadge tone="neutral">Đang cập nhật</StatusBadge>}
      </div>
      <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-[var(--primary)]">{tutor.headline || "Gia sư chuyên môn cao"}</p>
    </>
  );
}

function Metric({
  icon,
  label,
  tone = "neutral",
  value,
}: {
  icon: string;
  label: string;
  tone?: "neutral" | "warning";
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-2">
      <p className="flex items-center gap-1 text-xs font-bold text-[var(--outline)]">
        <Icon className={tone === "warning" ? "text-[var(--secondary)]" : "text-[var(--outline)]"} fill={tone === "warning"} name={icon} />
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-[var(--on-surface)]">{value}</p>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Đang tải danh sách gia sư">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card className="p-4 sm:p-5" key={index}>
          <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)_180px]">
            <Skeleton className="h-16 w-16 rounded-full md:h-20 md:w-20" />
            <div className="space-y-3">
              <Skeleton className="h-6 w-2/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-10 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-28 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-11 w-full" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <FeedbackState
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--on-primary)]" href="/tutors">
            Xóa bộ lọc
          </Link>
          <Badge tone="info">Thử học online</Badge>
          <Badge tone="neutral">Mở rộng khu vực</Badge>
        </div>
      }
      description="Thử bỏ bớt khoảng giá, mở rộng khu vực hoặc chọn hình thức học online để có thêm lựa chọn."
      title="Chưa tìm thấy gia sư phù hợp"
      tone="not-found"
    />
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <FeedbackState
      actionLabel="Tải lại"
      description={message || "Vui lòng kiểm tra kết nối hoặc thử lại sau."}
      onAction={() => window.location.reload()}
      title="Không tải được danh sách gia sư"
      tone="error"
    />
  );
}
