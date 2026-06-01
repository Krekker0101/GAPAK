ALTER TYPE "UploadPurpose" ADD VALUE IF NOT EXISTS 'CLIP';

ALTER TABLE "posts"
  ADD COLUMN IF NOT EXISTS "content_type" VARCHAR(16) NOT NULL DEFAULT 'POST';

ALTER TABLE "posts"
  DROP CONSTRAINT IF EXISTS "posts_content_type_check";

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_content_type_check" CHECK ("content_type" IN ('POST', 'CLIP'));

CREATE INDEX IF NOT EXISTS "posts_content_type_published_at_idx" ON "posts"("content_type", "published_at");
CREATE INDEX IF NOT EXISTS "post_media_attachments_media_file_id_idx" ON "post_media_attachments"("media_file_id");
