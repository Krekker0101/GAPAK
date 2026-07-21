# GAPAK Messaging System - Database Schema

## Overview

PostgreSQL 16+ with logical replication for high availability and cross-region data synchronization. Schema designed for horizontal scaling via sharding and optimized for high-throughput messaging workloads.

---

## Core Tables

### users

User accounts and profile information.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar_file_id UUID,
    status_message TEXT,
    role VARCHAR(50) DEFAULT 'user',
    account_status VARCHAR(50) DEFAULT 'active',
    account_type VARCHAR(50) DEFAULT 'standard',
    is_anonymous BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret_ciphertext TEXT,
    two_factor_secret_nonce VARCHAR(100),
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_account_status ON users(account_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_last_seen ON users(last_seen_at DESC);
```

### user_privacy_settings

Privacy and visibility settings per user.

```sql
CREATE TABLE user_privacy_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    profile_visibility VARCHAR(50) DEFAULT 'public',
    last_seen_visibility VARCHAR(50) DEFAULT 'everyone',
    allow_friend_requests BOOLEAN DEFAULT TRUE,
    allow_trusted_invites BOOLEAN DEFAULT TRUE,
    searchable_by_email BOOLEAN DEFAULT TRUE,
    searchable_by_username BOOLEAN DEFAULT TRUE,
    post_default_privacy VARCHAR(50) DEFAULT 'friends',
    show_online_status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### device_sessions

Active device sessions for multi-device support.

```sql
CREATE TABLE device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    refresh_token_family VARCHAR(100) NOT NULL,
    user_agent TEXT,
    device_name VARCHAR(255),
    device_fingerprint VARCHAR(255),
    ip_address INET,
    country_code VARCHAR(10),
    city VARCHAR(100),
    is_current BOOLEAN DEFAULT FALSE,
    security_level VARCHAR(50) DEFAULT 'standard',
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_sessions_user_id ON device_sessions(user_id);
CREATE INDEX idx_device_sessions_refresh_token_family ON device_sessions(refresh_token_family);
CREATE INDEX idx_device_sessions_expires_at ON device_sessions(expires_at);
```

### devices

Device registration and key management.

```sql
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- mobile, desktop, web, etc.
    os VARCHAR(100),
    app_version VARCHAR(50),
    user_agent TEXT,
    device_fingerprint VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_devices_user_id ON devices(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_device_fingerprint ON devices(device_fingerprint);
CREATE INDEX idx_devices_is_active ON devices(is_active) WHERE deleted_at IS NULL;
```

### device_keys

Cryptographic keys for each device (E2EE).

```sql
CREATE TABLE device_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    key_id VARCHAR(255) UNIQUE NOT NULL,
    key_type VARCHAR(50) NOT NULL, -- identity, signed_prekey, one_time_prekey
    public_key BYTEA NOT NULL,
    private_key_ciphertext BYTEA NOT NULL, -- Encrypted at rest
    private_key_nonce VARCHAR(100) NOT NULL,
    signature BYTEA, -- For signed prekeys
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_used BOOLEAN DEFAULT FALSE, -- For one-time prekeys
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_device_keys_device_id ON device_keys(device_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_device_keys_key_id ON device_keys(key_id);
CREATE INDEX idx_device_keys_key_type ON device_keys(key_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_device_keys_is_used ON device_keys(is_used) WHERE deleted_at IS NULL;
```

### chats

Chat/conversation metadata.

```sql
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_id UUID NOT NULL REFERENCES users(id),
    chat_type VARCHAR(50) NOT NULL, -- direct, group, channel
    name VARCHAR(255),
    description TEXT,
    avatar_file_id UUID,
    message_retention_days INT,
    is_encrypted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_chats_created_by_id ON chats(created_by_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_chats_chat_type ON chats(chat_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_chats_updated_at ON chats(updated_at DESC) WHERE deleted_at IS NULL;
```

### chat_members

Chat membership and permissions.

```sql
CREATE TABLE chat_members (
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE,
    muted_until TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX idx_chat_members_user_id ON chat_members(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_chat_members_role ON chat_members(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_chat_members_joined_at ON chat_members(joined_at DESC) WHERE deleted_at IS NULL;
```

### messages

Core message storage with encryption envelope.

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    envelope_type VARCHAR(50) DEFAULT 'signal',
    ciphertext BYTEA NOT NULL,
    nonce VARCHAR(100) NOT NULL,
    sender_key_id VARCHAR(255) NOT NULL,
    attachment_manifest BYTEA,
    metadata_json JSONB,
    client_message_id VARCHAR(255), -- For deduplication
    sequence_number BIGINT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Sharding key for horizontal scaling
    shard_id INT GENERATED ALWAYS AS (hashtext(chat_id::text) % 100) STORED
);

