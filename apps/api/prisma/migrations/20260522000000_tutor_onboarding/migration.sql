CREATE TYPE "TutorVerificationStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "TeachingMode" AS ENUM (
  'ONLINE',
  'OFFLINE',
  'BOTH'
);

CREATE TYPE "SubjectLevel" AS ENUM (
  'BASIC',
  'INTERMEDIATE',
  'ADVANCED',
  'EXAM_PREP'
);

CREATE TYPE "TutorDocumentType" AS ENUM (
  'NATIONAL_ID_FRONT',
  'NATIONAL_ID_BACK',
  'DEGREE',
  'CERTIFICATE',
  'BACKGROUND_CHECK',
  'OTHER'
);

CREATE TYPE "TutorDocumentStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "AdminAuditAction" AS ENUM (
  'TUTOR_APPROVED',
  'TUTOR_REJECTED',
  'DOCUMENT_APPROVED',
  'DOCUMENT_REJECTED',
  'USER_SUSPENDED',
  'USER_UNSUSPENDED'
);

CREATE TABLE "tutor_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "headline" TEXT,
  "bio" TEXT,
  "intro_video_url" TEXT,
  "experience_years" INTEGER,
  "hourly_rate" DECIMAL(12,2),
  "teaching_mode" "TeachingMode" NOT NULL DEFAULT 'BOTH',
  "location_city" TEXT,
  "location_district" TEXT,
  "verification_status" "TutorVerificationStatus" NOT NULL DEFAULT 'DRAFT',
  "verification_submitted_at" TIMESTAMPTZ(6),
  "approved_at" TIMESTAMPTZ(6),
  "rejected_at" TIMESTAMPTZ(6),
  "rejection_reason" TEXT,
  "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
  "total_sessions" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "tutor_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subjects" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "category" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tutor_subjects" (
  "id" UUID NOT NULL,
  "tutor_profile_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "level" "SubjectLevel" NOT NULL DEFAULT 'BASIC',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tutor_subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tutor_documents" (
  "id" UUID NOT NULL,
  "tutor_profile_id" UUID NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "reviewed_by_id" UUID,
  "type" "TutorDocumentType" NOT NULL,
  "status" "TutorDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "file_name" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size_bytes" INTEGER NOT NULL,
  "rejection_reason" TEXT,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "tutor_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_audit_logs" (
  "id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "action" "AdminAuditAction" NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" UUID NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tutor_profiles_user_id_key" ON "tutor_profiles"("user_id");
CREATE INDEX "tutor_profiles_verification_status_idx" ON "tutor_profiles"("verification_status");
CREATE INDEX "tutor_profiles_location_city_location_district_idx" ON "tutor_profiles"("location_city", "location_district");

CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");
CREATE UNIQUE INDEX "subjects_slug_key" ON "subjects"("slug");

CREATE UNIQUE INDEX "tutor_subjects_tutor_profile_id_subject_id_level_key" ON "tutor_subjects"("tutor_profile_id", "subject_id", "level");
CREATE INDEX "tutor_subjects_subject_id_idx" ON "tutor_subjects"("subject_id");

CREATE INDEX "tutor_documents_tutor_profile_id_idx" ON "tutor_documents"("tutor_profile_id");
CREATE INDEX "tutor_documents_status_idx" ON "tutor_documents"("status");
CREATE INDEX "tutor_documents_type_idx" ON "tutor_documents"("type");

CREATE INDEX "admin_audit_logs_actor_id_idx" ON "admin_audit_logs"("actor_id");
CREATE INDEX "admin_audit_logs_resource_type_resource_id_idx" ON "admin_audit_logs"("resource_type", "resource_id");
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

ALTER TABLE "tutor_profiles"
  ADD CONSTRAINT "tutor_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tutor_subjects"
  ADD CONSTRAINT "tutor_subjects_tutor_profile_id_fkey"
  FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tutor_subjects"
  ADD CONSTRAINT "tutor_subjects_subject_id_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_documents"
  ADD CONSTRAINT "tutor_documents_tutor_profile_id_fkey"
  FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tutor_documents"
  ADD CONSTRAINT "tutor_documents_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_documents"
  ADD CONSTRAINT "tutor_documents_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_audit_logs"
  ADD CONSTRAINT "admin_audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "subjects" ("id", "name", "slug", "category", "updated_at")
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Toán học', 'toan-hoc', 'STEM', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000002', 'Vật lý', 'vat-ly', 'STEM', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000003', 'Hóa học', 'hoa-hoc', 'STEM', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000004', 'Sinh học', 'sinh-hoc', 'STEM', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000005', 'Tiếng Anh', 'tieng-anh', 'Ngoại ngữ', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000006', 'Ngữ văn', 'ngu-van', 'Xã hội', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000007', 'Lịch sử', 'lich-su', 'Xã hội', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000008', 'Địa lý', 'dia-ly', 'Xã hội', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
