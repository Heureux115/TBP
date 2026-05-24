const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export type TutorVerificationStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export type TeachingMode = "ONLINE" | "OFFLINE" | "BOTH";
export type SubjectLevel =
  | "PRIMARY"
  | "LOWER_SECONDARY"
  | "HIGH_SCHOOL"
  | "UNIVERSITY"
  | "BASIC"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "EXAM_PREP";
export type TutorDocumentType =
  | "NATIONAL_ID_FRONT"
  | "NATIONAL_ID_BACK"
  | "DEGREE"
  | "CERTIFICATE"
  | "BACKGROUND_CHECK"
  | "OTHER";
export type TutorDocumentStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Subject = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  isActive: boolean;
};

export type TutorSubject = {
  id: string;
  subject: Subject;
  level: SubjectLevel;
};

export type TutorDocument = {
  id: string;
  type: TutorDocumentType;
  status: TutorDocumentStatus;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number;
  rejectionReason: string | null;
  reviewedAt: string | null;
};

export type TutorProfile = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  introVideoUrl: string | null;
  experienceYears: number | null;
  hourlyRate: string | null;
  teachingMode: TeachingMode;
  locationCity: string | null;
  locationDistrict: string | null;
  verificationStatus: TutorVerificationStatus;
  verificationSubmittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  subjects: TutorSubject[];
  documents: TutorDocument[];
};

export type AdminTutorListItem = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  city: string | null;
  district: string | null;
  subjectCount: number;
  documentCount: number;
  submittedAt: string | null;
  status: TutorVerificationStatus;
};

export type TutorSubjectInput = {
  subjectId: string;
  level: SubjectLevel;
};

export type UpsertTutorProfilePayload = {
  headline?: string;
  bio?: string;
  introVideoUrl?: string;
  experienceYears?: number;
  hourlyRate?: string;
  teachingMode?: TeachingMode;
  locationCity?: string;
  locationDistrict?: string;
  subjects?: TutorSubjectInput[];
};

export type CreateTutorDocumentPayload = {
  type: TutorDocumentType;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number;
};

export type UploadUrlPayload = {
  type: TutorDocumentType;
  fileName: string;
  mimeType: string;
};

async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : "Request failed.";
    throw new Error(message);
  }

  return body as T;
}

export function getMyTutorProfile(token: string) {
  return request<TutorProfile>("/tutors/me", token);
}

export function createTutorProfile(token: string, payload: UpsertTutorProfilePayload) {
  return request<TutorProfile>("/tutors/me", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTutorProfile(token: string, payload: UpsertTutorProfilePayload) {
  return request<TutorProfile>("/tutors/me", token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function submitTutorVerification(token: string) {
  return request<TutorProfile>("/tutors/me/submit-verification", token, { method: "POST" });
}

export function getTutorDocuments(token: string) {
  return request<TutorDocument[]>("/tutors/me/documents", token);
}

export function createTutorDocument(token: string, payload: CreateTutorDocumentPayload) {
  return request<TutorDocument>("/tutors/documents", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createTutorDocumentUploadUrl(token: string, payload: UploadUrlPayload) {
  return request<{ uploadUrl: string; filePath: string; expiresIn: number }>(
    "/tutors/documents/upload-url",
    token,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

async function uploadForm<T>(path: string, token: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : "Upload failed.";
    throw new Error(message);
  }

  return body as T;
}

export function uploadTutorAvatar(token: string, file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return uploadForm<TutorProfile>("/tutors/me/avatar", token, formData);
}

export function uploadTutorDocumentFile(token: string, type: TutorDocumentType, file: File) {
  const formData = new FormData();
  formData.set("type", type);
  formData.set("file", file);

  return uploadForm<TutorDocument>("/tutors/documents/upload", token, formData);
}

export function getSubjects(token?: string) {
  if (token) {
    return request<Subject[]>("/subjects", token);
  }

  return fetch(`${API_URL}/subjects`).then(async (response) => {
    if (!response.ok) {
      throw new Error("Unable to load subjects.");
    }

    return (await response.json()) as Subject[];
  });
}

export function getAdminTutors(token: string, status?: TutorVerificationStatus) {
  const query = status ? `?status=${status}` : "";
  return request<AdminTutorListItem[]>(`/admin/tutors${query}`, token);
}

export function getAdminTutor(token: string, id: string) {
  return request<TutorProfile>(`/admin/tutors/${id}`, token);
}

export function approveTutor(token: string, id: string) {
  return request<TutorProfile>(`/admin/tutors/${id}/approve`, token, { method: "PATCH" });
}

export function rejectTutor(token: string, id: string, reason: string) {
  return request<TutorProfile>(`/admin/tutors/${id}/reject`, token, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}
