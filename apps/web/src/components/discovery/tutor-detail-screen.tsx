"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PublicShell, Icon } from "./public-shell";
import {
  getPublicTutor,
  getPublicTutorAvailability,
  PublicTutorDetail,
  TutorAvailabilitySlot,
} from "@/lib/discovery-api";
import { createBooking } from "@/lib/booking-api";
import { useAuthStore } from "@/lib/auth-store";

type DetailState = "loading" | "ready" | "not-found" | "error";

const profileImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDI0zJSdYqsekNGFXWm73rG_kt28T6edrrERWh1TzUeLB_jnwUrQMrJ-ppCzBNUVVVEQw9eW95Mq-kIbEnNNMDs4wVD6rz_xFJ_R60paSjgJjgZAvQV5z0ncxcnpxS3qQW08aEdbs5JPhaH6zJwY3kZ65nKqsiapmpMoL088wdNY6PZCmRRWwOGWFAk8J4iAg6JtV2_lpFO-W6pWyvajv3wU_mYd_8AEAdS68qlJ-7fbyt6fXGbpWZpUk4s-f9aRQ-wg9X5wNVXwTo";

function formatMoney(value: string | null) {
  const amount = Number(value ?? 0);
  if (!amount) return "LiÃªn há»‡";
  return new Intl.NumberFormat("vi-VN").format(amount) + "Ä‘";
}

function teachingModeLabel(mode: string) {
  if (mode === "ONLINE") return "Online";
  if (mode === "OFFLINE") return "Trá»±c tiáº¿p";
  return "Online & trá»±c tiáº¿p";
}

const levelLabels: Record<string, string> = {
  PRIMARY: "Tiá»ƒu há»c",
  LOWER_SECONDARY: "Cáº¥p 2",
  HIGH_SCHOOL: "Cáº¥p 3",
  UNIVERSITY: "Äáº¡i há»c",
  BASIC: "CÆ¡ báº£n",
  INTERMEDIATE: "Trung cáº¥p",
  ADVANCED: "NÃ¢ng cao",
  EXAM_PREP: "Luyá»‡n thi",
};

