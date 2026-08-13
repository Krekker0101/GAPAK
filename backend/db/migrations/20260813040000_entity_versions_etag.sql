CREATE TABLE IF NOT EXISTS entity_versions (
    resource_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    revision BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP(3),
    PRIMARY KEY (resource_type, entity_id),
    CONSTRAINT entity_versions_revision_positive CHECK (revision > 0)
);

CREATE INDEX IF NOT EXISTS entity_versions_updated_at_idx ON entity_versions(updated_at);

INSERT INTO entity_versions(resource_type, entity_id, revision, updated_at, deleted_at)
SELECT 'user_profile', id, 1, updated_at, deleted_at FROM users
ON CONFLICT DO NOTHING;

INSERT INTO entity_versions(resource_type, entity_id, revision, updated_at, deleted_at)
SELECT 'connection', id, 1, updated_at, deleted_at FROM friend_connections
ON CONFLICT DO NOTHING;

INSERT INTO entity_versions(resource_type, entity_id, revision, updated_at)
SELECT 'subscription', id, 1, updated_at FROM subscriptions
ON CONFLICT DO NOTHING;

INSERT INTO entity_versions(resource_type, entity_id, revision, updated_at, deleted_at)
SELECT 'story', id, 1, updated_at, deleted_at FROM stories
ON CONFLICT DO NOTHING;

INSERT INTO entity_versions(resource_type, entity_id, revision, updated_at, deleted_at)
SELECT 'live_stream', id, 1, updated_at, deleted_at FROM live_streams
ON CONFLICT DO NOTHING;

INSERT INTO entity_versions(resource_type, entity_id, revision, updated_at, deleted_at)
SELECT 'media', id, 1, updated_at, deleted_at FROM media_files
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION gapak_bump_entity_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    rt TEXT;
    rid UUID;
    ts TIMESTAMP(3);
    del TIMESTAMP(3);
BEGIN
    IF TG_TABLE_NAME = 'users' THEN
        rt := 'user_profile';
    ELSIF TG_TABLE_NAME = 'friend_connections' THEN
        rt := 'connection';
    ELSIF TG_TABLE_NAME = 'subscriptions' THEN
        rt := 'subscription';
    ELSIF TG_TABLE_NAME = 'stories' THEN
        rt := 'story';
    ELSIF TG_TABLE_NAME = 'live_streams' THEN
        rt := 'live_stream';
    ELSIF TG_TABLE_NAME = 'media_files' THEN
        rt := 'media';
    ELSIF TG_TABLE_NAME IN ('user_privacy_settings','user_settings') THEN
        rt := 'user_profile';
    ELSE
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF TG_OP = 'DELETE' THEN
        rid := OLD.id;
        ts := CURRENT_TIMESTAMP;
        IF TG_TABLE_NAME IN ('users','friend_connections','stories','live_streams','media_files') THEN
            del := OLD.deleted_at;
        ELSE
            del := ts;
        END IF;
        INSERT INTO entity_versions(resource_type, entity_id, revision, updated_at, deleted_at)
        VALUES (rt, rid, 1, ts, del)
        ON CONFLICT (resource_type, entity_id)
        DO UPDATE SET revision=entity_versions.revision+1, updated_at=EXCLUDED.updated_at, deleted_at=EXCLUDED.deleted_at;
        RETURN OLD;
    END IF;

    IF TG_TABLE_NAME IN ('user_privacy_settings','user_settings') THEN
        rid := NEW.user_id;
    ELSE
        rid := NEW.id;
    END IF;
    ts := COALESCE(NEW.updated_at, CURRENT_TIMESTAMP);
    del := CASE WHEN TG_TABLE_NAME IN ('users','friend_connections','stories','live_streams','media_files') THEN NEW.deleted_at ELSE NULL END;

    INSERT INTO entity_versions(resource_type, entity_id, revision, updated_at, deleted_at)
    VALUES (rt, rid, CASE WHEN TG_OP='INSERT' THEN 1 ELSE 1 END, ts, del)
    ON CONFLICT (resource_type, entity_id)
    DO UPDATE SET revision=entity_versions.revision + 1, updated_at=EXCLUDED.updated_at, deleted_at=EXCLUDED.deleted_at;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_entity_version_trg ON users;
CREATE TRIGGER users_entity_version_trg AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION gapak_bump_entity_version();
DROP TRIGGER IF EXISTS friend_connections_entity_version_trg ON friend_connections;
CREATE TRIGGER friend_connections_entity_version_trg AFTER INSERT OR UPDATE OR DELETE ON friend_connections FOR EACH ROW EXECUTE FUNCTION gapak_bump_entity_version();
DROP TRIGGER IF EXISTS subscriptions_entity_version_trg ON subscriptions;
CREATE TRIGGER subscriptions_entity_version_trg AFTER INSERT OR UPDATE OR DELETE ON subscriptions FOR EACH ROW EXECUTE FUNCTION gapak_bump_entity_version();
DROP TRIGGER IF EXISTS stories_entity_version_trg ON stories;
CREATE TRIGGER stories_entity_version_trg AFTER INSERT OR UPDATE OR DELETE ON stories FOR EACH ROW EXECUTE FUNCTION gapak_bump_entity_version();
DROP TRIGGER IF EXISTS live_streams_entity_version_trg ON live_streams;
CREATE TRIGGER live_streams_entity_version_trg AFTER INSERT OR UPDATE OR DELETE ON live_streams FOR EACH ROW EXECUTE FUNCTION gapak_bump_entity_version();
DROP TRIGGER IF EXISTS media_files_entity_version_trg ON media_files;
CREATE TRIGGER media_files_entity_version_trg AFTER INSERT OR UPDATE OR DELETE ON media_files FOR EACH ROW EXECUTE FUNCTION gapak_bump_entity_version();
DROP TRIGGER IF EXISTS user_privacy_settings_entity_version_trg ON user_privacy_settings;
CREATE TRIGGER user_privacy_settings_entity_version_trg AFTER INSERT OR UPDATE ON user_privacy_settings FOR EACH ROW EXECUTE FUNCTION gapak_bump_entity_version();
DROP TRIGGER IF EXISTS user_settings_entity_version_trg ON user_settings;
CREATE TRIGGER user_settings_entity_version_trg AFTER INSERT OR UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION gapak_bump_entity_version();
