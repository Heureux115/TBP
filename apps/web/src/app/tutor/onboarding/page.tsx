"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { getAccessToken } from "@/lib/auth-storage";
import {
  getMyTutorProfile,
  getSubjects,
  submitTutorVerification,
  updateTutorProfile,
  uploadTutorAvatar,
  uploadTutorDocumentFile,
  type Subject,
  type SubjectLevel,
  type TeachingMode,
  type TutorDocument,
  type TutorDocumentType,
} from "@/lib/tutor-api";

type Step = 1 | 2 | 3 | 4;
type DocumentKey = "idFront" | "idBack" | "degree" | "certificate";

type SelectedSubject = {
  id: string;
  subjectId: string;
  name: string;
  level: SubjectLevel;
};

const steps: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Thông tin hồ sơ" },
  { id: 2, label: "Môn giảng dạy" },
  { id: 3, label: "Tài liệu xác minh" },
  { id: 4, label: "Kiểm tra & Gửi" },
];

const fallbackSubjects: Subject[] = [
  { id: "10000000-0000-4000-8000-000000000001", name: "Toán học", slug: "toan-hoc", category: "STEM", isActive: true },
  { id: "10000000-0000-4000-8000-000000000002", name: "Vật lý", slug: "vat-ly", category: "STEM", isActive: true },
  { id: "10000000-0000-4000-8000-000000000005", name: "Tiếng Anh", slug: "tieng-anh", category: "Ngoại ngữ", isActive: true },
];

const subjectLevelLabels: Record<SubjectLevel, string> = {
  PRIMARY: "Tiểu học",
  LOWER_SECONDARY: "Cấp 2",
  HIGH_SCHOOL: "Cấp 3",
  UNIVERSITY: "Đại học",
  BASIC: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
  EXAM_PREP: "Luyện thi",
};

const documentConfig: Record<
  DocumentKey,
  { title: string; description: string; type: TutorDocumentType; required: boolean }
> = {
  idFront: {
    title: "CCCD mặt trước",
    description: "Ảnh mặt trước căn cước công dân.",
    type: "NATIONAL_ID_FRONT",
    required: true,
  },
  idBack: {
    title: "CCCD mặt sau",
    description: "Ảnh mặt sau căn cước công dân.",
    type: "NATIONAL_ID_BACK",
    required: true,
  },
  degree: {
    title: "Bằng cấp",
    description: "Bằng đại học, cao đẳng hoặc giấy xác nhận sinh viên.",
    type: "DEGREE",
    required: true,
  },
  certificate: {
    title: "Chứng chỉ",
    description: "IELTS, TOEIC, nghiệp vụ sư phạm hoặc chứng chỉ khác.",
    type: "CERTIFICATE",
    required: false,
  },
};

