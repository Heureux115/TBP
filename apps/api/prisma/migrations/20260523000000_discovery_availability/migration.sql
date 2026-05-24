CREATE TABLE "availability_slots" (
  "id" UUID NOT NULL,
  "tutor_profile_id" UUID NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "is_booked" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "availability_slots_tutor_profile_id_starts_at_idx"
  ON "availability_slots"("tutor_profile_id", "starts_at");

CREATE INDEX "availability_slots_starts_at_ends_at_idx"
  ON "availability_slots"("starts_at", "ends_at");

ALTER TABLE "availability_slots"
  ADD CONSTRAINT "availability_slots_tutor_profile_id_fkey"
  FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
