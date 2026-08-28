-- Ordinary direct conversations must work before the peer has registered an
-- E2EE device. Group/channel chats retain the enforced TRUSTED_CHAT protocol.

ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_encryption_protocol_check;

UPDATE chats
SET encryption_protocol = 'NONE', updated_at = NOW()
WHERE type = 'DIRECT';

ALTER TABLE chats
    ADD CONSTRAINT chats_encryption_protocol_check CHECK (
        (type = 'DIRECT' AND encryption_protocol IN ('NONE', 'TRUSTED_CHAT'))
        OR (type <> 'DIRECT' AND encryption_protocol = 'TRUSTED_CHAT')
    );

ALTER TABLE chats
    ALTER COLUMN encryption_protocol SET DEFAULT 'TRUSTED_CHAT';
