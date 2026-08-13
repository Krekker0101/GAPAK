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
    ON http_idempotency_records (expires_at);
