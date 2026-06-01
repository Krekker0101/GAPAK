CREATE TABLE IF NOT EXISTS "site_pages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "locale" VARCHAR(8) NOT NULL DEFAULT 'en',
    "title" VARCHAR(160) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "content_json" JSONB NOT NULL DEFAULT '{"blocks":[]}'::jsonb,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" UUID,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_pages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "site_pages_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT "site_pages_slug_locale_key" UNIQUE ("slug", "locale")
);

CREATE TABLE IF NOT EXISTS "site_page_revisions" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "content_json" JSONB NOT NULL,
    "edited_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_page_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "site_page_revisions_page_version_key" UNIQUE ("page_id", "version")
);

CREATE INDEX IF NOT EXISTS "site_pages_status_updated_at_idx" ON "site_pages"("status", "updated_at");
CREATE INDEX IF NOT EXISTS "site_pages_locale_updated_at_idx" ON "site_pages"("locale", "updated_at");
CREATE INDEX IF NOT EXISTS "site_page_revisions_page_id_created_at_idx" ON "site_page_revisions"("page_id", "created_at");

ALTER TABLE "site_pages"
  ADD CONSTRAINT "site_pages_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "site_page_revisions"
  ADD CONSTRAINT "site_page_revisions_page_id_fkey"
  FOREIGN KEY ("page_id") REFERENCES "site_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_page_revisions"
  ADD CONSTRAINT "site_page_revisions_edited_by_fkey"
  FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
