ALTER TYPE "UploadPurpose" ADD VALUE IF NOT EXISTS 'CHAT_ATTACHMENT';

CREATE TABLE "message_media_attachments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_media_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_presence_connections" (
    "connection_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "page_path" VARCHAR(320),
    "connected_at" TIMESTAMP(3) NOT NULL,
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3) NOT NULL,
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_presence_connections_pkey" PRIMARY KEY ("connection_id"),
    CONSTRAINT "user_presence_connections_state_check" CHECK ("state" IN ('ACTIVE', 'IDLE', 'DISCONNECTED'))
);

CREATE UNIQUE INDEX "message_media_attachments_message_id_media_file_id_key" ON "message_media_attachments"("message_id", "media_file_id");
CREATE INDEX "message_media_attachments_media_file_id_idx" ON "message_media_attachments"("media_file_id");
CREATE INDEX "user_presence_connections_user_id_state_last_heartbeat_idx" ON "user_presence_connections"("user_id", "state", "last_heartbeat_at");
CREATE INDEX "user_presence_connections_session_id_idx" ON "user_presence_connections"("session_id");

ALTER TABLE "message_media_attachments"
    ADD CONSTRAINT "message_media_attachments_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_media_attachments"
    ADD CONSTRAINT "message_media_attachments_media_file_id_fkey"
    FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_presence_connections"
    ADD CONSTRAINT "user_presence_connections_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_presence_connections"
    ADD CONSTRAINT "user_presence_connections_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "device_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