-- Partitioning by shard_id for horizontal scaling
CREATE TABLE messages_0 PARTITION OF messages FOR VALUES IN (0);
CREATE TABLE messages_1 PARTITION OF messages FOR VALUES IN (1);
-- ... create partitions 0-99

CREATE INDEX idx_messages_chat_id ON messages(chat_id, sequence_number DESC);
CREATE INDEX idx_messages_sender_id ON messages(sender_id, sent_at DESC);
CREATE INDEX idx_messages_client_message_id ON messages(client_message_id) WHERE client_message_id IS NOT NULL;
CREATE INDEX idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX idx_messages_shard_id ON messages(shard_id);

-- Full-text search index
CREATE INDEX idx_messages_fts ON messages USING gin(to_tsvector('english', metadata_json));
```

### message_attachments

Message attachment references.

```sql
CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    media_file_id UUID NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    thumbnail_id UUID,
    metadata_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX idx_message_attachments_media_file_id ON message_attachments(media_file_id);
```

### message_delivery_status

Message delivery tracking per recipient.

```sql
CREATE TABLE message_delivery_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES users(id),
    recipient_device_id UUID REFERENCES devices(id),
    delivery_status VARCHAR(50) DEFAULT 'pending', -- pending, delivered, read, failed
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, recipient_user_id, recipient_device_id)
);

CREATE INDEX idx_message_delivery_status_message_id ON message_delivery_status(message_id);
CREATE INDEX idx_message_delivery_status_recipient_user_id ON message_delivery_status(recipient_user_id);
CREATE INDEX idx_message_delivery_status_delivery_status ON message_delivery_status(delivery_status);
CREATE INDEX idx_message_delivery_status_delivered_at ON message_delivery_status(delivered_at DESC);
```

### presence

User presence and online status.

```sql
CREATE TABLE presence (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'offline',
    last_seen_at TIMESTAMP WITH TIME ZONE,
    current_device_id UUID REFERENCES devices(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_presence_is_online ON presence(is_online) WHERE is_online = TRUE;
CREATE INDEX idx_presence_last_seen_at ON presence(last_seen_at DESC);
```

### device_presence

Per-device presence tracking.

```sql
CREATE TABLE device_presence (
    device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    is_online BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'offline',
    last_seen_at TIMESTAMP WITH TIME ZONE,
    connected_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_presence_user_id ON device_presence(user_id);
CREATE INDEX idx_device_presence_is_online ON device_presence(is_online) WHERE is_online = TRUE;
```

### typing_indicators

Real-time typing indicators.

```sql
CREATE TABLE typing_indicators (
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id),
    is_typing BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (chat_id, user_id, device_id)
);

CREATE INDEX idx_typing_indicators_chat_id ON typing_indicators(chat_id) WHERE is_typing = TRUE;
```

### push_tokens

Push notification tokens per device.

```sql
CREATE TABLE push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    token VARCHAR(500) NOT NULL,
    platform VARCHAR(50) NOT NULL, -- apns, fcm, web
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, device_id, platform)
);

CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_token ON push_tokens(token);
CREATE INDEX idx_push_tokens_is_active ON push_tokens(is_active) WHERE is_active = TRUE;
```

### push_notifications

Push notification delivery tracking.

```sql
CREATE TABLE push_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    device_id UUID REFERENCES devices(id),
    platform VARCHAR(50) NOT NULL,
    payload_json JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, failed
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_push_notifications_user_id ON push_notifications(user_id);
CREATE INDEX idx_push_notifications_status ON push_notifications(status);
CREATE INDEX idx_push_notifications_created_at ON push_notifications(created_at DESC);
```

### media_files

Media file metadata and storage references.

```sql
CREATE TABLE media_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    kind VARCHAR(50) NOT NULL, -- image, video, audio, document
    storage_provider VARCHAR(50) DEFAULT 's3',
    bucket VARCHAR(255) NOT NULL,
    object_key VARCHAR(500) NOT NULL,
    original_name VARCHAR(500),
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64),
    status VARCHAR(50) DEFAULT 'active',
    is_encrypted BOOLEAN DEFAULT FALSE,
    encryption_key_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_media_files_owner_id ON media_files(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_files_kind ON media_files(kind) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_files_status ON media_files(status);
CREATE INDEX idx_media_files_object_key ON media_files(bucket, object_key);
```

### media_thumbnails

Generated thumbnails for media files.

```sql
CREATE TABLE media_thumbnails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    bucket VARCHAR(255) NOT NULL,
    object_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_media_thumbnails_media_file_id ON media_thumbnails(media_file_id);
```

### audit_events

Security audit log.

```sql
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id),
    actor_session_id UUID REFERENCES device_sessions(id),
    target_user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    severity VARCHAR(50) DEFAULT 'info',
    ip_address INET,
    user_agent TEXT,
    metadata_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_events_actor_user_id ON audit_events(actor_user_id);
CREATE INDEX idx_audit_events_target_user_id ON audit_events(target_user_id);
CREATE INDEX idx_audit_events_action ON audit_events(action);
CREATE INDEX idx_audit_events_resource_type ON audit_events(resource_type);
CREATE INDEX idx_audit_events_severity ON audit_events(severity);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC);

-- Partition by month for better performance and retention
CREATE TABLE audit_events_2024_01 PARTITION OF audit_events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### suspicious_activity_flags

Security flags for suspicious behavior.

```sql
CREATE TABLE suspicious_activity_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    session_id UUID REFERENCES device_sessions(id),
    reason VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- open, investigating, resolved, dismissed
    metadata_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_suspicious_activity_flags_user_id ON suspicious_activity_flags(user_id);
CREATE INDEX idx_suspicious_activity_flags_status ON suspicious_activity_flags(status);
CREATE INDEX idx_suspicious_activity_flags_severity ON suspicious_activity_flags(severity);
CREATE INDEX idx_suspicious_activity_flags_created_at ON suspicious_activity_flags(created_at DESC);
```

### rate_limits

Rate limiting rules and tracking.

```sql
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    ip_address INET,
    resource_type VARCHAR(100) NOT NULL,
    window_seconds INT NOT NULL,
    max_requests INT NOT NULL,
    current_count INT DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX idx_rate_limits_ip_address ON rate_limits(ip_address);
CREATE INDEX idx_rate_limits_resource_type ON rate_limits(resource_type);
CREATE INDEX idx_rate_limits_window_start ON rate_limits(window_start);
```

### message_deduplication

Message deduplication cache (short-lived).

```sql
CREATE TABLE message_deduplication (
    client_message_id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    chat_id UUID NOT NULL REFERENCES chats(id),
    server_message_id UUID NOT NULL REFERENCES messages(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_message_deduplication_user_id ON message_deduplication(user_id);
CREATE INDEX idx_message_deduplication_chat_id ON message_deduplication(chat_id);
CREATE INDEX idx_message_deduplication_expires_at ON message_deduplication(expires_at);

-- Auto-cleanup old entries
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('cleanup-dedup', '0 * * * *', $$
    DELETE FROM message_deduplication WHERE expires_at < NOW()
$$);
```

---

## Database Sharding Strategy

### Horizontal Sharding by Chat ID