export default function TutorOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>(fallbackSubjects);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [teachingMode, setTeachingMode] = useState<TeachingMode>("BOTH");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [subjectId, setSubjectId] = useState(fallbackSubjects[0].id);
  const [level, setLevel] = useState<SubjectLevel>("HIGH_SCHOOL");
  const [subjects, setSubjects] = useState<SelectedSubject[]>([]);
  const [documents, setDocuments] = useState<Record<DocumentKey, File | null>>({
    idFront: null,
    idBack: null,
    degree: null,
    certificate: null,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [existingDocuments, setExistingDocuments] = useState<TutorDocument[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    getSubjects(token)
      .then((result) => {
        if (result.length) {
          setAvailableSubjects(result);
          setSubjectId(result[0].id);
        }
      })
      .catch(() => undefined);

    getMyTutorProfile(token)
      .then((profile) => {
        setHeadline(profile.headline || "");
        setBio(profile.bio || "");
        setExperienceYears(profile.experienceYears?.toString() || "");
        setHourlyRate(profile.hourlyRate || "");
        setTeachingMode(profile.teachingMode);
        setCity(profile.locationCity || "");
        setDistrict(profile.locationDistrict || "");
        setExistingDocuments(profile.documents);
        setAvatarPreview(profile.avatarUrl);
        setSubjects(
          profile.subjects.map((item) => ({
            id: item.id,
            subjectId: item.subject.id,
            name: item.subject.name,
            level: item.level,
          })),
        );
        if (profile.verificationStatus === "PENDING_REVIEW") {
          setSubmitted(true);
        }
      })
      .catch(() => undefined);
  }, [router]);

  const existingDocumentTypes = useMemo(
    () => new Set(existingDocuments.map((document) => document.type)),
    [existingDocuments],
  );

  const requiredDocumentsUploaded =
    hasDocument("idFront") && hasDocument("idBack") && hasDocument("degree");

  const profileComplete = Boolean(
    headline.trim() &&
      bio.trim() &&
      experienceYears &&
      hourlyRate.trim() &&
      teachingMode &&
      city.trim() &&
      district.trim(),
  );

  const canSubmit = profileComplete && subjects.length > 0 && requiredDocumentsUploaded && confirmed;
  const progressWidth = `${(step / steps.length) * 100}%`;

  function hasDocument(key: DocumentKey) {
    return Boolean(documents[key]) || existingDocumentTypes.has(documentConfig[key].type);
  }

  function goNext() {
    setStep((current) => Math.min(current + 1, 4) as Step);
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 1) as Step);
  }

  function addSubject() {
    const selected = availableSubjects.find((subject) => subject.id === subjectId);

    if (!selected) {
      return;
    }

    const duplicate = subjects.some(
      (subject) => subject.subjectId === selected.id && subject.level === level,
    );

    if (duplicate) {
      return;
    }

    setSubjects((current) => [
      ...current,
      {
        id: `${selected.id}-${level}`,
        subjectId: selected.id,
        name: selected.name,
        level,
      },
    ]);
  }

  function removeSubject(id: string) {
    setSubjects((current) => current.filter((subject) => subject.id !== id));
  }

  function updateDocument(key: DocumentKey, event: ChangeEvent<HTMLInputElement>) {
    setDocuments((current) => ({
      ...current,
      [key]: event.target.files?.[0] || null,
    }));
  }

  function updateAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  }

  function clearDocument(key: DocumentKey) {
    setDocuments((current) => ({
      ...current,
      [key]: null,
    }));
  }

  async function saveDraft() {
    const token = getAccessToken();

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      await updateTutorProfile(token, {
        headline: headline.trim(),
        bio: bio.trim(),
        experienceYears: experienceYears ? Number(experienceYears) : undefined,
        hourlyRate: hourlyRate.trim(),
        teachingMode,
        locationCity: city.trim(),
        locationDistrict: district.trim(),
        subjects: subjects.map((subject) => ({
          subjectId: subject.subjectId,
          level: subject.level,
        })),
      });
      if (avatarFile) {
        const profile = await uploadTutorAvatar(token, avatarFile);
        setAvatarPreview(profile.avatarUrl);
        setAvatarFile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu hồ sơ.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadPendingDocuments(token: string) {
    const entries = Object.entries(documents).filter(([, file]) => Boolean(file)) as Array<
      [DocumentKey, File]
    >;

    for (const [key, file] of entries) {
      const config = documentConfig[key];
      await uploadTutorDocumentFile(token, config.type, file);
    }
  }

  async function submitProfile() {
    if (!canSubmit) {
      return;
    }

    const token = getAccessToken();

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      await saveDraft();
      await uploadPendingDocuments(token);
      await submitTutorVerification(token);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi hồ sơ duyệt.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <header className="fixed inset-x-0 top-0 z-50 h-20 border-b border-[var(--outline-variant)] bg-white shadow-sm">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <BrandLogo className="text-[var(--primary)]" />
          <div className="flex items-center gap-3">
            <Link
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--surface-container-high)]"
              href="/tutor/profile"
            >
              Lưu và Thoát
            </Link>
            <button
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
              type="button"
            >
              Trợ giúp
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 pb-16 pt-32 sm:px-8">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-bold text-[var(--primary)]">Hoàn thiện hồ sơ gia sư</h1>
          <p className="text-base text-[var(--on-surface-variant)]">
            Cung cấp thông tin chi tiết để học viên dễ dàng tìm thấy bạn.
          </p>
        </div>

        <Stepper progressWidth={progressWidth} setStep={setStep} step={step} />

        {submitted ? (
          <SubmittedState />
        ) : (
          <section className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 shadow-sm sm:p-8">
            {error ? (
              <div className="mb-6 rounded-lg border border-[var(--error)] bg-[var(--error-container)] p-4 text-sm font-semibold text-[var(--error)]">
                {error}
              </div>
            ) : null}

            {step === 1 ? (
              <ProfileStep
                bio={bio}
                city={city}
                district={district}
                experienceYears={experienceYears}
                headline={headline}
                hourlyRate={hourlyRate}
                avatarPreview={avatarPreview}
                setBio={setBio}
                setCity={setCity}
                setDistrict={setDistrict}
                setExperienceYears={setExperienceYears}
                setHeadline={setHeadline}
                setHourlyRate={setHourlyRate}
                updateAvatar={updateAvatar}
                setTeachingMode={setTeachingMode}
                teachingMode={teachingMode}
              />
            ) : null}

            {step === 2 ? (
              <SubjectsStep
                addSubject={addSubject}
                availableSubjects={availableSubjects}
                level={level}
                removeSubject={removeSubject}
                setLevel={setLevel}
                setSubjectId={setSubjectId}
                subjectId={subjectId}
                subjects={subjects}
              />
            ) : null}

            {step === 3 ? (
              <DocumentsStep
                clearDocument={clearDocument}
                documents={documents}
                existingDocumentTypes={existingDocumentTypes}
                updateDocument={updateDocument}
              />
            ) : null}

            {step === 4 ? (
              <ReviewStep
                bio={bio}
                canSubmit={canSubmit}
                city={city}
                confirmed={confirmed}
                district={district}
                documents={documents}
                experienceYears={experienceYears}
                headline={headline}
                hourlyRate={hourlyRate}
                profileComplete={profileComplete}
                requiredDocumentsUploaded={requiredDocumentsUploaded}
                setConfirmed={setConfirmed}
                setStep={setStep}
                subjectCount={subjects.length}
                teachingMode={teachingMode}
              />
            ) : null}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[var(--outline-variant)] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="rounded-lg border border-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--surface-container-high)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={step === 1 || isSaving}
                onClick={goBack}
                type="button"
              >
                Quay lại
              </button>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="rounded-lg border border-[var(--outline)] px-5 py-3 text-sm font-semibold text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-low)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  onClick={() => void saveDraft()}
                  type="button"
                >
                  {isSaving ? "Đang lưu..." : "Lưu nháp"}
                </button>
                {step < 4 ? (
                  <button
                    className="rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-container)]"
                    onClick={goNext}
                    type="button"
                  >
                    Tiếp tục
                  </button>
                ) : (
                  <button
                    className="rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-container)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canSubmit || isSaving}
                    onClick={() => void submitProfile()}
                    type="button"
                  >
                    {isSaving ? "Đang gửi..." : "Gửi hồ sơ duyệt"}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function Stepper({
  progressWidth,
  setStep,
  step,
}: {
  progressWidth: string;
  setStep: (step: Step) => void;
  step: Step;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        {steps.map((item) => {
          const isActive = item.id === step;
          const isDone = item.id < step;

          return (
            <button
              className="flex flex-col items-center gap-2 text-xs font-medium"
              key={item.id}
              onClick={() => setStep(item.id)}
              type="button"
            >
              <span
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full border-4 border-[var(--surface)]",
                  isActive || isDone
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]",
                ].join(" ")}
              >
                {isDone ? "✓" : item.id}
              </span>
              <span className={isActive ? "text-[var(--primary)]" : "text-[var(--on-surface-variant)]"}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
        <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: progressWidth }} />
      </div>
    </div>
  );
}

function SubmittedState() {
  return (
    <section className="rounded-xl border border-[#57e5a9]/50 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#6ffbbe]/30 text-2xl text-[#004a31]">
        ✓
      </div>
      <h2 className="text-2xl font-bold text-[var(--on-surface)]">Hồ sơ đã được gửi duyệt</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--on-surface-variant)]">
        Đội ngũ admin sẽ xem xét hồ sơ trong vòng 48 giờ. Bạn sẽ nhận được email khi hồ sơ được duyệt hoặc cần bổ sung thông tin.
      </p>
      <Link
        className="mt-6 inline-flex rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white"
        href="/tutor/profile"
      >
        Xem trạng thái hồ sơ
      </Link>
    </section>
  );
}

function ProfileStep({
  avatarPreview,
  bio,
  city,
  district,
  experienceYears,
  headline,
  hourlyRate,
  setBio,
  setCity,
  setDistrict,
  setExperienceYears,
  setHeadline,
  setHourlyRate,
  setTeachingMode,
  teachingMode,
  updateAvatar,
}: {
  avatarPreview: string | null;
  bio: string;
  city: string;
  district: string;
  experienceYears: string;
  headline: string;
  hourlyRate: string;
  setBio: (value: string) => void;
  setCity: (value: string) => void;
  setDistrict: (value: string) => void;
  setExperienceYears: (value: string) => void;
  setHeadline: (value: string) => void;
  setHourlyRate: (value: string) => void;
  setTeachingMode: (value: TeachingMode) => void;
  teachingMode: TeachingMode;
  updateAvatar: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Thông tin cơ bản</h2>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          Thông tin này sẽ là phần đầu tiên học viên nhìn thấy khi xem hồ sơ của bạn.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-lg bg-[var(--surface-container-low)] p-5 sm:flex-row">
        <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[var(--outline-variant)] bg-white text-3xl text-[var(--outline)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">
          {avatarPreview ? (
            <img alt="Ảnh đại diện gia sư" className="h-full w-full object-cover" src={avatarPreview} />
          ) : (
            "+"
          )}
          <input accept="image/*" className="absolute inset-0 opacity-0" onChange={updateAvatar} type="file" />
        </label>
        <div className="text-center sm:text-left">
          <p className="font-semibold">Ảnh đại diện</p>
          <p className="text-sm text-[var(--on-surface-variant)]">Định dạng JPG, PNG. Dung lượng tối đa 5MB.</p>
        </div>
      </div>

      <InputField label="Tiêu đề hồ sơ" onChange={setHeadline} placeholder="VD: Gia sư Toán THPT chuyên luyện thi đại học" value={headline} />

      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Giới thiệu bản thân</span>
        <textarea
          className="min-h-32 w-full resize-y rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
          onChange={(event) => setBio(event.target.value)}
          placeholder="Chia sẻ về phương pháp giảng dạy, thành tích nổi bật của bạn..."
          value={bio}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <InputField label="Số năm kinh nghiệm" onChange={setExperienceYears} placeholder="0" type="number" value={experienceYears} />
        <InputField label="Giá theo giờ đề xuất" onChange={setHourlyRate} placeholder="200000" value={hourlyRate} />
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold">Hình thức dạy</p>
        <div className="flex flex-wrap gap-4">
          {[
            ["ONLINE", "Online"],
            ["OFFLINE", "Offline"],
            ["BOTH", "Cả hai"],
          ].map(([value, label]) => (
            <label className="flex cursor-pointer items-center gap-2" key={value}>
              <input
                checked={teachingMode === value}
                className="h-5 w-5 text-[var(--primary)]"
                name="teachingMode"
                onChange={() => setTeachingMode(value as TeachingMode)}
                type="radio"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Tỉnh/Thành phố</span>
          <select
            className="w-full rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            onChange={(event) => setCity(event.target.value)}
            value={city}
          >
            <option value="">Chọn Tỉnh/Thành phố</option>
            <option value="Hà Nội">Hà Nội</option>
            <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
            <option value="Đà Nẵng">Đà Nẵng</option>
          </select>
        </label>
        <InputField label="Quận/Huyện" onChange={setDistrict} placeholder="VD: Quận 1" value={district} />
      </div>
    </div>
  );
}

function SubjectsStep({
  addSubject,
  availableSubjects,
  level,
  removeSubject,
  setLevel,
  setSubjectId,
  subjectId,
  subjects,
}: {
  addSubject: () => void;
  availableSubjects: Subject[];
  level: SubjectLevel;
  removeSubject: (id: string) => void;
  setLevel: (value: SubjectLevel) => void;
  setSubjectId: (value: string) => void;
  subjectId: string;
  subjects: SelectedSubject[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Môn giảng dạy</h2>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          Chọn các môn học và trình độ bạn muốn giảng dạy. Bạn có thể thêm nhiều môn.
        </p>
      </div>

      <div className="space-y-5 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Chọn môn học</span>
            <select
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              onChange={(event) => setSubjectId(event.target.value)}
              value={subjectId}
            >
              {availableSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Trình độ giảng dạy</span>
            <select
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              onChange={(event) => setLevel(event.target.value as SubjectLevel)}
              value={level}
            >
              {Object.entries(subjectLevelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="rounded-lg bg-[var(--primary-container)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary)]"
          onClick={addSubject}
          type="button"
        >
          Thêm môn học
        </button>
      </div>

      <div>
        <h3 className="mb-3 text-xl font-semibold">Danh sách đã chọn</h3>
        {subjects.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {subjects.map((subject) => (
              <div
                className="flex items-start justify-between rounded-lg border border-[var(--outline-variant)] bg-white p-4 shadow-sm"
                key={subject.id}
              >
                <div>
                  <h4 className="text-lg font-semibold text-[var(--primary)]">{subject.name}</h4>
                  <span className="mt-2 inline-flex rounded bg-[var(--surface-container-high)] px-2 py-1 text-xs font-medium text-[var(--on-surface-variant)]">
                    {subjectLevelLabels[subject.level]}
                  </span>
                </div>
                <button
                  className="rounded-full px-2 py-1 text-[var(--outline)] transition hover:bg-[var(--error-container)] hover:text-[var(--error)]"
                  onClick={() => removeSubject(subject.id)}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">
            Chưa có môn học nào được chọn.
          </p>
        )}
      </div>
    </div>
  );
}

function DocumentsStep({
  clearDocument,
  documents,
  existingDocumentTypes,
  updateDocument,
}: {
  clearDocument: (key: DocumentKey) => void;
  documents: Record<DocumentKey, File | null>;
  existingDocumentTypes: Set<TutorDocumentType>;
  updateDocument: (key: DocumentKey, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--primary)]">Tài liệu xác minh</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
          Vui lòng tải lên các tài liệu cần thiết để chúng tôi xác minh hồ sơ của bạn. Tài liệu rõ nét sẽ giúp hồ sơ được duyệt nhanh hơn.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {(Object.keys(documentConfig) as DocumentKey[]).map((key) => {
          const config = documentConfig[key];
          const hasExisting = existingDocumentTypes.has(config.type);
          const file = documents[key];

          return (
            <label
              className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-6 text-center transition hover:bg-[var(--surface-container)]"
              key={key}
            >
              <span className="material-symbols-outlined mb-2 text-[40px] text-[var(--primary)]">description</span>
              <span className="font-semibold">
                {config.title}
                {config.required ? <span className="text-[var(--error)]"> *</span> : null}
              </span>
              <span className="mt-1 text-sm text-[var(--on-surface-variant)]">{config.description}</span>
              <span className="mt-3 text-sm font-semibold text-[var(--primary)] underline">
                {file ? file.name : hasExisting ? "Đã có tài liệu - chọn để thay" : "Chọn file"}
              </span>
              <input
                accept="image/*,.pdf"
                className="sr-only"
                onChange={(event) => updateDocument(key, event)}
                type="file"
              />
            </label>
          );
        })}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Tài liệu vừa chọn</h3>
        <div className="space-y-3">
          {(Object.keys(documentConfig) as DocumentKey[]).map((key) => {
            const file = documents[key];
            const hasExisting = existingDocumentTypes.has(documentConfig[key].type);

            if (!file && !hasExisting) {
              return null;
            }

            return (
              <div
                className="flex flex-col gap-3 rounded-lg border border-[var(--surface-container-highest)] bg-[var(--surface-container)] p-3 sm:flex-row sm:items-center sm:justify-between"
                key={key}
              >
                <div>
                  <p className="font-semibold">{file?.name || documentConfig[key].title}</p>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    {documentConfig[key].title} • {file ? "Sẵn sàng tải lên" : "Đã lưu trên hệ thống"}
                  </p>
                </div>
                {file ? (
                  <button
                    className="text-sm font-semibold text-[var(--error)] hover:underline"
                    onClick={() => clearDocument(key)}
                    type="button"
                  >
                    Xóa
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-sm font-medium text-[var(--secondary)]">
        Tài liệu rõ nét sẽ giúp hồ sơ được duyệt nhanh hơn.
      </p>
    </div>
  );
}

function ReviewStep({
  bio,
  canSubmit,
  city,
  confirmed,
  district,
  documents,
  experienceYears,
  headline,
  hourlyRate,
  profileComplete,
  requiredDocumentsUploaded,
  setConfirmed,
  setStep,
  subjectCount,
  teachingMode,
}: {
  bio: string;
  canSubmit: boolean;
  city: string;
  confirmed: boolean;
  district: string;
  documents: Record<DocumentKey, File | null>;
  experienceYears: string;
  headline: string;
  hourlyRate: string;
  profileComplete: boolean;
  requiredDocumentsUploaded: boolean;
  setConfirmed: (value: boolean) => void;
  setStep: (value: Step) => void;
  subjectCount: number;
  teachingMode: TeachingMode;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Kiểm tra và gửi duyệt</h2>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          Hồ sơ của bạn sẽ được admin xem xét trong vòng 48 giờ sau khi gửi.
        </p>
      </div>

      <div className="flex gap-4 rounded-lg border border-[var(--primary)]/20 bg-[var(--surface-container)] p-4">
        <span className="text-[var(--primary)]">i</span>
        <div>
          <h3 className="text-sm font-semibold text-[var(--primary)]">Sắp hoàn tất!</h3>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            Bạn sẽ nhận được email thông báo kết quả sau khi admin duyệt hồ sơ.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ReviewCard complete={profileComplete} onEdit={() => setStep(1)} title="Thông tin cơ bản">
          <p>Tiêu đề: {headline || "Chưa nhập"}</p>
          <p>Kinh nghiệm: {experienceYears || "0"} năm</p>
          <p>Giá: {hourlyRate || "Chưa nhập"} VND/giờ</p>
          <p>Hình thức: {teachingMode}</p>
          <p>Khu vực: {[district, city].filter(Boolean).join(", ") || "Chưa nhập"}</p>
          <p>Bio: {bio ? `${bio.slice(0, 72)}${bio.length > 72 ? "..." : ""}` : "Chưa nhập"}</p>
        </ReviewCard>

        <ReviewCard complete={subjectCount > 0} onEdit={() => setStep(2)} title="Môn học">
          <p>{subjectCount} môn đã được chọn.</p>
        </ReviewCard>

        <ReviewCard complete={requiredDocumentsUploaded} onEdit={() => setStep(3)} title="Tài liệu xác minh">
          <p>CCCD mặt trước: {documents.idFront ? "Sẵn sàng tải lên" : "Đã kiểm tra"}</p>
          <p>CCCD mặt sau: {documents.idBack ? "Sẵn sàng tải lên" : "Đã kiểm tra"}</p>
          <p>Bằng cấp: {documents.degree ? "Sẵn sàng tải lên" : "Đã kiểm tra"}</p>
          <p>Chứng chỉ: {documents.certificate ? "Sẵn sàng tải lên" : "Tùy chọn"}</p>
        </ReviewCard>

        <ReviewCard complete={canSubmit} onEdit={() => undefined} title="Điều kiện gửi duyệt">
          <p>{profileComplete ? "Đã hoàn tất thông tin hồ sơ." : "Thiếu thông tin hồ sơ."}</p>
          <p>{subjectCount > 0 ? "Đã chọn môn giảng dạy." : "Chưa chọn môn giảng dạy."}</p>
          <p>{requiredDocumentsUploaded ? "Đã tải đủ tài liệu bắt buộc." : "Chưa đủ tài liệu bắt buộc."}</p>
        </ReviewCard>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[var(--surface-container-low)] p-4 text-sm leading-6 text-[var(--on-surface-variant)]">
        <input
          checked={confirmed}
          className="mt-1 h-5 w-5 rounded text-[var(--primary)]"
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        <span>
          Tôi xác nhận rằng mọi thông tin cung cấp ở trên là chính xác và trung thực. Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của TutorConnect.
        </span>
      </label>
    </div>
  );
}

function ReviewCard({
  children,
  complete,
  onEdit,
  title,
}: {
  children: React.ReactNode;
  complete: boolean;
  onEdit: () => void;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--outline-variant)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="min-w-0 text-lg font-semibold">{title}</h3>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={[
              "rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
              complete ? "bg-[#6ffbbe]/30 text-[#004a31]" : "bg-[var(--error-container)] text-[var(--error)]",
            ].join(" ")}
          >
            {complete ? "Hoàn thành" : "Cần bổ sung"}
          </span>
          <button className="text-sm font-semibold text-[var(--primary)] hover:underline" onClick={onEdit} type="button">
            Chỉnh sửa
          </button>
        </div>
      </div>
      <div className="space-y-2 text-sm text-[var(--on-surface-variant)]">{children}</div>
    </div>
  );
}

function InputField({
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input
        className="w-full rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}
