-- Media security/reconciliation hardening.
-- No destructive schema changes; all indexes are additive.

CREATE INDEX IF NOT EXISTS media_files_bucket_object_key_idx
    ON media_files(bucket, object_key)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS upload_sessions_bucket_status_expires_idx
    ON upload_sessions(bucket, status, expires_at);

CREATE INDEX IF NOT EXISTS processing_jobs_status_lease_idx
    ON processing_jobs(status, reserved_at, updated_at)
    WHERE status IN ('RESERVED', 'RUNNING');

CREATE INDEX IF NOT EXISTS video_variants_video_asset_playlist_idx
    ON video_variants(video_asset_id, playlist_object_key);

CREATE INDEX IF NOT EXISTS video_variants_segment_prefix_idx
    ON video_variants(video_asset_id, segment_prefix);