Messages table is sharded by `chat_id` hash to distribute load across database nodes:

```sql
-- Shard selection logic
shard_id = hash(chat_id) % 100

-- Each shard is a separate partition
-- Can be moved to different physical servers
```

### Vertical Sharding by Data Type

- **Hot data**: Recent messages, presence, typing indicators (Redis + PostgreSQL)
- **Warm data**: Chat metadata, user profiles (PostgreSQL)
- **Cold data**: Old messages, audit logs (PostgreSQL with partitioning)

---

## Indexing Strategy

### Read-Optimized Indexes

- Composite indexes for common query patterns
- Partial indexes for filtered queries
- Covering indexes to avoid table lookups
- BRIN indexes for time-series data

### Write-Optimized Considerations

- Minimal indexes on high-write tables
- Use CONCURRENTLY for index creation
- Consider index-only scans for hot queries
- Monitor index bloat and rebuild periodically

---

## Data Retention Policies

### Message Retention

```sql
-- Archive messages older than retention period
DELETE FROM messages 
WHERE sent_at < NOW() - INTERVAL '1 year' * (
    SELECT COALESCE(message_retention_days, 365) 
    FROM chats 
    WHERE id = messages.chat_id
);
```

### Audit Log Retention

```sql
-- Partition audit events by month
-- Drop partitions older than 2 years
DROP TABLE audit_events_2022_01;
```

### Presence Data

```sql
-- Clean up old presence data
DELETE FROM device_presence 
WHERE last_seen_at < NOW() - INTERVAL '30 days';
```

---

## Replication Strategy

### Logical Replication

```sql
-- Publication for all tables
CREATE PUBLICATION gapak_pub FOR ALL TABLES;

-- Subscription on replica
CREATE SUBSCRIPTION gapak_sub
CONNECTION 'host=replica-db port=5432 dbname=gapak'
PUBLICATION gapak_pub;
```

### Cross-Region Replication

- Primary region: Active writes
- Secondary regions: Read replicas with logical replication
- Conflict resolution: Last-write-wins with timestamp
- Lag monitoring: Alert if replication lag > 5 seconds

---

## Backup Strategy

### Point-in-Time Recovery

- Continuous WAL archiving to S3
- Daily full backups to S3
- Retention: 30 days for daily, 1 year for weekly
- Test restore monthly

### Backup Commands

```bash
# Full backup
pg_dump -Fc gapak > gapak_backup.dump

# WAL archive
archive_command = 'aws s3 cp %p s3://backups/wal/%f'

# Restore
pg_restore -d gapak gapak_backup.dump
```

---

## Performance Optimization

### Connection Pooling

- PgBouncer for connection pooling
- Transaction pooling mode for high concurrency
- Server-side prepared statements disabled

### Query Optimization

- Use EXPLAIN ANALYZE for slow queries
- Materialized views for complex aggregations
- CTEs for complex queries
- Avoid SELECT *, use specific columns

### Monitoring Queries

```sql
-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## Migration Strategy

### Schema Versioning

- Use migration files with version numbers
- Apply migrations in order
- Rollback capability for critical migrations
- Test migrations on staging first

### Example Migration

```sql
-- migration_001_create_users_table.sql
BEGIN;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100) UNIQUE NOT NULL,
    -- ... other fields
);

COMMIT;
```

---

## Security Considerations

### Row-Level Security

```sql
-- Enable RLS on sensitive tables
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see messages in chats they're members of
CREATE POLICY messages_select_policy ON messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_members
            WHERE chat_members.chat_id = messages.chat_id
            AND chat_members.user_id = current_setting('app.current_user_id')::UUID
        )
    );
```

### Encryption at Rest

- Use TDE (Transparent Data Encryption) if available
- Encrypt sensitive columns with pgcrypto
- Store encryption keys in HSM/Vault
- Rotate encryption keys annually

### Audit Logging

- Log all DDL changes
- Log all data modifications to sensitive tables
- Use pg_stat_statements for query monitoring
- Enable log_statement = 'all' in development
