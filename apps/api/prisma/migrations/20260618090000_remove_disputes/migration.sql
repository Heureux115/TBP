-- Remove dispute-owned operational history before narrowing shared enums.
DELETE FROM "notifications"
WHERE "type"::text = 'DISPUTE_UPDATED';

DELETE FROM "admin_audit_logs"
WHERE "resource_type" = 'dispute'
   OR "action"::text IN (
     'DISPUTE_UNDER_REVIEW',
     'DISPUTE_RESOLVED_REFUNDED',
     'DISPUTE_REJECTED'
   );

-- Remove dispute data and its dedicated enum.
DROP TABLE "dispute_attachments";
DROP TABLE "dispute_messages";
DROP TABLE "disputes";
DROP TYPE "DisputeStatus";

-- PostgreSQL enum values cannot be removed in place. Recreate the shared
-- notification enum without the dispute-only value.
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";

CREATE TYPE "NotificationType" AS ENUM (
  'BOOKING_REQUESTED',
  'BOOKING_CONFIRMED',
  'PAYMENT_PAID',
  'BOOKING_CANCELLED',
  'BOOKING_COMPLETED',
  'WITHDRAWAL_UPDATED'
);

ALTER TABLE "notifications"
  ALTER COLUMN "type" TYPE "NotificationType"
  USING ("type"::text::"NotificationType");

DROP TYPE "NotificationType_old";

-- Preserve payment refund and withdrawal audit actions while removing
-- dispute-only actions.
ALTER TYPE "AdminAuditAction" RENAME TO "AdminAuditAction_old";

CREATE TYPE "AdminAuditAction" AS ENUM (
  'TUTOR_APPROVED',
  'TUTOR_REJECTED',
  'DOCUMENT_APPROVED',
  'DOCUMENT_REJECTED',
  'USER_SUSPENDED',
  'USER_UNSUSPENDED',
  'PAYMENT_REFUNDED',
  'WITHDRAWAL_PROCESSING',
  'WITHDRAWAL_PAID',
  'WITHDRAWAL_REJECTED'
);

ALTER TABLE "admin_audit_logs"
  ALTER COLUMN "action" TYPE "AdminAuditAction"
  USING ("action"::text::"AdminAuditAction");

DROP TYPE "AdminAuditAction_old";
