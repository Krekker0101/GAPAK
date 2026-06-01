-- Add account types enum
CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'CHANNEL');

-- Add account_type column to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "account_type" "AccountType" NOT NULL DEFAULT 'PERSONAL';

-- Create user account type settings table for type-specific configurations
CREATE TABLE "user_account_settings" (
    "user_id" UUID NOT NULL,
    "account_type" "AccountType" NOT NULL DEFAULT 'PERSONAL',
    
    -- Common settings
    "bio" VARCHAR(600),
    "header_image_file_id" UUID,
    "theme" VARCHAR(32) DEFAULT 'light',
    
    -- Personal account specific
    "allow_close_friends" BOOLEAN DEFAULT true,
    "show_story_ring" BOOLEAN DEFAULT true,
    "allow_followers_see_follower_count" BOOLEAN DEFAULT true,
    
    -- Channel account specific
    "channel_category" VARCHAR(80),
    "channel_description" VARCHAR(2000),
    "channel_verification_status" VARCHAR(32) DEFAULT 'UNVERIFIED',
    "channel_featured_post_id" UUID,
    "disable_comments" BOOLEAN DEFAULT false,
    "disable_sharing" BOOLEAN DEFAULT false,
    "allow_downloads" BOOLEAN DEFAULT true,
    "monetization_enabled" BOOLEAN DEFAULT false,
    
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_account_settings_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "user_account_settings_account_type_check" CHECK ("account_type" IN ('PERSONAL', 'CHANNEL'))
);

-- Create unique index on account settings
CREATE UNIQUE INDEX "user_account_settings_user_id_idx" ON "user_account_settings"("user_id");

-- Add index for account type queries
CREATE INDEX "users_account_type_idx" ON "users"("account_type");
CREATE INDEX "users_account_type_created_at_idx" ON "users"("account_type", "created_at");
