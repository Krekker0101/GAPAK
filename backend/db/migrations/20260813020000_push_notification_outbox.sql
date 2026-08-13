CREATE TABLE IF NOT EXISTS push_device_subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(128) NOT NULL,
    platform VARCHAR(32) NOT NULL,
    provider VARCHAR(16) NOT NULL,
    endpoint TEXT,
    credential_ciphertext TEXT,
    credential_nonce TEXT,
    public_key TEXT,
    credential_hash CHAR(64) NOT NULL,
    expiration_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    CONSTRAINT push_device_provider_chk CHECK (provider IN ('webpush','fcm','apns')),
    CONSTRAINT push_device_platform_chk CHECK (platform IN ('web','android','ios','macos','windows','unknown')),
    CONSTRAINT push_device_endpoint_or_token_chk CHECK (
        endpoint IS NOT NULL OR credential_ciphertext IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS push_device_active_credential_uq
    ON push_device_subscriptions(user_id, provider, credential_hash)
    WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS push_device_user_idx
    ON push_device_subscriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS push_device_active_expiration_idx
    ON push_device_subscriptions(expiration_at)
    WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS push_outbox (
    id UUID PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES push_device_subscriptions(id) ON DELETE CASCADE,
    provider VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 8,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    lock_token UUID,
    last_error TEXT,
    provider_message_id TEXT,
    delivered_at TIMESTAMPTZ,
    dead_lettered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT push_outbox_provider_chk CHECK (provider IN ('webpush','fcm','apns')),
    CONSTRAINT push_outbox_status_chk CHECK (status IN ('PENDING','PROCESSING','DELIVERED','DEAD')),
    CONSTRAINT push_outbox_attempts_chk CHECK (attempts >= 0 AND max_attempts > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS push_outbox_notification_subscription_uq
    ON push_outbox(notification_id, subscription_id);
CREATE INDEX IF NOT EXISTS push_outbox_ready_idx
    ON push_outbox(status, available_at, created_at)
    WHERE status IN ('PENDING','PROCESSING');
CREATE INDEX IF NOT EXISTS push_outbox_subscription_idx
    ON push_outbox(subscription_id, status, created_at DESC);

-- Convert orphaned/legacy null values deterministically where columns were added to existing DBs.
UPDATE push_device_subscriptions SET updated_at = COALESCE(updated_at, created_at, NOW()) WHERE updated_at IS NULL;
UPDATE push_outbox SET updated_at = COALESCE(updated_at, created_at, NOW()) WHERE updated_at IS NULL;
