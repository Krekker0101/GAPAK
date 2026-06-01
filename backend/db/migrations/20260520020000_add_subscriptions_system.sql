-- Add subscription type enum
CREATE TYPE "SubscriptionType" AS ENUM ('VISIBLE', 'SILENT');

-- Subscription status enum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED');

-- Create subscriptions table (follow/subscribe system)
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscription_type" "SubscriptionType" NOT NULL DEFAULT 'VISIBLE',
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscriptions_subscriber_creator_unique" UNIQUE ("subscriber_id", "creator_id"),
    CONSTRAINT "subscriptions_no_self_subscribe" CHECK ("subscriber_id" != "creator_id")
);

-- Create subscription requests table (for pending subscriptions to private accounts)
CREATE TABLE "subscription_requests" (
    "id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(500),
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_requests_subscriber_creator_unique" UNIQUE ("subscriber_id", "creator_id"),
    CONSTRAINT "subscription_requests_no_self_request" CHECK ("subscriber_id" != "creator_id")
);

-- Create subscription blocklist table
CREATE TABLE "subscription_blocklist" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "blocked_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_blocklist_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_blocklist_user_blocked_unique" UNIQUE ("user_id", "blocked_user_id"),
    CONSTRAINT "subscription_blocklist_no_self_block" CHECK ("user_id" != "blocked_user_id")
);

-- Create subscription notification preferences table
CREATE TABLE "subscription_notification_preferences" (
    "subscriber_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "notify_on_post" BOOLEAN DEFAULT true,
    "notify_on_story" BOOLEAN DEFAULT true,
    "notify_on_live" BOOLEAN DEFAULT true,
    "notify_on_clip" BOOLEAN DEFAULT true,
    "mute_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_notification_preferences_pkey" PRIMARY KEY ("subscriber_id", "creator_id"),
    CONSTRAINT "sub_notif_pref_no_self" CHECK ("subscriber_id" != "creator_id")
);

-- Indexes for subscriptions table
CREATE INDEX "subscriptions_subscriber_id_status_idx" ON "subscriptions"("subscriber_id", "status");
CREATE INDEX "subscriptions_creator_id_status_idx" ON "subscriptions"("creator_id", "status");
CREATE INDEX "subscriptions_subscriber_id_subscription_type_idx" ON "subscriptions"("subscriber_id", "subscription_type");
CREATE INDEX "subscriptions_creator_id_created_at_idx" ON "subscriptions"("creator_id", "created_at");
CREATE INDEX "subscriptions_subscribed_at_idx" ON "subscriptions"("subscribed_at");

-- Indexes for subscription requests
CREATE INDEX "subscription_requests_subscriber_id_status_idx" ON "subscription_requests"("subscriber_id", "status");
CREATE INDEX "subscription_requests_creator_id_status_idx" ON "subscription_requests"("creator_id", "status");
CREATE INDEX "subscription_requests_requested_at_idx" ON "subscription_requests"("requested_at");

-- Indexes for blocklist
CREATE INDEX "subscription_blocklist_user_id_idx" ON "subscription_blocklist"("user_id");
CREATE INDEX "subscription_blocklist_blocked_user_id_idx" ON "subscription_blocklist"("blocked_user_id");

-- Indexes for notification preferences
CREATE INDEX "subscription_notification_preferences_subscriber_id_idx" ON "subscription_notification_preferences"("subscriber_id");
CREATE INDEX "subscription_notification_preferences_mute_until_idx" ON "subscription_notification_preferences"("mute_until");

-- Add foreign keys
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "subscription_blocklist" ADD CONSTRAINT "subscription_blocklist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "subscription_blocklist" ADD CONSTRAINT "subscription_blocklist_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "subscription_notification_preferences" ADD CONSTRAINT "subscription_notification_preferences_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "subscription_notification_preferences" ADD CONSTRAINT "subscription_notification_preferences_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "user_account_settings" ADD CONSTRAINT "user_account_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