function documentLabel(type: string) {
  const labels: Record<string, string> = {
    NATIONAL_ID_FRONT: "CCCD máº·t trÆ°á»›c",
    NATIONAL_ID_BACK: "CCCD máº·t sau",
    DEGREE: "Báº±ng cáº¥p",
    CERTIFICATE: "Chá»©ng chá»‰",
    BACKGROUND_CHECK: "XÃ¡c minh lÃ½ lá»‹ch",
    OTHER: "TÃ i liá»‡u khÃ¡c",
  };
  return labels[type] ?? type;
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
  const searchParams = useSearchParams();
  const forcedState = searchParams.get("state") as DetailState | null;
  const [state, setState] = useState<DetailState>(forcedState ?? "loading");
  const [tutor, setTutor] = useState<PublicTutorDetail | null>(null);
  const [slots, setSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [week, setWeek] = useState(weekStart());
  const [error, setError] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const auth = useAuthStore();
  const effectiveState = forcedState && forcedState !== "ready" ? forcedState : state;

  async function handleCreateBooking() {
    if (!selectedSlotId) return;
    if (!auth.token) {
      window.location.href = `/auth/login?next=${encodeURIComponent(`/tutors/${id}`)}`;
      return;
    }
    if (auth.user?.role !== "STUDENT") {
      setBookingMessage("Chá»‰ tÃ i khoáº£n há»c sinh má»›i cÃ³ thá»ƒ Ä‘áº·t lá»‹ch.");
      return;
    }

    setIsBooking(true);
    setBookingMessage("");
    try {
      await createBooking(auth.token, selectedSlotId);
      setBookingMessage("Äáº·t lá»‹ch thÃ nh cÃ´ng. Lá»‹ch Ä‘Ã£ Ä‘Æ°á»£c lÆ°u vÃ o dashboard cá»§a báº¡n.");
      setSelectedSlotId(null);
      const availability = await getPublicTutorAvailability(id, week.toISOString());
      setSlots(availability.slots);
    } catch (requestError) {
      setBookingMessage(requestError instanceof Error ? requestError.message : "KhÃ´ng thá»ƒ Ä‘áº·t lá»‹ch.");
    } finally {
      setIsBooking(false);
    }
  }

  useEffect(() => {
    if (forcedState && forcedState !== "ready") {
      return;
    }

    queueMicrotask(() => {
      setState("loading");
      setError("");
    });

    Promise.all([getPublicTutor(id), getPublicTutorAvailability(id, week.toISOString())])
      .then(([profile, availability]) => {
        setTutor(profile);
        setSlots(availability.slots);
        setState("ready");
      })
      .catch((requestError: Error) => {
        setError(requestError.message);
        setState(requestError.message.toLowerCase().includes("not found") ? "not-found" : "error");
      });
  }, [forcedState, id, week]);

  const location = useMemo(() => {
    if (!tutor) return "";
    return [tutor.locationDistrict, tutor.locationCity].filter(Boolean).join(", ") || "ChÆ°a cáº­p nháº­t";
  }, [tutor]);

  return (
    <PublicShell>
      <main className="w-full px-5 pb-12 pt-28 sm:px-8 lg:px-12 2xl:px-16">
        <Link className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--primary)]" href="/tutors">
          <Icon className="text-[20px]" name="arrow_back" />
          Quay láº¡i danh sÃ¡ch
        </Link>

        {effectiveState === "loading" ? <DetailSkeleton /> : null}
        {effectiveState === "error" ? <StatePanel icon="cloud_off" title="KhÃ´ng táº£i Ä‘Æ°á»£c há»“ sÆ¡" message={error || "Vui lÃ²ng thá»­ láº¡i sau."} /> : null}
        {effectiveState === "not-found" ? (
          <StatePanel
            icon="person_off"
            title="KhÃ´ng tÃ¬m tháº¥y gia sÆ°"
            message="Há»“ sÆ¡ cÃ³ thá»ƒ chÆ°a Ä‘Æ°á»£c duyá»‡t, Ä‘Ã£ táº¡m áº©n hoáº·c Ä‘Æ°á»ng dáº«n khÃ´ng chÃ­nh xÃ¡c."
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
                    src={tutor.avatarUrl ?? profileImage}
                  />
                  <div className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[var(--primary-container)] text-white">
                    <Icon className="text-[18px]" fill name="verified" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-4xl font-bold tracking-tight text-[var(--primary)]">{tutor.fullName}</h1>
                    <span className="rounded-full border border-[var(--primary-container)]/20 bg-[var(--primary-container)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary-container)]">
                      ÄÃ£ xÃ¡c thá»±c
                    </span>
                  </div>
                  <p className="mt-2 text-xl font-semibold text-[var(--on-surface-variant)]">
                    {tutor.headline ?? "Gia sÆ° chuyÃªn mÃ´n cao"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--on-surface-variant)]">
                    <span className="flex items-center gap-1 text-[var(--secondary)]">
                      <Icon className="text-[18px]" fill name="star" />
                      <strong>{Number(tutor.ratingAvg).toFixed(1)}</strong> ({tutor.totalSessions} buá»•i)
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Há»c phÃ­</p>
                  <p className="text-3xl font-bold text-[var(--primary)]">
                    {formatMoney(tutor.hourlyRate)}
                    <span className="text-sm font-normal text-[var(--outline)]">/giá»</span>
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button className="rounded-xl border border-[var(--outline-variant)] p-3 text-[var(--error)] transition hover:bg-[var(--surface-container)]" type="button">
                      <Icon name="favorite" />
                    </button>
                    <button className="rounded-xl border border-[var(--outline-variant)] p-3 text-[var(--primary)] transition hover:bg-[var(--surface-container)]" type="button">
                      <Icon name="mail" />
                    </button>
                    <a className="rounded-xl bg-[var(--secondary-container)] px-5 py-3 text-sm font-bold text-[var(--on-surface)] transition hover:opacity-90" href="#availability">
                      Äáº·t lá»‹ch ngay
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
                    Giá»›i thiá»‡u báº£n thÃ¢n
                  </h2>
                  <p className="whitespace-pre-line text-lg leading-8 text-[var(--on-surface-variant)]">
                    {tutor.bio ?? tutor.bioExcerpt ?? "Gia sÆ° chÆ°a cáº­p nháº­t pháº§n giá»›i thiá»‡u chi tiáº¿t."}
                  </p>
                </section>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <section className="rounded-xl border border-[var(--outline-variant)] bg-white/90 p-6 shadow-sm">
                    <h2 className="mb-4 text-xl font-semibold text-[var(--primary)]">MÃ´n há»c</h2>
                    <div className="flex flex-wrap gap-2">
                      {tutor.subjects.length ? (
                        tutor.subjects.map((item) => (
                          <span className="rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-high)] px-4 py-2 text-sm font-semibold" key={item.id}>
                            {item.subject.name} Â· {levelLabels[item.level] ?? item.level}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-[var(--on-surface-variant)]">ChÆ°a cáº­p nháº­t mÃ´n há»c.</span>
                      )}
                    </div>
                  </section>

                  <section className="rounded-xl border border-[var(--outline-variant)] bg-white/90 p-6 shadow-sm">
                    <h2 className="mb-4 text-xl font-semibold text-[var(--primary)]">Kinh nghiá»‡m</h2>
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--primary-container)]/10 text-[var(--primary)]">
                        <Icon className="text-[32px]" name="workspace_premium" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold">{tutor.experienceYears ?? 0} nÄƒm</p>
                        <p className="text-sm text-[var(--outline)]">Kinh nghiá»‡m giáº£ng dáº¡y</p>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="rounded-xl border border-[var(--outline-variant)] bg-white/90 p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold text-[var(--primary)]">
                    <Icon name="verified_user" />
                    TÃ i liá»‡u Ä‘Ã£ xÃ¡c minh
                  </h2>
                  <div className="space-y-3">
                    {tutor.verifiedDocuments.length ? (
                      tutor.verifiedDocuments.map((document) => (
                        <div className="flex items-center gap-3 rounded-lg border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] p-3" key={document.id}>
                          <Icon className="text-[var(--tertiary)]" fill name="check_circle" />
                          <div>
                            <p className="font-semibold">{documentLabel(document.type)}</p>
                            <p className="text-sm text-[var(--on-surface-variant)]">ÄÃ£ Ä‘Æ°á»£c TutorConnect kiá»ƒm duyá»‡t</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--on-surface-variant)]">Há»“ sÆ¡ Ä‘Ã£ duyá»‡t, tÃ i liá»‡u khÃ´ng hiá»ƒn thá»‹ cÃ´ng khai.</p>
                    )}
                  </div>
                </section>
              </div>

              <aside className="space-y-6 lg:col-span-4">
                <section className="sticky top-24 rounded-xl border border-[var(--outline-variant)] bg-white/95 p-5 shadow-lg" id="availability">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-[var(--primary)]">Lá»‹ch ráº£nh</h2>
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

                  <button
                    className="mt-5 w-full rounded-xl bg-[var(--primary)] py-4 text-base font-bold text-white shadow-sm transition hover:bg-[var(--primary-container)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedSlotId || isBooking}
                    onClick={handleCreateBooking}
                    type="button"
                  >
                    {isBooking ? "Dang dat lich..." : "Dat lich hoc"}
                  </button>
                  {bookingMessage ? (
                    <p className="mt-3 rounded-lg bg-[var(--surface-container-low)] p-3 text-sm font-semibold text-[var(--on-surface-variant)]">
                      {bookingMessage}
                    </p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="rounded-xl border border-[var(--outline-variant)] py-3 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--surface-container)]" type="button">
                      Nháº¯n tin
                    </button>
                    <button className="rounded-xl border border-[var(--outline-variant)] py-3 text-sm font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]" type="button">
                      LÆ°u gia sÆ°
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </main>
    </PublicShell>
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
    { label: "SÃ¡ng", icon: "light_mode", start: 5, end: 12 },
    { label: "Chiá»u", icon: "wb_sunny", start: 12, end: 18 },
    { label: "Tá»‘i", icon: "bedtime", start: 18, end: 24 },
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
                  onClick={() => setSelectedSlotId(selected ? null : slot?.id ?? null)}
                  type="button"
                >
                  {slot ? new Date(slot.startsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "Trá»‘ng"}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 border-t border-[var(--outline-variant)]/50 pt-4 text-xs text-[var(--on-surface-variant)]">
        <span className="flex items-center gap-1">
          <span className="h-4 w-4 rounded border border-[var(--primary)] bg-white" />
          Ráº£nh
        </span>
        <span className="flex items-center gap-1">
          <span className="h-4 w-4 rounded bg-[var(--primary)]" />
          ÄÃ£ chá»n
        </span>
        <span className="flex items-center gap-1">
          <span className="h-4 w-4 rounded bg-[var(--surface-container-high)]" />
          Báº­n
        </span>
      </div>
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
          Vá» danh sÃ¡ch gia sÆ°
        </Link>
      </div>
    </div>
  );
}


