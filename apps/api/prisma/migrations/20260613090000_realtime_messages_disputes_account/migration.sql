-- Shared profile avatar.
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;

-- Chat attachments.
CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'DOCUMENT');

CREATE TABLE "message_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "kind" "AttachmentKind" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");
CREATE INDEX "message_attachments_uploaded_by_id_idx" ON "message_attachments"("uploaded_by_id");

ALTER TABLE "message_attachments"
  ADD CONSTRAINT "message_attachments_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_attachments"
  ADD CONSTRAINT "message_attachments_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dispute timeline and evidence.
CREATE TABLE "dispute_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dispute_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dispute_messages_dispute_id_created_at_idx" ON "dispute_messages"("dispute_id", "created_at");
CREATE INDEX "dispute_messages_author_id_idx" ON "dispute_messages"("author_id");

ALTER TABLE "dispute_messages"
  ADD CONSTRAINT "dispute_messages_dispute_id_fkey"
  FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dispute_messages"
  ADD CONSTRAINT "dispute_messages_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "dispute_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dispute_message_id" UUID NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "kind" "AttachmentKind" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispute_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dispute_attachments_dispute_message_id_idx" ON "dispute_attachments"("dispute_message_id");
CREATE INDEX "dispute_attachments_uploaded_by_id_idx" ON "dispute_attachments"("uploaded_by_id");

ALTER TABLE "dispute_attachments"
  ADD CONSTRAINT "dispute_attachments_dispute_message_id_fkey"
  FOREIGN KEY ("dispute_message_id") REFERENCES "dispute_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dispute_attachments"
  ADD CONSTRAINT "dispute_attachments_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
