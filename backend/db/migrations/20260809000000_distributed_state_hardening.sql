-- Distributed-state hardening for GAPAK.
-- This migration only adds invariants/indexes/lease metadata; it does not rewrite data.

-- ---------------------------------------------------------------------------
-- Data invariants: counters, limits, timestamps.
-- ---------------------------------------------------------------------------
ALTER TABLE post_audience_grants
  ADD CONSTRAINT post_audience_grants_views_nonnegative_check
  CHECK (used_views >= 0 AND (max_views IS NULL OR max_views >= 0));

ALTER TABLE story_audience_grants
  ADD CONSTRAINT story_audience_grants_views_nonnegative_check
  CHECK (used_views >= 0 AND (max_views IS NULL OR max_views >= 0));

ALTER TABLE playback_access_grants
  ADD CONSTRAINT playback_access_grants_views_nonnegative_check
  CHECK (used_views >= 0 AND (max_views IS NULL OR max_views >= 0));

ALTER TABLE processing_jobs
  ADD CONSTRAINT processing_jobs_attempts_check
  CHECK (attempts >= 0 AND max_attempts > 0 AND attempts <= max_attempts);

-- ---------------------------------------------------------------------------
-- Undirected friendship invariant: at most one live connection per pair.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX friend_connections_live_pair_key
  ON friend_connections (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))
  WHERE deleted_at IS NULL;

ALTER TABLE friend_connections
  ADD CONSTRAINT friend_connections_no_self_check
  CHECK (requester_id <> addressee_id);

CREATE UNIQUE INDEX trusted_circle_memberships_owner_member_key
  ON trusted_circle_memberships (owner_id, member_id);

ALTER TABLE trusted_circle_memberships
  ADD CONSTRAINT trusted_circle_memberships_no_self_check
  CHECK (owner_id <> member_id);

-- ---------------------------------------------------------------------------
-- Hot-path indexes. Partial indexes avoid carrying dead rows forever.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS device_sessions_user_active_idx
  ON device_sessions (user_id, last_used_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS password_reset_tokens_active_idx
  ON password_reset_tokens (token_hash)
  WHERE used_at IS NULL;



CREATE INDEX IF NOT EXISTS playback_access_grants_viewer_status_idx
  ON playback_access_grants (viewer_user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS processing_jobs_claim_idx
  ON processing_jobs (queue_name, created_at, id)
  WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS processing_jobs_stale_reserved_idx
  ON processing_jobs (queue_name, reserved_at, id)
  WHERE status = 'RESERVED';

CREATE INDEX IF NOT EXISTS realtime_events_pending_idx
  ON realtime_events (sequence, id)
  WHERE relay_status IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS realtime_events_stale_reserved_idx
  ON realtime_events (reserved_at, sequence, id)
  WHERE relay_status = 'RESERVED';

CREATE INDEX IF NOT EXISTS chat_members_user_active_chat_idx
  ON chat_members (user_id, chat_id)
  WHERE deleted_at IS NULL AND left_at IS NULL;

CREATE INDEX IF NOT EXISTS messages_chat_sequence_desc_idx
  ON messages (chat_id, sequence_number DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS subscriptions_creator_active_cursor_idx
  ON subscriptions (creator_id, subscribed_at DESC, id DESC)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS subscriptions_subscriber_active_cursor_idx
  ON subscriptions (subscriber_id, subscribed_at DESC, id DESC)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS friend_connections_requester_updated_cursor_idx
  ON friend_connections (requester_id, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS friend_connections_addressee_updated_cursor_idx
  ON friend_connections (addressee_id, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Durable worker leases.
-- A lease token prevents a stale worker from completing a job after another
-- worker has reclaimed it. next_attempt_at provides DB-side exponential backoff.
-- ---------------------------------------------------------------------------
ALTER TABLE processing_jobs
  ADD COLUMN lease_token UUID,
  ADD COLUMN next_attempt_at TIMESTAMP(3);

CREATE INDEX processing_jobs_retry_ready_idx
  ON processing_jobs (queue_name, next_attempt_at, created_at, id)
  WHERE status IN ('PENDING', 'FAILED');

-- Realtime relay uses the same fencing-token concept.
ALTER TABLE realtime_events
  ADD COLUMN relay_lease_token UUID;

CREATE INDEX realtime_events_lease_idx
  ON realtime_events (relay_status, reserved_at, relay_lease_token);

-- ---------------------------------------------------------------------------
-- Explicit notification indexes when the optional notifications table exists.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS notifications_user_created_cursor_idx ON notifications (user_id, created_at DESC, id DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, created_at DESC, id DESC) WHERE is_read = FALSE';
  END IF;
END $$;

-- Client message IDs are idempotency keys and must be scoped to the sender.
-- A chat-wide key allowed one user to pre-claim another user's client ID.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_client_message_id_unique;
CREATE UNIQUE INDEX messages_sender_client_message_id_key
  ON messages (chat_id, sender_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
