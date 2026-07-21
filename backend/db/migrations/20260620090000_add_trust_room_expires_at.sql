ALTER TABLE "trust_rooms"
ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "trust_rooms_expires_at_idx"
ON "trust_rooms"("expires_at");
