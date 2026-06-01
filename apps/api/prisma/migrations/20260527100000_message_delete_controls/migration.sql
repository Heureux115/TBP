ALTER TABLE "conversation_participants"
  ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "message_deletions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "deleted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "message_deletions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_deletions_message_id_user_id_key" UNIQUE ("message_id", "user_id"),
  CONSTRAINT "message_deletions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "message_deletions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "message_deletions_user_id_idx" ON "message_deletions"("user_id");
