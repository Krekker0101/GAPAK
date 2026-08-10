-- Durable chat realtime delivery.
-- Messages are persisted first; the worker later relays the outbox event to Redis.
-- Redis is never the source of truth. Reconnect recovery reads messages by sequence_number.

CREATE INDEX IF NOT EXISTS realtime_events_chat_sequence_idx
  ON realtime_events (aggregate_type, aggregate_id, sequence)
  WHERE aggregate_type = 'chat';

CREATE INDEX IF NOT EXISTS realtime_events_chat_pending_idx
  ON realtime_events (sequence, id)
  WHERE aggregate_type = 'chat' AND relay_status IN ('PENDING', 'FAILED');
