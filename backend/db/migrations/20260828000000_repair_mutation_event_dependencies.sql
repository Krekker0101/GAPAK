-- Repair transactional dependencies used before and after trusted-device
-- registration. This has a separate version so it executes even on a database
-- where the earlier E2EE repair migration was already recorded.

CREATE TABLE IF NOT EXISTS http_idempotency_records (
    id UUID PRIMARY KEY,
    identity_key TEXT NOT NULL,
    method VARCHAR(16) NOT NULL,
    path TEXT NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    status INTEGER,
    content_type TEXT,
    headers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    body_b64 TEXT NOT NULL DEFAULT '',
    state VARCHAR(16) NOT NULL CHECK (state IN ('INFLIGHT', 'DONE')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(identity_key, method, path, idempotency_key)
);

CREATE INDEX IF NOT EXISTS http_idempotency_expiry_idx
    ON http_idempotency_records(expires_at);

CREATE SEQUENCE IF NOT EXISTS domain_events_revision_seq;

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revision BIGINT NOT NULL DEFAULT nextval('domain_events_revision_seq')
);

ALTER TABLE domain_events
    ADD COLUMN IF NOT EXISTS revision BIGINT DEFAULT nextval('domain_events_revision_seq');

UPDATE domain_events
SET revision = nextval('domain_events_revision_seq')
WHERE revision IS NULL;

ALTER TABLE domain_events
    ALTER COLUMN revision SET DEFAULT nextval('domain_events_revision_seq'),
    ALTER COLUMN revision SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS domain_events_revision_key
    ON domain_events(revision);
