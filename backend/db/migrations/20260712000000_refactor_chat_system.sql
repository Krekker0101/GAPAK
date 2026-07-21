-- Migration: Complete Chat System Refactor
-- Purpose: Modernize chat system for production-grade messaging
-- Features: E2E encryption, reactions, replies, read receipts, cursor pagination, WebSocket support

-- Drop old tables (will be recreated with new schema)
DROP TABLE IF EXISTS message_media_attachments CASCADE;
DROP TABLE IF EXISTS message_versions CASCADE;
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS reactions CASCADE;
DROP TABLE IF EXISTS read_receipts CASCADE;
DROP TABLE IF EXISTS delivery_receipts CASCADE;
DROP TABLE IF EXISTS pinned_messages CASCADE;
DROP TABLE IF EXISTS typing_sessions CASCADE;
DROP TABLE IF EXISTS chat_settings CASCADE;
DROP TABLE IF EXISTS message_keys CASCADE;
DROP TABLE IF EXISTS chat_members CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS direct_chat_members CASCADE;
DROP TABLE IF EXISTS direct_chats CASCADE;

-- New Enums for modern chat system
DO $$ BEGIN
    CREATE TYPE "ChatType" AS ENUM ('DIRECT', 'GROUP', 'CHANNEL', 'BROADCAST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DROP TYPE IF EXISTS "ChatMemberRole" CASCADE;
CREATE TYPE "ChatMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER');

DO $$ BEGIN
    CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'VOICE', 'STICKER', 'SYSTEM', 'LOCATION', 'CONTACT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MessageStatus" AS ENUM ('SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'LOVE', 'LAUGH', 'SURPRISE', 'SAD', 'ANGRY', 'FIRE', 'THUMBS_UP', 'THUMBS_DOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'VOICE', 'STICKER', 'LOCATION', 'CONTACT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EncryptionProtocol" AS ENUM ('SIGNAL', 'OMEMO', 'NONE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TypingStatus" AS ENUM ('TYPING', 'STOPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CHATS
-- ============================================================================
CREATE TABLE "chats" (
    "id" UUID NOT NULL,
    "type" "ChatType" NOT NULL DEFAULT 'DIRECT',
    "title" VARCHAR(255),
    "description" TEXT,
    "avatar_file_id" UUID,
    "created_by_id" UUID NOT NULL,
    "encryption_protocol" "EncryptionProtocol" NOT NULL DEFAULT 'SIGNAL',
    "message_ttl_seconds" INTEGER, -- For disappearing messages (NULL = no expiration)
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "last_message_id" UUID,
    "last_message_at" TIMESTAMP(3),
    "last_sequence_number" BIGINT NOT NULL DEFAULT 0,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chats_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "chats_avatar_file_id_fkey" FOREIGN KEY ("avatar_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL,
    CONSTRAINT "chats_message_ttl_check" CHECK ("message_ttl_seconds" IS NULL OR "message_ttl_seconds" > 0)
);

-- Indexes for chats
CREATE INDEX "chats_type_idx" ON "chats"("type");
CREATE INDEX "chats_created_by_id_idx" ON "chats"("created_by_id");
CREATE INDEX "chats_last_message_at_idx" ON "chats"("last_message_at" DESC);
CREATE INDEX "chats_member_count_idx" ON "chats"("member_count");
CREATE INDEX "chats_deleted_at_idx" ON "chats"("deleted_at") WHERE "deleted_at" IS NOT NULL;

-- ============================================================================
-- CHAT MEMBERS
-- ============================================================================
CREATE TABLE "chat_members" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ChatMemberRole" NOT NULL DEFAULT 'MEMBER',
    "nickname" VARCHAR(100),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "mute_until" TIMESTAMP(3),
    "last_read_message_id" UUID,
    "last_read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "chat_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_members_chat_id_user_id_key" UNIQUE ("chat_id", "user_id"),
    CONSTRAINT "chat_members_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE,
    CONSTRAINT "chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "chat_members_mute_until_check" CHECK ("mute_until" IS NULL OR "mute_until" > CURRENT_TIMESTAMP)
);

-- Indexes for chat_members
CREATE INDEX "chat_members_chat_id_idx" ON "chat_members"("chat_id");
CREATE INDEX "chat_members_user_id_idx" ON "chat_members"("user_id");
CREATE INDEX "chat_members_role_idx" ON "chat_members"("role");
CREATE INDEX "chat_members_joined_at_idx" ON "chat_members"("joined_at");
CREATE INDEX "chat_members_deleted_at_idx" ON "chat_members"("deleted_at") WHERE "deleted_at" IS NOT NULL;
-- Partial index for active members
CREATE INDEX "chat_members_active_idx" ON "chat_members"("chat_id", "user_id") WHERE "deleted_at" IS NULL AND "left_at" IS NULL;

-- ============================================================================
-- MESSAGES
-- ============================================================================
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "sequence_number" BIGINT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "status" "MessageStatus" NOT NULL DEFAULT 'SENDING',
    
    -- End-to-End Encryption fields
    "ciphertext" TEXT NOT NULL,
    "nonce" VARCHAR(255) NOT NULL,
    "sender_key_id" VARCHAR(255) NOT NULL,
    "encryption_protocol" "EncryptionProtocol" NOT NULL DEFAULT 'SIGNAL',
    "authentication_tag" VARCHAR(255),
    
    -- Message content (optional, for non-encrypted or system messages)
    "content" TEXT,
    "metadata" JSONB,
    
    -- Reply and forward
    "reply_to_message_id" UUID,
    "forwarded_from_message_id" UUID,
    "forwarded_from_chat_id" UUID,
    
    -- Expiration for disappearing messages
    "expires_at" TIMESTAMP(3),
    
    -- Timestamps
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_chat_id_sequence_number_key" UNIQUE ("chat_id", "sequence_number"),
    CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE,
    CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "messages"("id") ON DELETE SET NULL,
    CONSTRAINT "messages_forwarded_from_message_id_fkey" FOREIGN KEY ("forwarded_from_message_id") REFERENCES "messages"("id") ON DELETE SET NULL,
    CONSTRAINT "messages_forwarded_from_chat_id_fkey" FOREIGN KEY ("forwarded_from_chat_id") REFERENCES "chats"("id") ON DELETE SET NULL,
    CONSTRAINT "messages_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "messages_expires_at_check" CHECK ("expires_at" IS NULL OR "expires_at" > "sent_at"),
    CONSTRAINT "messages_sequence_number_check" CHECK ("sequence_number" >= 0)
);

-- Indexes for messages (critical for performance)
CREATE INDEX "messages_chat_id_idx" ON "messages"("chat_id");
CREATE INDEX "messages_chat_id_sequence_number_idx" ON "messages"("chat_id", "sequence_number");
CREATE INDEX "messages_chat_id_sent_at_idx" ON "messages"("chat_id", "sent_at" DESC);
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");
CREATE INDEX "messages_status_idx" ON "messages"("status");
CREATE INDEX "messages_type_idx" ON "messages"("type");
CREATE INDEX "messages_expires_at_idx" ON "messages"("expires_at") WHERE "expires_at" IS NOT NULL;
CREATE INDEX "messages_deleted_at_idx" ON "messages"("deleted_at") WHERE "deleted_at" IS NOT NULL;
-- Composite index for cursor pagination
CREATE INDEX "messages_cursor_idx" ON "messages"("chat_id", "sent_at" DESC, "id" DESC);
-- Index for reply queries
CREATE INDEX "messages_reply_to_message_id_idx" ON "messages"("reply_to_message_id") WHERE "reply_to_message_id" IS NOT NULL;

-- Add foreign key constraint to chat_members after messages table exists
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "messages"("id") ON DELETE SET NULL;

-- ============================================================================
-- MESSAGE VERSIONS (Edit History)
-- ============================================================================
CREATE TABLE "message_versions" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "nonce" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "metadata" JSONB,
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_by_id" UUID NOT NULL,

    CONSTRAINT "message_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "message_versions_message_id_version_number_key" UNIQUE ("message_id", "version_number"),
    CONSTRAINT "message_versions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
    CONSTRAINT "message_versions_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "message_versions_version_number_check" CHECK ("version_number" > 0)
);

