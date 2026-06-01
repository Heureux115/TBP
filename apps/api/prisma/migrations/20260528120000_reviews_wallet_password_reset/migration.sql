-- Reviews
CREATE TABLE "reviews" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "tutor_profile_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");
CREATE INDEX "reviews_student_id_idx" ON "reviews"("student_id");
CREATE INDEX "reviews_tutor_profile_id_created_at_idx" ON "reviews"("tutor_profile_id", "created_at");

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "reviews_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "reviews_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);

-- Tutor wallet and withdrawal
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED');

CREATE TABLE "tutor_wallets" (
  "id" UUID NOT NULL,
  "tutor_profile_id" UUID NOT NULL,
  "available_balance" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "withdrawn_balance" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "tutor_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tutor_wallets_tutor_profile_id_key" ON "tutor_wallets"("tutor_profile_id");

ALTER TABLE "tutor_wallets"
  ADD CONSTRAINT "tutor_wallets_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "withdrawals" (
  "id" UUID NOT NULL,
  "wallet_id" UUID NOT NULL,
  "tutor_profile_id" UUID NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "bank_name" TEXT NOT NULL,
  "bank_account_number" TEXT NOT NULL,
  "bank_account_name" TEXT NOT NULL,
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(6),
  "rejection_reason" TEXT,
  CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "withdrawals_wallet_id_idx" ON "withdrawals"("wallet_id");
CREATE INDEX "withdrawals_tutor_profile_id_requested_at_idx" ON "withdrawals"("tutor_profile_id", "requested_at");
CREATE INDEX "withdrawals_status_idx" ON "withdrawals"("status");

ALTER TABLE "withdrawals"
  ADD CONSTRAINT "withdrawals_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "tutor_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "withdrawals_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "withdrawals_amount_check" CHECK ("amount" > 0);

-- Password reset tokens reuse hashed one-time tokens and expiry columns.
ALTER TABLE "users"
  ADD COLUMN "password_reset_token_hash" TEXT,
  ADD COLUMN "password_reset_token_expires_at" TIMESTAMPTZ(6);

CREATE INDEX "users_password_reset_token_hash_idx" ON "users"("password_reset_token_hash");
