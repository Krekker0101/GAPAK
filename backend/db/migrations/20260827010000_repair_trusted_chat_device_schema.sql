-- Repair deployments where the original trusted-chat migration was recorded
-- before all E2EE device tables/columns reached the live schema. Every change
-- is idempotent so the migration is safe for already-correct databases too.

CREATE TABLE IF NOT EXISTS trusted_chat_devices (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(120),
    identity_key_public TEXT NOT NULL,
    signing_key_public TEXT,
    fingerprint VARCHAR(128) NOT NULL,
    trust_status VARCHAR(24) NOT NULL DEFAULT 'TRUSTED',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP(3),
    revoked_at TIMESTAMP(3)
);

ALTER TABLE trusted_chat_devices
    ADD COLUMN IF NOT EXISTS device_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS identity_key_public TEXT,
    ADD COLUMN IF NOT EXISTS signing_key_public TEXT,
    ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(128),
    ADD COLUMN IF NOT EXISTS trust_status VARCHAR(24) NOT NULL DEFAULT 'TRUSTED',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS trusted_chat_devices_user_fingerprint_key
    ON trusted_chat_devices(user_id, fingerprint);

CREATE INDEX IF NOT EXISTS trusted_chat_devices_user_status_idx
    ON trusted_chat_devices(user_id, trust_status, created_at DESC);

CREATE TABLE IF NOT EXISTS trusted_chat_prekeys (
    id UUID PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES trusted_chat_devices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,
    signature TEXT,
    one_time BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP(3)
);

ALTER TABLE trusted_chat_prekeys
    ADD COLUMN IF NOT EXISTS signature TEXT,
    ADD COLUMN IF NOT EXISTS one_time BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS used_at TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS trusted_chat_prekeys_device_key_key
    ON trusted_chat_prekeys(device_id, key_id);

CREATE INDEX IF NOT EXISTS trusted_chat_prekeys_device_one_time_idx
    ON trusted_chat_prekeys(device_id, one_time, used_at, expires_at);

CREATE TABLE IF NOT EXISTS trusted_chat_message_key_envelopes (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_device_id UUID NOT NULL REFERENCES trusted_chat_devices(id) ON DELETE CASCADE,
    sender_device_id UUID REFERENCES trusted_chat_devices(id) ON DELETE SET NULL,
    key_id VARCHAR(255) NOT NULL,
    algorithm VARCHAR(64) NOT NULL,
    encrypted_key TEXT NOT NULL,
    nonce VARCHAR(255),
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE trusted_chat_message_key_envelopes
    ADD COLUMN IF NOT EXISTS sender_device_id UUID REFERENCES trusted_chat_devices(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS nonce VARCHAR(255),
    ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS trusted_chat_message_key_envelopes_message_device_key
    ON trusted_chat_message_key_envelopes(message_id, recipient_device_id);

CREATE INDEX IF NOT EXISTS trusted_chat_message_key_envelopes_recipient_idx
    ON trusted_chat_message_key_envelopes(recipient_id, created_at DESC);

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS sender_device_id UUID,
    ADD COLUMN IF NOT EXISTS encryption_algorithm VARCHAR(64) NOT NULL DEFAULT 'client-managed-aead',
    ADD COLUMN IF NOT EXISTS associated_data TEXT,
    ADD COLUMN IF NOT EXISTS ratchet_counter BIGINT;

CREATE INDEX IF NOT EXISTS messages_client_message_id_idx
    ON messages(chat_id, client_message_id)
    WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_sender_device_id_idx
    ON messages(sender_device_id)
    WHERE sender_device_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'messages_sender_device_id_fkey' AND conrelid = 'messages'::regclass
    ) THEN
        ALTER TABLE messages
            ADD CONSTRAINT messages_sender_device_id_fkey
            FOREIGN KEY (sender_device_id) REFERENCES trusted_chat_devices(id) ON DELETE SET NULL;
    END IF;
END $$;
