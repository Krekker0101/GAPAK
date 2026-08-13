-- Prevent intentional AES-GCM nonce reuse within the same sender device/key.
CREATE UNIQUE INDEX IF NOT EXISTS messages_sender_device_key_nonce_key
    ON messages (sender_device_id, sender_key_id, nonce)
    WHERE deleted_at IS NULL;
