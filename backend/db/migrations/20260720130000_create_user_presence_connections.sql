-- Migration: Create user_presence_connections table
-- Purpose: Store active presence connections for online/last-seen tracking.
-- This table is referenced by internal/modules/presence/repository.go and
-- internal/modules/admin/repository.go but was missing from the initial schema.

CREATE TABLE IF NOT EXISTS "user_presence_connections" (
    "connection_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "state" VARCHAR(20) NOT NULL,
    "page_path" VARCHAR(320),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_presence_connections_pkey" PRIMARY KEY ("connection_id"),
    CONSTRAINT "user_presence_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_presence_connections_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "device_sessions"("id") ON DELETE CASCADE,
    CONSTRAINT "user_presence_connections_state_check" CHECK ("state" IN ('ACTIVE', 'IDLE', 'DISCONNECTED'))
);

CREATE INDEX IF NOT EXISTS "user_presence_connections_user_id_idx" ON "user_presence_connections"("user_id");
CREATE INDEX IF NOT EXISTS "user_presence_connections_session_id_idx" ON "user_presence_connections"("session_id");
CREATE INDEX IF NOT EXISTS "user_presence_connections_state_idx" ON "user_presence_connections"("state");
CREATE INDEX IF NOT EXISTS "user_presence_connections_last_heartbeat_at_idx" ON "user_presence_connections"("last_heartbeat_at");
CREATE INDEX IF NOT EXISTS "user_presence_connections_disconnected_at_idx" ON "user_presence_connections"("disconnected_at");
