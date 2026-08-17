-- Fixes: ERROR "record "new" has no field "deleted_at"" (SQLSTATE 42703),
-- surfaced e.g. as a 500 on GET /api/v1/users/me.
--
-- gapak_bump_entity_version() (see 20260813040000_entity_versions_etag.sql) is a
-- generic trigger shared by tables that DO have a deleted_at column (users,
-- friend_connections, stories, live_streams, media_files) and tables that do NOT
-- (subscriptions, user_privacy_settings, user_settings). The INSERT/UPDATE path
-- picked del via a single CASE expression:
--
--   del := CASE WHEN TG_TABLE_NAME IN (...) THEN NEW.deleted_at ELSE NULL END;
--
-- Postgres parses/binds every branch of a CASE expression as one query before
-- evaluating any WHEN condition, so referencing NEW.deleted_at anywhere in that
-- expression fails whenever the trigger fires for a row type that lacks the
-- column - even though the ELSE branch was the one that should have run. This
-- is why any insert/update touching user_settings or user_privacy_settings
-- (both fired from the users/me read path, which upserts theme/privacy
-- defaults) blew up. The DELETE path just above it already avoids this by
-- using separate IF/ELSE statements, so this fix brings the INSERT/UPDATE path
-- in line with that pattern: each branch is now its own PL/pgSQL statement,
-- compiled and only column-checked when actually reached.

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

    -- Each branch is its own statement (unlike a single CASE expression) so
    -- Postgres never has to resolve NEW.deleted_at against a row type that
    -- doesn't have that column.
    IF TG_TABLE_NAME IN ('users','friend_connections','stories','live_streams','media_files') THEN
        del := NEW.deleted_at;
    ELSE
        del := NULL;
    END IF;

    INSERT INTO entity_versions(resource_type, entity_id, revision, updated_at, deleted_at)
    VALUES (rt, rid, CASE WHEN TG_OP='INSERT' THEN 1 ELSE 1 END, ts, del)
    ON CONFLICT (resource_type, entity_id)
    DO UPDATE SET revision=entity_versions.revision + 1, updated_at=EXCLUDED.updated_at, deleted_at=EXCLUDED.deleted_at;
    RETURN NEW;
END;
$$;
