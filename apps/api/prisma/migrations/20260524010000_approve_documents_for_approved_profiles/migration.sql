UPDATE "tutor_documents"
SET
  "status" = 'APPROVED',
  "reviewed_at" = NOW(),
  "rejection_reason" = NULL
WHERE
  "deleted_at" IS NULL
  AND "status" = 'PENDING'
  AND "tutor_profile_id" IN (
    SELECT "id"
    FROM "tutor_profiles"
    WHERE "deleted_at" IS NULL
      AND "verification_status" = 'APPROVED'
  );
