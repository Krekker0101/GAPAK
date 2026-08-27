-- Align durable chat metadata with the only message protocol implemented by
-- the application. Legacy message rows retain their original protocol value;
-- only the owning chat and newly-created messages use TRUSTED_CHAT.

UPDATE chats
SET encryption_protocol = 'TRUSTED_CHAT', updated_at = NOW()
WHERE encryption_protocol <> 'TRUSTED_CHAT';

ALTER TABLE chats
    ALTER COLUMN encryption_protocol SET DEFAULT 'TRUSTED_CHAT';

ALTER TABLE chats
    DROP CONSTRAINT IF EXISTS chats_encryption_protocol_check;

ALTER TABLE chats
    ADD CONSTRAINT chats_encryption_protocol_check
    CHECK (encryption_protocol = 'TRUSTED_CHAT');

ALTER TABLE messages
    ALTER COLUMN encryption_protocol SET DEFAULT 'TRUSTED_CHAT';
