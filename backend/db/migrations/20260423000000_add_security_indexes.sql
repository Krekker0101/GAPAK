-- Indexes for performance and query optimization

-- users: account_status frequently filtered
CREATE INDEX IF NOT EXISTS "users_account_status_idx" ON "users"("account_status");

-- device_sessions: fast lookup of current session per user
CREATE INDEX IF NOT EXISTS "device_sessions_user_id_is_current_idx" ON "device_sessions"("user_id", "is_current") WHERE "is_current" = true;

-- messages: sender lookup for moderation/deletion
CREATE INDEX IF NOT EXISTS "messages_sender_id_sent_at_idx" ON "messages"("sender_id", "sent_at");

-- audit_events: cleanup by created_at
CREATE INDEX IF NOT EXISTS "audit_events_created_at_idx" ON "audit_events"("created_at");

-- TwoFactor setup challenges cleanup
CREATE INDEX IF NOT EXISTS "two_factor_setup_challenges_user_id_expires_at_idx" ON "two_factor_setup_challenges"("user_id", "expires_at");