CREATE INDEX "message_versions_message_id_idx" ON "message_versions"("message_id");
CREATE INDEX "message_versions_edited_at_idx" ON "message_versions"("edited_at");

-- ============================================================================
-- ATTACHMENTS
-- ============================================================================
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "file_name" VARCHAR(512),
    "mime_type" VARCHAR(255),
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER, -- For images/video
    "height" INTEGER, -- For images/video
    "duration_seconds" INTEGER, -- For audio/video
    "thumbnail_file_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
    CONSTRAINT "attachments_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE CASCADE,
    CONSTRAINT "attachments_thumbnail_file_id_fkey" FOREIGN KEY ("thumbnail_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL,
    CONSTRAINT "attachments_size_bytes_check" CHECK ("size_bytes" >= 0)
);

CREATE INDEX "attachments_message_id_idx" ON "attachments"("message_id");
CREATE INDEX "attachments_media_file_id_idx" ON "attachments"("media_file_id");
CREATE INDEX "attachments_kind_idx" ON "attachments"("kind");

-- ============================================================================
-- REACTIONS
-- ============================================================================
CREATE TABLE "reactions" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reaction_type" "ReactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reactions_message_id_user_id_key" UNIQUE ("message_id", "user_id"),
    CONSTRAINT "reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
    CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "reactions_message_id_idx" ON "reactions"("message_id");
