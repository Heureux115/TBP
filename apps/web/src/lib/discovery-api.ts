const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export type PublicTeachingMode = "ONLINE" | "OFFLINE" | "BOTH";
export type PublicSubjectLevel =
  | "PRIMARY"
  | "LOWER_SECONDARY"
  | "HIGH_SCHOOL"
  | "UNIVERSITY"
  | "BASIC"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "EXAM_PREP";
export type TutorSearchSort =
  | "RELEVANCE"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "RATING_DESC"
  | "NEWEST";

export type PublicSubject = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  isActive: boolean;
};

export type PublicTutorSubject = {
  id: string;
  level: PublicSubjectLevel;
  subject: PublicSubject;
};

export type PublicTutorCard = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  headline: string | null;
  bioExcerpt: string | null;
  experienceYears: number | null;
  hourlyRate: string | null;
  teachingMode: PublicTeachingMode;
  locationCity: string | null;
  locationDistrict: string | null;
  ratingAvg: string;
  totalSessions: number;
  verified: boolean;
  subjects: PublicTutorSubject[];
};

export type PublicTutorDetail = PublicTutorCard & {
  bio: string | null;
  introVideoUrl: string | null;
  approvedAt: string | null;
  verifiedDocuments: Array<{
    id: string;
    type: string;
    status: string;
  }>;
};

export type TutorSearchResponse = {
  items: PublicTutorCard[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type TutorAvailabilitySlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  isBooked: boolean;
  isAvailable: boolean;
};

export type TutorAvailabilityResponse = {
  tutorId: string;
  weekStart: string;
  weekEnd: string;
  slots: TutorAvailabilitySlot[];
};

export type TutorSearchParams = {
  q?: string;
  subjectId?: string;
  level?: PublicSubjectLevel;
  city?: string;
  district?: string;
  teachingMode?: PublicTeachingMode;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  sort?: TutorSearchSort;
  page?: string;
  pageSize?: string;
};

async function publicRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : "Không thể tải dữ liệu.";
    throw new Error(message);
  }

  return body as T;
}

function toQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim()) {
      searchParams.set(key, value.trim());
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function searchPublicTutors(params: TutorSearchParams) {
  return publicRequest<TutorSearchResponse>(`/tutors/search${toQuery(params)}`);
}

export function getPublicTutor(id: string) {
  return publicRequest<PublicTutorDetail>(`/tutors/${id}`);
}

export function getPublicTutorAvailability(id: string, weekStart?: string) {
  return publicRequest<TutorAvailabilityResponse>(
    `/tutors/${id}/availability${toQuery({ weekStart })}`,
  );
}
