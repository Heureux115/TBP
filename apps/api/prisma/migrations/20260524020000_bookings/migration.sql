CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

CREATE TABLE "bookings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "tutor_profile_id" UUID NOT NULL,
  "availability_slot_id" UUID NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "student_note" TEXT,
  "cancellation_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_availability_slot_id_key" UNIQUE ("availability_slot_id"),
  CONSTRAINT "bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bookings_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bookings_availability_slot_id_fkey" FOREIGN KEY ("availability_slot_id") REFERENCES "availability_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "bookings_student_id_starts_at_idx" ON "bookings"("student_id", "starts_at");
CREATE INDEX "bookings_tutor_profile_id_starts_at_idx" ON "bookings"("tutor_profile_id", "starts_at");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