CREATE INDEX "reactions_user_id_idx" ON "reactions"("user_id");
CREATE INDEX "reactions_reaction_type_idx" ON "reactions"("reaction_type");

-- ============================================================================
-- READ RECEIPTS
-- ============================================================================
CREATE TABLE "read_receipts" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "read_receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "read_receipts_message_id_user_id_key" UNIQUE ("message_id", "user_id"),
    CONSTRAINT "read_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
    CONSTRAINT "read_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "read_receipts_message_id_idx" ON "read_receipts"("message_id");
CREATE INDEX "read_receipts_user_id_idx" ON "read_receipts"("user_id");
CREATE INDEX "read_receipts_read_at_idx" ON "read_receipts"("read_at");

-- ============================================================================
-- DELIVERY RECEIPTS
-- ============================================================================
CREATE TABLE "delivery_receipts" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "delivery_receipts_message_id_user_id_key" UNIQUE ("message_id", "user_id"),
    CONSTRAINT "delivery_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
    CONSTRAINT "delivery_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "delivery_receipts_message_id_idx" ON "delivery_receipts"("message_id");
CREATE INDEX "delivery_receipts_user_id_idx" ON "delivery_receipts"("user_id");
CREATE INDEX "delivery_receipts_delivered_at_idx" ON "delivery_receipts"("delivered_at");

