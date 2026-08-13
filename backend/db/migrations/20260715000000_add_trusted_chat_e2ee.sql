-- Trusted Chat E2EE hardening
-- Adds device trust metadata, encrypted key envelopes, and plaintext removal for chat messages.

DO $$ BEGIN
    ALTER TYPE "EncryptionProtocol" ADD VALUE IF NOT EXISTS 'TRUSTED_CHAT';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

UPDATE chats
SET encryption_protocol = 'SIGNAL'
WHERE encryption_protocol = 'NONE';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chats_encryption_protocol_check' AND conrelid = 'chats'::regclass) THEN
        ALTER TABLE chats ADD CONSTRAINT chats_encryption_protocol_check CHECK (encryption_protocol <> 'NONE');
    END IF;
END $$;

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS sender_device_id UUID,
    ADD COLUMN IF NOT EXISTS encryption_algorithm VARCHAR(64) NOT NULL DEFAULT 'client-managed-aead',
    ADD COLUMN IF NOT EXISTS associated_data TEXT,
    ADD COLUMN IF NOT EXISTS ratchet_counter BIGINT;

ALTER TABLE message_versions
    ADD COLUMN IF NOT EXISTS encryption_algorithm VARCHAR(64) NOT NULL DEFAULT 'client-managed-aead',
    ADD COLUMN IF NOT EXISTS associated_data TEXT,
    ADD COLUMN IF NOT EXISTS ratchet_counter BIGINT;

UPDATE messages
SET content = NULL
WHERE content IS NOT NULL;

UPDATE message_versions
SET content = NULL
WHERE content IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_no_plaintext_content_check' AND conrelid = 'messages'::regclass) THEN
        ALTER TABLE messages ADD CONSTRAINT messages_no_plaintext_content_check CHECK (content IS NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_versions_no_plaintext_content_check' AND conrelid = 'message_versions'::regclass) THEN
        ALTER TABLE message_versions ADD CONSTRAINT message_versions_no_plaintext_content_check CHECK (content IS NULL);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS trusted_chat_devices (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    device_name VARCHAR(120),
    identity_key_public TEXT NOT NULL,
    signing_key_public TEXT,
    fingerprint VARCHAR(128) NOT NULL,
    trust_status VARCHAR(24) NOT NULL DEFAULT 'TRUSTED',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP(3),
    revoked_at TIMESTAMP(3),
    CONSTRAINT trusted_chat_devices_pkey PRIMARY KEY (id),
    CONSTRAINT trusted_chat_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT trusted_chat_devices_trust_status_check CHECK (trust_status IN ('TRUSTED', 'UNVERIFIED', 'REVOKED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS trusted_chat_devices_user_fingerprint_key
    ON trusted_chat_devices(user_id, fingerprint);

CREATE INDEX IF NOT EXISTS trusted_chat_devices_user_status_idx
    ON trusted_chat_devices(user_id, trust_status, created_at DESC);

CREATE TABLE IF NOT EXISTS trusted_chat_prekeys (
    id UUID NOT NULL,
    device_id UUID NOT NULL,
    user_id UUID NOT NULL,
    key_id VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,
    signature TEXT,
    one_time BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP(3),
    CONSTRAINT trusted_chat_prekeys_pkey PRIMARY KEY (id),
    CONSTRAINT trusted_chat_prekeys_device_id_fkey FOREIGN KEY (device_id) REFERENCES trusted_chat_devices(id) ON DELETE CASCADE,
    CONSTRAINT trusted_chat_prekeys_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT trusted_chat_prekeys_key_id_check CHECK (char_length(key_id) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS trusted_chat_prekeys_device_key_key
    ON trusted_chat_prekeys(device_id, key_id);

CREATE INDEX IF NOT EXISTS trusted_chat_prekeys_device_one_time_idx
    ON trusted_chat_prekeys(device_id, one_time, used_at, expires_at);

CREATE TABLE IF NOT EXISTS trusted_chat_message_key_envelopes (
    id UUID NOT NULL,
    message_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    recipient_device_id UUID NOT NULL,
    sender_device_id UUID,
    key_id VARCHAR(255) NOT NULL,
    algorithm VARCHAR(64) NOT NULL,
    encrypted_key TEXT NOT NULL,
    nonce VARCHAR(255),
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT trusted_chat_message_key_envelopes_pkey PRIMARY KEY (id),
    CONSTRAINT trusted_chat_message_key_envelopes_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT trusted_chat_message_key_envelopes_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT trusted_chat_message_key_envelopes_recipient_device_id_fkey FOREIGN KEY (recipient_device_id) REFERENCES trusted_chat_devices(id) ON DELETE CASCADE,
    CONSTRAINT trusted_chat_message_key_envelopes_sender_device_id_fkey FOREIGN KEY (sender_device_id) REFERENCES trusted_chat_devices(id) ON DELETE SET NULL,
    CONSTRAINT trusted_chat_message_key_envelopes_key_version_check CHECK (key_version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS trusted_chat_message_key_envelopes_message_device_key
    ON trusted_chat_message_key_envelopes(message_id, recipient_device_id);

CREATE INDEX IF NOT EXISTS trusted_chat_message_key_envelopes_recipient_idx
    ON trusted_chat_message_key_envelopes(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_client_message_id_idx
    ON messages(chat_id, client_message_id)
    WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_sender_device_id_idx
    ON messages(sender_device_id)
    WHERE sender_device_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_client_message_id_check' AND conrelid = 'messages'::regclass) THEN
        ALTER TABLE messages ADD CONSTRAINT messages_client_message_id_check CHECK (client_message_id IS NULL OR char_length(client_message_id) >= 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_device_id_fkey' AND conrelid = 'messages'::regclass) THEN
        ALTER TABLE messages ADD CONSTRAINT messages_sender_device_id_fkey FOREIGN KEY (sender_device_id) REFERENCES trusted_chat_devices(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_client_message_id_unique' AND conrelid = 'messages'::regclass) THEN
        ALTER TABLE messages ADD CONSTRAINT messages_client_message_id_unique UNIQUE (chat_id, client_message_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_key_envelope_required_check' AND conrelid = 'messages'::regclass) THEN
        ALTER TABLE messages ADD CONSTRAINT messages_key_envelope_required_check CHECK (encryption_protocol = 'NONE' OR ciphertext IS NOT NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_ratcheted_check' AND conrelid = 'messages'::regclass) THEN
        ALTER TABLE messages ADD CONSTRAINT messages_ratcheted_check CHECK (ratchet_counter IS NULL OR ratchet_counter >= 0);
    END IF;
END $$;

ALTER TABLE messages
    ALTER COLUMN status SET DEFAULT 'SENT';

