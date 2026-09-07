-- Direct chats may use the NONE protocol and persist ordinary message text.
-- The earlier E2EE hardening constraint rejected content for every protocol,
-- which made valid direct-message inserts fail with SQLSTATE 23514.

ALTER TABLE messages
    DROP CONSTRAINT IF EXISTS messages_no_plaintext_content_check;

ALTER TABLE messages
    ADD CONSTRAINT messages_no_plaintext_content_check
    CHECK (encryption_protocol = 'NONE' OR content IS NULL);

-- Message versions copy the already-persisted previous message state; they do
-- not accept arbitrary historical content from the client. Keep a bounded
-- content check under the legacy constraint name so schema reconciliation also
-- replaces the old unconditional content-is-null definition in live databases.
ALTER TABLE message_versions
    DROP CONSTRAINT IF EXISTS message_versions_no_plaintext_content_check;

ALTER TABLE message_versions
    ADD CONSTRAINT message_versions_no_plaintext_content_check
    CHECK (content IS NULL OR char_length(content) <= 50000);