-- ============================================================================
-- PINNED MESSAGES
-- ============================================================================
CREATE TABLE "pinned_messages" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "pinned_by_id" UUID NOT NULL,
    "pinned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pinned_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pinned_messages_chat_id_message_id_key" UNIQUE ("chat_id", "message_id"),
    CONSTRAINT "pinned_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE,
    CONSTRAINT "pinned_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
    CONSTRAINT "pinned_messages_pinned_by_id_fkey" FOREIGN KEY ("pinned_by_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "pinned_messages_chat_id_idx" ON "pinned_messages"("chat_id");
CREATE INDEX "pinned_messages_message_id_idx" ON "pinned_messages"("message_id");
CREATE INDEX "pinned_messages_pinned_at_idx" ON "pinned_messages"("pinned_at");

-- ============================================================================
-- TYPING SESSIONS
-- ============================================================================
CREATE TABLE "typing_sessions" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "TypingStatus" NOT NULL DEFAULT 'TYPING',
    "expires_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 seconds'),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "typing_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "typing_sessions_chat_id_user_id_key" UNIQUE ("chat_id", "user_id"),
    CONSTRAINT "typing_sessions_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE,
    CONSTRAINT "typing_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "typing_sessions_chat_id_idx" ON "typing_sessions"("chat_id");
CREATE INDEX "typing_sessions_user_id_idx" ON "typing_sessions"("user_id");
CREATE INDEX "typing_sessions_expires_at_idx" ON "typing_sessions"("expires_at");

-- ============================================================================
-- CHAT SETTINGS
-- ============================================================================
CREATE TABLE "chat_settings" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notification_level" VARCHAR(20) NOT NULL DEFAULT 'ALL', -- ALL, MENTIONS, NONE
    "theme" VARCHAR(20),
    "custom_settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_settings_chat_id_user_id_key" UNIQUE ("chat_id", "user_id"),
    CONSTRAINT "chat_settings_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE,
    CONSTRAINT "chat_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "chat_settings_chat_id_idx" ON "chat_settings"("chat_id");
CREATE INDEX "chat_settings_user_id_idx" ON "chat_settings"("user_id");

-- ============================================================================
-- MESSAGE KEYS (E2E Encryption)
-- ============================================================================
CREATE TABLE "message_keys" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "message_keys_message_id_recipient_id_key" UNIQUE ("message_id", "recipient_id"),
    CONSTRAINT "message_keys_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
    CONSTRAINT "message_keys_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "message_keys_key_version_check" CHECK ("key_version" >= 1)
);

CREATE INDEX "message_keys_message_id_idx" ON "message_keys"("message_id");
CREATE INDEX "message_keys_recipient_id_idx" ON "message_keys"("recipient_id");

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Update chat's last_message_at and last_sequence_number when a message is sent
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chats
    SET last_message_id = NEW.id,
        last_message_at = NEW.sent_at,
        last_sequence_number = NEW.sequence_number,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        CREATE TRIGGER trigger_update_chat_last_message
            AFTER INSERT ON messages
            FOR EACH ROW
            EXECUTE FUNCTION update_chat_last_message();
    END IF;
END $$;

-- Update chat member count when members are added/removed
CREATE OR REPLACE FUNCTION update_chat_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE chats
        SET member_count = member_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.chat_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE chats
        SET member_count = GREATEST(member_count - 1, 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.chat_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            UPDATE chats
            SET member_count = GREATEST(member_count - 1, 0),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.chat_id;
        ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
            UPDATE chats
            SET member_count = member_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.chat_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_members') THEN
        CREATE TRIGGER trigger_update_chat_member_count
            AFTER INSERT OR UPDATE OR DELETE ON chat_members
            FOR EACH ROW
            EXECUTE FUNCTION update_chat_member_count();
    END IF;
END $$;

-- Auto-cleanup expired typing sessions
CREATE OR REPLACE FUNCTION cleanup_expired_typing_sessions()
RETURNS void AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'typing_sessions') THEN
        DELETE FROM typing_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS FOR COMMON QUERIES
-- ============================================================================

-- Function to get user's chats with latest message preview
CREATE OR REPLACE FUNCTION get_user_chats(p_user_id UUID, p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
    chat_id UUID,
    chat_type "ChatType",
    title VARCHAR(255),
    avatar_file_id UUID,
    last_message_id UUID,
    last_message_at TIMESTAMP(3),
    last_sequence_number BIGINT,
    member_count INTEGER,
    is_muted BOOLEAN,
    is_pinned BOOLEAN,
    unread_count BIGINT
) AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chats') THEN
        RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_members') THEN
        RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        RETURN;
    END IF;
    RETURN QUERY
    SELECT 
        c.id,
        c.type,
        c.title,
        c.avatar_file_id,
        c.last_message_id,
        c.last_message_at,
        c.last_sequence_number,
        c.member_count,
        cm.is_muted,
        c.is_pinned,
        (
            SELECT COUNT(*)
            FROM messages m
            WHERE m.chat_id = c.id
            AND m.sent_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamp)
            AND m.sender_id != p_user_id
            AND m.deleted_at IS NULL
        ) as unread_count
    FROM chats c
    INNER JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = p_user_id
    WHERE c.deleted_at IS NULL
    AND cm.deleted_at IS NULL
    AND cm.left_at IS NULL
    ORDER BY c.is_pinned DESC, c.last_message_at DESC NULLS LAST, c.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get messages with cursor pagination
