-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN', 'SECURITY_ANALYST');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'CONNECTIONS', 'TRUSTED_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "LastSeenVisibility" AS ENUM ('EVERYONE', 'CONNECTIONS', 'NOBODY');

-- CreateEnum
CREATE TYPE "PostPrivacy" AS ENUM ('PUBLIC', 'FRIENDS', 'TRUSTED_CIRCLE', 'PRIVATE', 'ONE_TIME', 'TIMED');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ChatMemberRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "MessageEnvelopeType" AS ENUM ('TEXT', 'ATTACHMENT', 'KEY_EXCHANGE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TrustRoomVisibility" AS ENUM ('SECRET', 'PRIVATE');

-- CreateEnum
CREATE TYPE "TrustRoomAccessMode" AS ENUM ('INVITE_ONLY', 'REQUEST', 'OWNER_APPROVAL');

-- CreateEnum
CREATE TYPE "TrustRoomRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "SessionSecurityLevel" AS ENUM ('UNKNOWN', 'TRUSTED', 'RISKY');

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SuspiciousActivityReason" AS ENUM ('IMPOSSIBLE_TRAVEL', 'TOR_ACCESS', 'BRUTE_FORCE', 'NEW_DEVICE');

-- CreateEnum
CREATE TYPE "SuspiciousActivityStatus" AS ENUM ('OPEN', 'REVIEWED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('S3', 'MINIO', 'LOCAL');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'QUARANTINED', 'DELETED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'THUMBNAIL', 'LIVE_REPLAY', 'STORY_ASSET');

-- CreateEnum
CREATE TYPE "UploadSessionStatus" AS ENUM ('INITIATED', 'PARTIAL', 'COMPLETED', 'ABORTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('POST_ATTACHMENT', 'STORY', 'PROFILE', 'TRUST_ROOM', 'LIVE_REPLAY');

-- CreateEnum
CREATE TYPE "VideoAssetStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "VideoVariantStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PlaybackGrantStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'ARCHIVED', 'HIGHLIGHTED');

-- CreateEnum
CREATE TYPE "StoryReactionType" AS ENUM ('LIKE', 'FIRE', 'SUPPORT');

-- CreateEnum
CREATE TYPE "LiveStreamStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LiveParticipantRole" AS ENUM ('HOST', 'CO_HOST', 'GUEST', 'MODERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "LiveVisibility" AS ENUM ('PUBLIC', 'FRIENDS', 'TRUSTED_CIRCLE', 'PRIVATE', 'TRUST_ROOM');

-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('INVITED', 'ACCEPTED', 'REJECTED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BattleMode" AS ENUM ('DUEL', 'CREATOR_DUEL', 'ROOM_DUEL');

-- CreateEnum
CREATE TYPE "BattleVoteType" AS ENUM ('HOST_A', 'HOST_B', 'DRAW');

-- CreateEnum
CREATE TYPE "ProcessingJobType" AS ENUM ('MEDIA_ANALYZE', 'VIDEO_TRANSCODE', 'THUMBNAIL_GENERATE', 'STORY_OPTIMIZE', 'LIVE_REPLAY_FINALIZE', 'CLEANUP_ORPHANS');

-- CreateEnum
CREATE TYPE "ProcessingJobStatus" AS ENUM ('PENDING', 'RESERVED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('USER', 'POST', 'TRUST_ROOM', 'MEDIA', 'STORY', 'LIVE_STREAM', 'BATTLE');

-- CreateEnum
CREATE TYPE "ModerationReason" AS ENUM ('HARASSMENT', 'SPAM', 'ILLEGAL_CONTENT', 'IMPERSONATION');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254),
    "username" VARCHAR(32) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "bio" VARCHAR(600),
    "avatar_file_id" UUID,
    "status_message" VARCHAR(160),
    "password_hash" TEXT NOT NULL,
    "password_changed_at" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret_ciphertext" TEXT,
    "two_factor_secret_nonce" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_privacy_settings" (
    "user_id" UUID NOT NULL,
    "profile_visibility" "ProfileVisibility" NOT NULL DEFAULT 'CONNECTIONS',
    "last_seen_visibility" "LastSeenVisibility" NOT NULL DEFAULT 'CONNECTIONS',
    "allow_friend_requests" BOOLEAN NOT NULL DEFAULT true,
    "allow_trusted_invites" BOOLEAN NOT NULL DEFAULT true,
    "searchable_by_email" BOOLEAN NOT NULL DEFAULT false,
    "searchable_by_username" BOOLEAN NOT NULL DEFAULT true,
    "post_default_privacy" "PostPrivacy" NOT NULL DEFAULT 'FRIENDS',
    "show_online_status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "refresh_token_family" UUID NOT NULL,
    "user_agent" TEXT,
    "device_name" TEXT,
    "device_fingerprint" TEXT,
    "ip_address" VARCHAR(64),
    "country_code" VARCHAR(8),
    "city" VARCHAR(120),
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "security_level" "SessionSecurityLevel" NOT NULL DEFAULT 'UNKNOWN',
    "last_used_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_connections" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "addressee_id" UUID NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "friend_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_circle_memberships" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_circle_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" VARCHAR(5000) NOT NULL,
    "privacy" "PostPrivacy" NOT NULL,
    "expires_at" TIMESTAMP(3),
    "one_time_view_limit" INTEGER,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_audience_grants" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "subject_user_id" UUID NOT NULL,
    "max_views" INTEGER,
    "used_views" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_audience_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media_attachments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_media_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'DOCUMENT',
    "storage_provider" "StorageProvider" NOT NULL,
    "bucket" VARCHAR(120) NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" VARCHAR(255),
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64),
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "is_encrypted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "purpose" "UploadPurpose" NOT NULL,
    "status" "UploadSessionStatus" NOT NULL,
    "bucket" VARCHAR(120) NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "part_size_bytes" BIGINT NOT NULL,
    "total_parts" INTEGER NOT NULL,
    "multipart_upload_id" VARCHAR(255),
    "completed_at" TIMESTAMP(3),
    "aborted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_session_parts" (
    "id" UUID NOT NULL,
    "upload_session_id" UUID NOT NULL,
    "part_number" INTEGER NOT NULL,
    "etag" VARCHAR(255),
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64),
    "uploaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_session_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "status" "VideoAssetStatus" NOT NULL DEFAULT 'QUEUED',
    "master_playlist_key" TEXT,
    "preview_playlist_key" TEXT,
    "poster_object_key" TEXT,
    "duration_millis" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "video_codec" VARCHAR(64),
    "audio_codec" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ready_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_variants" (
    "id" UUID NOT NULL,
    "video_asset_id" UUID NOT NULL,
    "label" VARCHAR(32) NOT NULL,
    "status" "VideoVariantStatus" NOT NULL DEFAULT 'QUEUED',
    "playlist_object_key" TEXT NOT NULL,
    "init_segment_key" TEXT,
    "segment_prefix" TEXT,
    "container" VARCHAR(32) NOT NULL,
    "video_codec" VARCHAR(64),
    "audio_codec" VARCHAR(64),
    "width" INTEGER,
    "height" INTEGER,
    "bitrate_kbps" INTEGER,
    "frame_rate" DOUBLE PRECISION,
    "duration_millis" INTEGER,
    "size_bytes" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_thumbnails" (
    "id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "bucket" VARCHAR(120) NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_thumbnails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playback_access_grants" (
    "id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "viewer_user_id" UUID NOT NULL,
    "grant_token_hash" TEXT NOT NULL,
    "reason" VARCHAR(80) NOT NULL,
    "status" "PlaybackGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "max_views" INTEGER,
    "used_views" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playback_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" UUID NOT NULL,
    "queue_name" VARCHAR(120) NOT NULL,
    "job_type" "ProcessingJobType" NOT NULL,
    "status" "ProcessingJobStatus" NOT NULL DEFAULT 'PENDING',
    "media_file_id" UUID,
    "upload_session_id" UUID,
    "video_asset_id" UUID,
    "payload_json" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_error" TEXT,
    "reserved_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stories" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "video_asset_id" UUID,
    "trust_room_id" UUID,
    "caption" VARCHAR(600),
    "privacy" "PostPrivacy" NOT NULL,
    "status" "StoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "allow_replies" BOOLEAN NOT NULL DEFAULT true,
    "allow_reactions" BOOLEAN NOT NULL DEFAULT true,
    "highlight_title" VARCHAR(80),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_audience_grants" (
    "id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "subject_user_id" UUID NOT NULL,
    "max_views" INTEGER,
    "used_views" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_audience_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_viewers" (
    "story_id" UUID NOT NULL,
    "viewer_user_id" UUID NOT NULL,
    "reaction_type" "StoryReactionType",
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reacted_at" TIMESTAMP(3),

    CONSTRAINT "story_viewers_pkey" PRIMARY KEY ("story_id","viewer_user_id")
);

-- CreateTable
CREATE TABLE "live_streams" (
    "id" UUID NOT NULL,
    "host_user_id" UUID NOT NULL,
    "trust_room_id" UUID,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "visibility" "LiveVisibility" NOT NULL,
    "status" "LiveStreamStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_for" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "stream_key_hash" VARCHAR(255) NOT NULL,
    "ingest_url" TEXT,
    "playback_manifest_key" TEXT,
    "replay_media_file_id" UUID,
    "viewer_count" INTEGER NOT NULL DEFAULT 0,
    "allow_replay" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "live_streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_participants" (
    "stream_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "LiveParticipantRole" NOT NULL DEFAULT 'VIEWER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "is_ghost_mode" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "live_participants_pkey" PRIMARY KEY ("stream_id","user_id")
);

-- CreateTable
CREATE TABLE "live_chat_messages" (
    "id" UUID NOT NULL,
    "stream_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "live_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battles" (
    "id" UUID NOT NULL,
    "challenger_user_id" UUID NOT NULL,
    "opponent_user_id" UUID NOT NULL,
    "trust_room_id" UUID,
    "live_stream_id" UUID,
    "mode" "BattleMode" NOT NULL,
    "status" "BattleStatus" NOT NULL DEFAULT 'INVITED',
    "title" VARCHAR(120) NOT NULL,
    "invitation_message" VARCHAR(300),
    "scheduled_for" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "round_duration_sec" INTEGER NOT NULL DEFAULT 60,
    "score_host_a" INTEGER NOT NULL DEFAULT 0,
    "score_host_b" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_participants" (
    "battle_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "side" VARCHAR(32) NOT NULL,
    "is_creator" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_participants_pkey" PRIMARY KEY ("battle_id","user_id")
);

-- CreateTable
CREATE TABLE "battle_rounds" (
    "id" UUID NOT NULL,
    "battle_id" UUID NOT NULL,
    "round_number" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "score_host_a" INTEGER NOT NULL DEFAULT 0,
    "score_host_b" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_votes" (
    "id" UUID NOT NULL,
    "battle_id" UUID NOT NULL,
    "battle_round_id" UUID,
    "voter_user_id" UUID NOT NULL,
    "vote" "BattleVoteType" NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_chats" (
    "id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "direct_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_chat_members" (
    "chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ChatMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMP(3),
    "muted_until" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "direct_chat_members_pkey" PRIMARY KEY ("chat_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "envelope_type" "MessageEnvelopeType" NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "nonce" VARCHAR(255) NOT NULL,
    "sender_key_id" VARCHAR(255) NOT NULL,
    "attachment_manifest" JSONB,
    "metadata_json" JSONB,
    "client_message_id" VARCHAR(128) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_rooms" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(600),
    "visibility" "TrustRoomVisibility" NOT NULL,
    "access_mode" "TrustRoomAccessMode" NOT NULL,
    "require_two_factor" BOOLEAN NOT NULL DEFAULT false,
    "min_account_age_days" INTEGER NOT NULL DEFAULT 0,
    "message_retention_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "trust_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_room_members" (
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "TrustRoomRole" NOT NULL DEFAULT 'MEMBER',
    "invited_by_user_id" UUID,
    "trusted_until" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "trust_room_members_pkey" PRIMARY KEY ("room_id","user_id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_session_id" UUID,
    "target_user_id" UUID,
    "action" VARCHAR(160) NOT NULL,
    "resource_type" VARCHAR(120) NOT NULL,
    "resource_id" VARCHAR(120) NOT NULL,
    "severity" "SecuritySeverity" NOT NULL DEFAULT 'INFO',
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspicious_activity_flags" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "reason" "SuspiciousActivityReason" NOT NULL,
    "severity" "SecuritySeverity" NOT NULL DEFAULT 'WARNING',
    "status" "SuspiciousActivityStatus" NOT NULL DEFAULT 'OPEN',
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "suspicious_activity_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_login_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "channel" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),

    CONSTRAINT "device_login_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_reports" (
    "id" UUID NOT NULL,
    "reporter_user_id" UUID NOT NULL,
    "target_type" "ModerationTargetType" NOT NULL,
    "target_id" VARCHAR(120) NOT NULL,
    "reason" "ModerationReason" NOT NULL,
    "description" VARCHAR(1000),
    "status" "ModerationStatus" NOT NULL DEFAULT 'OPEN',
    "handled_by_user_id" UUID,
    "resolution_note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_role_account_status_idx" ON "users"("role", "account_status");

-- CreateIndex
CREATE INDEX "device_sessions_user_id_created_at_idx" ON "device_sessions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "device_sessions_refresh_token_hash_idx" ON "device_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "device_sessions_expires_at_idx" ON "device_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "friend_connections_requester_id_status_idx" ON "friend_connections"("requester_id", "status");

-- CreateIndex
CREATE INDEX "friend_connections_addressee_id_status_idx" ON "friend_connections"("addressee_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friend_connections_requester_id_addressee_id_key" ON "friend_connections"("requester_id", "addressee_id");

-- CreateIndex
CREATE INDEX "trusted_circle_memberships_member_id_idx" ON "trusted_circle_memberships"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_circle_memberships_owner_id_member_id_key" ON "trusted_circle_memberships"("owner_id", "member_id");

-- CreateIndex
CREATE INDEX "posts_author_id_published_at_idx" ON "posts"("author_id", "published_at");

-- CreateIndex
CREATE INDEX "posts_privacy_published_at_idx" ON "posts"("privacy", "published_at");

-- CreateIndex
CREATE INDEX "posts_expires_at_idx" ON "posts"("expires_at");

-- CreateIndex
CREATE INDEX "post_audience_grants_subject_user_id_expires_at_idx" ON "post_audience_grants"("subject_user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "post_audience_grants_post_id_subject_user_id_key" ON "post_audience_grants"("post_id", "subject_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_media_attachments_post_id_media_file_id_key" ON "post_media_attachments"("post_id", "media_file_id");

-- CreateIndex
CREATE INDEX "media_files_owner_id_status_idx" ON "media_files"("owner_id", "status");

-- CreateIndex
CREATE INDEX "media_files_bucket_object_key_idx" ON "media_files"("bucket", "object_key");

-- CreateIndex
CREATE INDEX "upload_sessions_owner_id_status_idx" ON "upload_sessions"("owner_id", "status");

-- CreateIndex
CREATE INDEX "upload_sessions_expires_at_idx" ON "upload_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "upload_session_parts_upload_session_id_part_number_key" ON "upload_session_parts"("upload_session_id", "part_number");

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_media_file_id_key" ON "video_assets"("media_file_id");

-- CreateIndex
CREATE INDEX "video_assets_status_created_at_idx" ON "video_assets"("status", "created_at");

-- CreateIndex
CREATE INDEX "video_variants_status_bitrate_kbps_idx" ON "video_variants"("status", "bitrate_kbps");

-- CreateIndex
CREATE UNIQUE INDEX "video_variants_video_asset_id_label_key" ON "video_variants"("video_asset_id", "label");

-- CreateIndex
CREATE INDEX "media_thumbnails_media_file_id_idx" ON "media_thumbnails"("media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "playback_access_grants_grant_token_hash_key" ON "playback_access_grants"("grant_token_hash");

-- CreateIndex
CREATE INDEX "playback_access_grants_viewer_user_id_status_idx" ON "playback_access_grants"("viewer_user_id", "status");

-- CreateIndex
CREATE INDEX "playback_access_grants_media_file_id_status_idx" ON "playback_access_grants"("media_file_id", "status");

-- CreateIndex
CREATE INDEX "playback_access_grants_expires_at_idx" ON "playback_access_grants"("expires_at");

-- CreateIndex
CREATE INDEX "processing_jobs_queue_name_status_created_at_idx" ON "processing_jobs"("queue_name", "status", "created_at");

-- CreateIndex
CREATE INDEX "processing_jobs_job_type_status_idx" ON "processing_jobs"("job_type", "status");

-- CreateIndex
CREATE INDEX "stories_author_id_published_at_idx" ON "stories"("author_id", "published_at");

-- CreateIndex
CREATE INDEX "stories_expires_at_idx" ON "stories"("expires_at");

-- CreateIndex
CREATE INDEX "story_audience_grants_subject_user_id_expires_at_idx" ON "story_audience_grants"("subject_user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "story_audience_grants_story_id_subject_user_id_key" ON "story_audience_grants"("story_id", "subject_user_id");

-- CreateIndex
CREATE INDEX "story_viewers_viewer_user_id_viewed_at_idx" ON "story_viewers"("viewer_user_id", "viewed_at");

-- CreateIndex
CREATE INDEX "live_streams_host_user_id_status_created_at_idx" ON "live_streams"("host_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "live_streams_visibility_status_idx" ON "live_streams"("visibility", "status");

-- CreateIndex
CREATE INDEX "live_participants_user_id_joined_at_idx" ON "live_participants"("user_id", "joined_at");

-- CreateIndex
CREATE INDEX "live_chat_messages_stream_id_created_at_idx" ON "live_chat_messages"("stream_id", "created_at");

-- CreateIndex
CREATE INDEX "battles_challenger_user_id_created_at_idx" ON "battles"("challenger_user_id", "created_at");

-- CreateIndex
CREATE INDEX "battles_opponent_user_id_created_at_idx" ON "battles"("opponent_user_id", "created_at");

-- CreateIndex
CREATE INDEX "battles_status_created_at_idx" ON "battles"("status", "created_at");

-- CreateIndex
CREATE INDEX "battle_participants_user_id_joined_at_idx" ON "battle_participants"("user_id", "joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "battle_rounds_battle_id_round_number_key" ON "battle_rounds"("battle_id", "round_number");

-- CreateIndex
CREATE INDEX "battle_votes_battle_round_id_created_at_idx" ON "battle_votes"("battle_round_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "battle_votes_battle_id_voter_user_id_battle_round_id_key" ON "battle_votes"("battle_id", "voter_user_id", "battle_round_id");

-- CreateIndex
CREATE INDEX "direct_chats_last_message_at_idx" ON "direct_chats"("last_message_at");

-- CreateIndex
CREATE INDEX "direct_chat_members_user_id_joined_at_idx" ON "direct_chat_members"("user_id", "joined_at");

-- CreateIndex
CREATE INDEX "messages_chat_id_sent_at_idx" ON "messages"("chat_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_chat_id_client_message_id_key" ON "messages"("chat_id", "client_message_id");

-- CreateIndex
CREATE INDEX "trust_rooms_owner_id_updated_at_idx" ON "trust_rooms"("owner_id", "updated_at");

-- CreateIndex
CREATE INDEX "trust_room_members_user_id_joined_at_idx" ON "trust_room_members"("user_id", "joined_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_target_user_id_created_at_idx" ON "audit_events"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_action_created_at_idx" ON "audit_events"("action", "created_at");

-- CreateIndex
CREATE INDEX "suspicious_activity_flags_user_id_created_at_idx" ON "suspicious_activity_flags"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "suspicious_activity_flags_status_severity_idx" ON "suspicious_activity_flags"("status", "severity");

-- CreateIndex
CREATE INDEX "device_login_alerts_user_id_created_at_idx" ON "device_login_alerts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_reports_reporter_user_id_created_at_idx" ON "moderation_reports"("reporter_user_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_reports_status_created_at_idx" ON "moderation_reports"("status", "created_at");

-- AddForeignKey
ALTER TABLE "user_privacy_settings" ADD CONSTRAINT "user_privacy_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_connections" ADD CONSTRAINT "friend_connections_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_connections" ADD CONSTRAINT "friend_connections_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_circle_memberships" ADD CONSTRAINT "trusted_circle_memberships_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_circle_memberships" ADD CONSTRAINT "trusted_circle_memberships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audience_grants" ADD CONSTRAINT "post_audience_grants_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audience_grants" ADD CONSTRAINT "post_audience_grants_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media_attachments" ADD CONSTRAINT "post_media_attachments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media_attachments" ADD CONSTRAINT "post_media_attachments_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_session_parts" ADD CONSTRAINT "upload_session_parts_upload_session_id_fkey" FOREIGN KEY ("upload_session_id") REFERENCES "upload_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_variants" ADD CONSTRAINT "video_variants_video_asset_id_fkey" FOREIGN KEY ("video_asset_id") REFERENCES "video_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_thumbnails" ADD CONSTRAINT "media_thumbnails_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_access_grants" ADD CONSTRAINT "playback_access_grants_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_access_grants" ADD CONSTRAINT "playback_access_grants_viewer_user_id_fkey" FOREIGN KEY ("viewer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_upload_session_id_fkey" FOREIGN KEY ("upload_session_id") REFERENCES "upload_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_video_asset_id_fkey" FOREIGN KEY ("video_asset_id") REFERENCES "video_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_video_asset_id_fkey" FOREIGN KEY ("video_asset_id") REFERENCES "video_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_trust_room_id_fkey" FOREIGN KEY ("trust_room_id") REFERENCES "trust_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_audience_grants" ADD CONSTRAINT "story_audience_grants_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_audience_grants" ADD CONSTRAINT "story_audience_grants_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_viewers" ADD CONSTRAINT "story_viewers_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_viewers" ADD CONSTRAINT "story_viewers_viewer_user_id_fkey" FOREIGN KEY ("viewer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_trust_room_id_fkey" FOREIGN KEY ("trust_room_id") REFERENCES "trust_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_replay_media_file_id_fkey" FOREIGN KEY ("replay_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_participants" ADD CONSTRAINT "live_participants_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "live_streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_participants" ADD CONSTRAINT "live_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "live_streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_challenger_user_id_fkey" FOREIGN KEY ("challenger_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_opponent_user_id_fkey" FOREIGN KEY ("opponent_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_trust_room_id_fkey" FOREIGN KEY ("trust_room_id") REFERENCES "trust_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_live_stream_id_fkey" FOREIGN KEY ("live_stream_id") REFERENCES "live_streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_rounds" ADD CONSTRAINT "battle_rounds_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_votes" ADD CONSTRAINT "battle_votes_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_votes" ADD CONSTRAINT "battle_votes_battle_round_id_fkey" FOREIGN KEY ("battle_round_id") REFERENCES "battle_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_votes" ADD CONSTRAINT "battle_votes_voter_user_id_fkey" FOREIGN KEY ("voter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_chats" ADD CONSTRAINT "direct_chats_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_chat_members" ADD CONSTRAINT "direct_chat_members_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "direct_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_chat_members" ADD CONSTRAINT "direct_chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "direct_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_rooms" ADD CONSTRAINT "trust_rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_room_members" ADD CONSTRAINT "trust_room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "trust_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_room_members" ADD CONSTRAINT "trust_room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_room_members" ADD CONSTRAINT "trust_room_members_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_session_id_fkey" FOREIGN KEY ("actor_session_id") REFERENCES "device_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspicious_activity_flags" ADD CONSTRAINT "suspicious_activity_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspicious_activity_flags" ADD CONSTRAINT "suspicious_activity_flags_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "device_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_login_alerts" ADD CONSTRAINT "device_login_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_login_alerts" ADD CONSTRAINT "device_login_alerts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "device_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_handled_by_user_id_fkey" FOREIGN KEY ("handled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

