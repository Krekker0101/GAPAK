CREATE TABLE IF NOT EXISTS domain_events (
    id UUID PRIMARY KEY,
    event_type VARCHAR(80) NOT NULL,
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_id UUID NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_user_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    sequence BIGINT,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    correlation_id VARCHAR(128),
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS domain_events_aggregate_sequence_idx ON domain_events(aggregate_type, aggregate_id, sequence DESC);
CREATE INDEX IF NOT EXISTS domain_events_actor_created_idx ON domain_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS domain_events_recipient_gin_idx ON domain_events USING GIN(recipient_user_ids);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(80);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES domain_events(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(255);
ALTER TABLE notifications ALTER COLUMN title SET DEFAULT '';
ALTER TABLE notifications ALTER COLUMN body SET DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key_idx
    ON notifications(user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_entity_idx ON notifications(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_event_idx ON notifications(event_id);