CREATE OR REPLACE FUNCTION get_chat_messages_cursor(
    p_chat_id UUID,
    p_user_id UUID,
    p_cursor TIMESTAMP(3) DEFAULT NULL,
    p_cursor_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_before BOOLEAN DEFAULT true
)
RETURNS TABLE (
    message_id UUID,
    chat_id UUID,
    sender_id UUID,
    sequence_number BIGINT,
    message_type "MessageType",
    status "MessageStatus",
    ciphertext TEXT,
    nonce VARCHAR(255),
    sender_key_id VARCHAR(255),
    content TEXT,
    metadata JSONB,
    reply_to_message_id UUID,
    expires_at TIMESTAMP(3),
    sent_at TIMESTAMP(3),
    edited_at TIMESTAMP(3),
    deleted_at TIMESTAMP(3)
) AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_members') THEN
        RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        RETURN;
    END IF;
    -- Verify membership
    IF NOT EXISTS (
        SELECT 1 FROM chat_members 
        WHERE chat_id = p_chat_id 
        AND user_id = p_user_id 
        AND deleted_at IS NULL 
        AND left_at IS NULL
    ) THEN
        RAISE EXCEPTION 'User is not a member of this chat';
    END IF;

    IF p_before THEN
        -- Get messages before cursor (newer messages)
        RETURN QUERY
        SELECT 
            m.id, m.chat_id, m.sender_id, m.sequence_number, m.type, m.status,
            m.ciphertext, m.nonce, m.sender_key_id, m.content, m.metadata,
            m.reply_to_message_id, m.expires_at, m.sent_at, m.edited_at, m.deleted_at
        FROM messages m
        WHERE m.chat_id = p_chat_id
        AND m.deleted_at IS NULL
        AND (p_cursor IS NULL OR (m.sent_at < p_cursor OR (m.sent_at = p_cursor AND m.id < p_cursor_id)))
        ORDER BY m.sent_at DESC, m.id DESC
        LIMIT p_limit;
    ELSE
        -- Get messages after cursor (older messages)
        RETURN QUERY
        SELECT 
            m.id, m.chat_id, m.sender_id, m.sequence_number, m.type, m.status,
            m.ciphertext, m.nonce, m.sender_key_id, m.content, m.metadata,
            m.reply_to_message_id, m.expires_at, m.sent_at, m.edited_at, m.deleted_at
        FROM messages m
        WHERE m.chat_id = p_chat_id
        AND m.deleted_at IS NULL
        AND (p_cursor IS NULL OR (m.sent_at > p_cursor OR (m.sent_at = p_cursor AND m.id > p_cursor_id)))
        ORDER BY m.sent_at ASC, m.id ASC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to cleanup expired messages
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS void AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        -- Mark expired messages as deleted
        UPDATE messages
        SET deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE expires_at IS NOT NULL
        AND expires_at < CURRENT_TIMESTAMP
        AND deleted_at IS NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE "chats" IS 'Unified chat table supporting direct, group, channel, and broadcast chats';
COMMENT ON TABLE "chat_members" IS 'Chat membership with roles, read status, and mute settings';
COMMENT ON TABLE "messages" IS 'Messages with E2E encryption, replies, forwards, and expiration support';
COMMENT ON TABLE "message_versions" IS 'Edit history for messages';
COMMENT ON TABLE "attachments" IS 'Message attachments with media metadata';
COMMENT ON TABLE "reactions" IS 'Message reactions (emoji reactions)';
COMMENT ON TABLE "read_receipts" IS 'Read receipts for messages';
COMMENT ON TABLE "delivery_receipts" IS 'Delivery receipts for messages';
COMMENT ON TABLE "pinned_messages" IS 'Pinned messages in chats';
COMMENT ON TABLE "typing_sessions" IS 'Typing indicators with auto-expiration';
COMMENT ON TABLE "chat_settings" IS 'Per-user chat settings';
COMMENT ON TABLE "message_keys" IS 'E2E encryption keys per message recipient';
