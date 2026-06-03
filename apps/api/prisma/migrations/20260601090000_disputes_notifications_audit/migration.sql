-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'BOOKING_REQUESTED',
  'BOOKING_CONFIRMED',
  'PAYMENT_PAID',
  'BOOKING_CANCELLED',
  'BOOKING_COMPLETED',
  'WITHDRAWAL_UPDATED',
  'DISPUTE_UPDATED'
);

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM (
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED_REFUNDED',
  'REJECTED'
);

-- AlterEnum
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_REFUNDED';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_PROCESSING';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_PAID';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_REJECTED';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'DISPUTE_UNDER_REVIEW';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'DISPUTE_RESOLVED_REFUNDED';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'DISPUTE_REJECTED';

-- CreateTable
CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "action_url" TEXT,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "booking_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "opened_by_id" UUID NOT NULL,
  "resolved_by_id" UUID,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "reason" TEXT NOT NULL,
  "admin_note" TEXT,
  "resolution" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "resolved_at" TIMESTAMPTZ(6),

  CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");
CREATE INDEX "notifications_type_idx" ON "notifications"("type");
CREATE INDEX "disputes_booking_id_idx" ON "disputes"("booking_id");
CREATE INDEX "disputes_payment_id_idx" ON "disputes"("payment_id");
CREATE INDEX "disputes_opened_by_id_idx" ON "disputes"("opened_by_id");
CREATE INDEX "disputes_status_created_at_idx" ON "disputes"("status", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
