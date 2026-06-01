package media

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Repository struct {
	db *pgxpool.Pool
}

type MediaAggregate struct {
	Media      *model.MediaFile
	VideoAsset *model.VideoAsset
	Variants   []model.VideoVariant
	Thumbnails []model.MediaThumbnail
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUploadSession(
	ctx context.Context,
	ownerID string,
	provider enums.StorageProvider,
	bucket string,
	req CreateUploadSessionRequest,
	purpose enums.UploadPurpose,
	kind enums.MediaKind,
	objectKey string,
	partSizeBytes int64,
	totalParts int,
	expiresAt time.Time,
) (*model.UploadSession, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	mediaID := uuid.NewString()
	const mediaQuery = `
		INSERT INTO media_files (
			id, owner_id, kind, storage_provider, bucket, object_key, original_name, mime_type,
			size_bytes, checksum_sha256, status, is_encrypted, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULLIF($10, ''), 'PENDING', true, NOW())`
	if _, err := tx.Exec(ctx, mediaQuery,
		mediaID,
		ownerID,
		string(kind),
		string(provider),
		bucket,
		objectKey,
		req.FileName,
		req.MimeType,
		req.SizeBytes,
		req.ChecksumSHA256,
	); err != nil {
		return nil, err
	}

	sessionID := uuid.NewString()
	multipartUploadID := uuid.NewString()
	const sessionQuery = `
		INSERT INTO upload_sessions (
			id, owner_id, media_file_id, purpose, status, bucket, object_key, file_name, mime_type,
			size_bytes, part_size_bytes, total_parts, multipart_upload_id, expires_at, updated_at
		)
		VALUES ($1, $2, $3, $4, 'INITIATED', $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
		RETURNING id, owner_id, media_file_id, purpose, status, bucket, object_key, file_name, mime_type,
		          size_bytes, part_size_bytes, total_parts, multipart_upload_id, completed_at, aborted_at, expires_at,
		          created_at, updated_at`
	session, err := scanUploadSession(tx.QueryRow(ctx, sessionQuery,
		sessionID,
		ownerID,
		mediaID,
		string(purpose),
		bucket,
		objectKey,
		req.FileName,
		req.MimeType,
		req.SizeBytes,
		partSizeBytes,
		totalParts,
		multipartUploadID,
		expiresAt,
	))
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return session, nil
}

func (r *Repository) FindUploadSession(ctx context.Context, ownerID, sessionID string) (*model.UploadSession, error) {
	const query = `
		SELECT id, owner_id, media_file_id, purpose, status, bucket, object_key, file_name, mime_type,
		       size_bytes, part_size_bytes, total_parts, multipart_upload_id, completed_at, aborted_at, expires_at,
		       created_at, updated_at
		FROM upload_sessions
		WHERE id = $1 AND owner_id = $2
		LIMIT 1`
	return scanUploadSession(r.db.QueryRow(ctx, query, sessionID, ownerID))
}

func (r *Repository) FindUploadSessionByGateway(ctx context.Context, sessionID, bucket, objectKey string) (*model.UploadSession, error) {
	const query = `
		SELECT id, owner_id, media_file_id, purpose, status, bucket, object_key, file_name, mime_type,
		       size_bytes, part_size_bytes, total_parts, multipart_upload_id, completed_at, aborted_at, expires_at,
		       created_at, updated_at
		FROM upload_sessions
		WHERE id = $1
		  AND bucket = $2
		  AND object_key = $3
		LIMIT 1`
	return scanUploadSession(r.db.QueryRow(ctx, query, sessionID, bucket, objectKey))
}

func (r *Repository) UpsertUploadPart(ctx context.Context, ownerID, sessionID string, part CompletedUploadPart) error {
	const query = `
		INSERT INTO upload_session_parts (id, upload_session_id, part_number, etag, size_bytes, uploaded_at)
		SELECT $1, us.id, $2, $3, $4, NOW()
		FROM upload_sessions us
		WHERE us.id = $5 AND us.owner_id = $6
		ON CONFLICT (upload_session_id, part_number)
		DO UPDATE SET etag = EXCLUDED.etag, size_bytes = EXCLUDED.size_bytes, uploaded_at = NOW()`
	_, err := r.db.Exec(ctx, query, uuid.NewString(), part.PartNumber, part.ETag, part.SizeBytes, sessionID, ownerID)
	return err
}

func (r *Repository) UpsertUploadPartBySession(ctx context.Context, sessionID string, part CompletedUploadPart) error {
	const query = `
		INSERT INTO upload_session_parts (id, upload_session_id, part_number, etag, size_bytes, uploaded_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (upload_session_id, part_number)
		DO UPDATE SET etag = EXCLUDED.etag, size_bytes = EXCLUDED.size_bytes, uploaded_at = NOW()`
	_, err := r.db.Exec(ctx, query, uuid.NewString(), sessionID, part.PartNumber, part.ETag, part.SizeBytes)
	return err
}

func (r *Repository) CompleteUploadSession(ctx context.Context, ownerID, sessionID string, parts []CompletedUploadPart) (*model.UploadSession, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	for _, part := range parts {
		const upsertQuery = `
			INSERT INTO upload_session_parts (id, upload_session_id, part_number, etag, size_bytes, uploaded_at)
			SELECT $1, us.id, $2, $3, $4, NOW()
			FROM upload_sessions us
			WHERE us.id = $5 AND us.owner_id = $6
			ON CONFLICT (upload_session_id, part_number)
			DO UPDATE SET etag = EXCLUDED.etag, size_bytes = EXCLUDED.size_bytes, uploaded_at = NOW()`
		if _, err := tx.Exec(ctx, upsertQuery, uuid.NewString(), part.PartNumber, part.ETag, part.SizeBytes, sessionID, ownerID); err != nil {
			return nil, err
		}
	}

	const query = `
		UPDATE upload_sessions
		SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND owner_id = $2
		RETURNING id, owner_id, media_file_id, purpose, status, bucket, object_key, file_name, mime_type,
		          size_bytes, part_size_bytes, total_parts, multipart_upload_id, completed_at, aborted_at, expires_at,
		          created_at, updated_at`
	session, err := scanUploadSession(tx.QueryRow(ctx, query, sessionID, ownerID))
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE media_files
		SET status = 'READY', updated_at = NOW()
		WHERE id = $1
	`, session.MediaFileID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return session, nil
}

func (r *Repository) ValidateAvatarMediaOwnership(ctx context.Context, ownerID, mediaID string) error {
	const query = `
		SELECT 1
		FROM media_files m
		WHERE m.id = $1
		  AND m.owner_id = $2
		  AND m.deleted_at IS NULL
		  AND m.status = 'READY'
		  AND EXISTS (
		    SELECT 1
		    FROM upload_sessions us
		    WHERE us.media_file_id = m.id
		      AND us.owner_id = $2
		      AND us.purpose = 'PROFILE'
		      AND us.status = 'COMPLETED'
		  )
		LIMIT 1`
	var exists int
	if err := r.db.QueryRow(ctx, query, mediaID, ownerID).Scan(&exists); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperrors.New(400, "users.avatar_invalid", "Avatar file must be a completed PROFILE upload owned by the current user")
		}
		return err
	}
	return nil
}

func (r *Repository) AbortUploadSession(ctx context.Context, ownerID, sessionID string) error {
	const query = `
		UPDATE upload_sessions
		SET status = 'ABORTED', aborted_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND owner_id = $2`
	_, err := r.db.Exec(ctx, query, sessionID, ownerID)
	return err
}

func (r *Repository) CreateProcessingJob(ctx context.Context, queueName string, jobType enums.ProcessingJobType, mediaID, sessionID string, payload map[string]any) (*model.ProcessingJob, error) {
	rawPayload, _ := json.Marshal(payload)
	const query = `
		INSERT INTO processing_jobs (
			id, queue_name, job_type, status, media_file_id, upload_session_id, payload_json, attempts, max_attempts, updated_at
		)
		VALUES ($1, $2, $3, 'PENDING', $4, $5, $6::jsonb, 0, 5, NOW())
		RETURNING id, queue_name, job_type, status, media_file_id, upload_session_id, video_asset_id, payload_json,
		          attempts, max_attempts, last_error, reserved_at, started_at, finished_at, created_at, updated_at`
	return scanProcessingJob(r.db.QueryRow(ctx, query, uuid.NewString(), queueName, string(jobType), mediaID, sessionID, rawPayload))
}

func (r *Repository) FindAccessibleMedia(ctx context.Context, viewerID, mediaID string) (*model.MediaFile, error) {
	const query = `
		SELECT m.id, m.owner_id, COALESCE(m.kind, 'DOCUMENT') AS kind, m.storage_provider, m.bucket, m.object_key,
		       m.original_name, m.mime_type, m.size_bytes, m.checksum_sha256, m.status, m.is_encrypted,
		       m.created_at, m.updated_at, m.deleted_at
		FROM media_files m
		WHERE m.id = $2
		  AND m.deleted_at IS NULL
		  AND (m.owner_id = $1 OR m.status = 'READY')
		  AND (
		    m.owner_id = $1
		    OR EXISTS (
		      SELECT 1
		      FROM users u
		      JOIN user_privacy_settings ups ON ups.user_id = u.id
		      WHERE u.avatar_file_id = m.id
		        AND u.deleted_at IS NULL
		        AND (
		          u.id = $1
		          OR ups.profile_visibility = 'PUBLIC'
		          OR (ups.profile_visibility = 'CONNECTIONS' AND EXISTS (
		                SELECT 1 FROM friend_connections fc
		                WHERE fc.deleted_at IS NULL AND fc.status = 'ACCEPTED'
		                  AND ((fc.requester_id = u.id AND fc.addressee_id = $1) OR (fc.addressee_id = u.id AND fc.requester_id = $1))
		              ))
		          OR (ups.profile_visibility = 'TRUSTED_ONLY' AND EXISTS (
		                SELECT 1 FROM trusted_circle_memberships tcm
		                WHERE tcm.owner_id = u.id AND tcm.member_id = $1
		              ))
		        )
		    )
		    OR EXISTS (
		      SELECT 1
		      FROM message_media_attachments mma
		      JOIN messages msg ON msg.id = mma.message_id AND msg.deleted_at IS NULL
		      JOIN direct_chat_members self ON self.chat_id = msg.chat_id AND self.user_id = $1 AND self.deleted_at IS NULL
		      WHERE mma.media_file_id = m.id
		    )
		    OR EXISTS (
		      SELECT 1
		      FROM post_media_attachments pma
		      JOIN posts p ON p.id = pma.post_id
		      WHERE pma.media_file_id = m.id
		        AND p.deleted_at IS NULL
		        AND (
		          p.author_id = $1
		          OR p.privacy = 'PUBLIC'
		          OR (p.privacy = 'FRIENDS' AND EXISTS (
		                SELECT 1 FROM friend_connections fc
		                WHERE fc.deleted_at IS NULL AND fc.status = 'ACCEPTED'
		                  AND ((fc.requester_id = p.author_id AND fc.addressee_id = $1) OR (fc.addressee_id = p.author_id AND fc.requester_id = $1))
		              ))
		          OR (p.privacy = 'TRUSTED_CIRCLE' AND EXISTS (
		                SELECT 1 FROM trusted_circle_memberships tcm
		                WHERE tcm.owner_id = p.author_id AND tcm.member_id = $1
		              ))
		          OR (p.privacy IN ('PRIVATE', 'ONE_TIME', 'TIMED') AND EXISTS (
		                SELECT 1 FROM post_audience_grants pag
		                WHERE pag.post_id = p.id
		                  AND pag.subject_user_id = $1
		                  AND (pag.expires_at IS NULL OR pag.expires_at > NOW())
		                  AND (pag.max_views IS NULL OR pag.used_views < pag.max_views)
		              ))
		        )
		    )
		    OR EXISTS (
		      SELECT 1
		      FROM stories s
		      WHERE s.media_file_id = m.id
		        AND s.deleted_at IS NULL
		        AND s.expires_at > NOW()
		        AND (
		          s.author_id = $1
		          OR s.privacy = 'PUBLIC'
		          OR (s.privacy = 'FRIENDS' AND EXISTS (
		                SELECT 1 FROM friend_connections fc
		                WHERE fc.deleted_at IS NULL AND fc.status = 'ACCEPTED'
		                  AND ((fc.requester_id = s.author_id AND fc.addressee_id = $1) OR (fc.addressee_id = s.author_id AND fc.requester_id = $1))
		              ))
		          OR (s.privacy = 'TRUSTED_CIRCLE' AND EXISTS (
		                SELECT 1 FROM trusted_circle_memberships tcm
		                WHERE tcm.owner_id = s.author_id AND tcm.member_id = $1
		              ))
		          OR (s.privacy IN ('PRIVATE', 'ONE_TIME', 'TIMED') AND EXISTS (
		                SELECT 1 FROM story_audience_grants sag
		                WHERE sag.story_id = s.id
		                  AND sag.subject_user_id = $1
		                  AND (sag.expires_at IS NULL OR sag.expires_at > NOW())
		                  AND (sag.max_views IS NULL OR sag.used_views < sag.max_views)
		              ))
		        )
		    )
		  )
		LIMIT 1`
	return scanMedia(r.db.QueryRow(ctx, query, viewerID, mediaID))
}

func (r *Repository) GetAggregate(ctx context.Context, viewerID, mediaID string) (*MediaAggregate, error) {
	media, err := r.FindAccessibleMedia(ctx, viewerID, mediaID)
	if err != nil {
		return nil, err
	}

	aggregate := &MediaAggregate{Media: media}
	videoAsset, err := r.findVideoAsset(ctx, media.ID)
	if err != nil && !errors.Is(err, apperrors.ErrNotFound) {
		return nil, err
	}
	if err == nil {
		aggregate.VideoAsset = videoAsset
		variants, err := r.listVideoVariants(ctx, videoAsset.ID)
		if err != nil {
			return nil, err
		}
		aggregate.Variants = variants
	}
	thumbnails, err := r.listThumbnails(ctx, media.ID)
	if err != nil {
		return nil, err
	}
	aggregate.Thumbnails = thumbnails
	return aggregate, nil
}

func (r *Repository) CreatePlaybackGrant(ctx context.Context, viewerID, mediaID string, req CreatePlaybackGrantRequest, expiresAt time.Time) (*model.PlaybackAccessGrant, *model.MediaFile, error) {
	media, err := r.FindAccessibleMedia(ctx, viewerID, mediaID)
	if err != nil {
		return nil, nil, err
	}
	grantID := uuid.NewString()
	tokenHash := uuid.NewString()
	const query = `
		INSERT INTO playback_access_grants (
			id, media_file_id, viewer_user_id, grant_token_hash, reason, status, max_views, used_views, expires_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, 0, $7, NOW())
		RETURNING id, media_file_id, viewer_user_id, grant_token_hash, reason, status, max_views, used_views, expires_at,
		          consumed_at, created_at, updated_at`
	grant, err := scanPlaybackGrant(r.db.QueryRow(ctx, query, grantID, mediaID, viewerID, tokenHash, req.Reason, req.MaxViews, expiresAt))
	if err != nil {
		return nil, nil, err
	}
	return grant, media, nil
}

func (r *Repository) ConsumePlaybackGrant(ctx context.Context, grantID, viewerID, bucket, objectKey string) (*model.MediaFile, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	const query = `
		SELECT pag.id, pag.media_file_id, pag.viewer_user_id, pag.grant_token_hash, pag.reason, pag.status,
		       pag.max_views, pag.used_views, pag.expires_at, pag.consumed_at, pag.created_at, pag.updated_at,
		       m.id, m.owner_id, COALESCE(m.kind, 'DOCUMENT') AS kind, m.storage_provider, m.bucket, m.object_key,
		       m.original_name, m.mime_type, m.size_bytes, m.checksum_sha256, m.status, m.is_encrypted,
		       m.created_at, m.updated_at, m.deleted_at
		FROM playback_access_grants pag
		JOIN media_files m ON m.id = pag.media_file_id
		WHERE pag.id = $1
		  AND pag.viewer_user_id = $2
		FOR UPDATE`
	row := tx.QueryRow(ctx, query, grantID, viewerID)

	var grant model.PlaybackAccessGrant
	var media model.MediaFile
	var grantStatus string
	var mediaStatus string
	var mediaKind string
	var provider string
	if err := row.Scan(
		&grant.ID,
		&grant.MediaFileID,
		&grant.ViewerUserID,
		&grant.GrantTokenHash,
		&grant.Reason,
		&grantStatus,
		&grant.MaxViews,
		&grant.UsedViews,
		&grant.ExpiresAt,
		&grant.ConsumedAt,
		&grant.CreatedAt,
		&grant.UpdatedAt,
		&media.ID,
		&media.OwnerID,
		&mediaKind,
		&provider,
		&media.Bucket,
		&media.ObjectKey,
		&media.OriginalName,
		&media.MimeType,
		&media.SizeBytes,
		&media.ChecksumSHA256,
		&mediaStatus,
		&media.IsEncrypted,
		&media.CreatedAt,
		&media.UpdatedAt,
		&media.DeletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	grant.Status = enums.PlaybackGrantStatus(grantStatus)
	media.Kind = enums.MediaKind(mediaKind)
	media.StorageProvider = enums.StorageProvider(provider)
	media.Status = enums.MediaStatus(mediaStatus)

	if grant.Status != enums.PlaybackGrantActive {
		return nil, apperrors.New(410, "media.playback_grant_inactive", "Playback grant is no longer active")
	}
	if grant.ExpiresAt.Before(time.Now().UTC()) {
		if _, err := tx.Exec(ctx, `
			UPDATE playback_access_grants
			SET status = 'EXPIRED', updated_at = NOW()
			WHERE id = $1
		`, grantID); err != nil {
			return nil, err
		}
		return nil, apperrors.New(410, "media.playback_grant_expired", "Playback grant has expired")
	}
	allowedObject, err := r.playbackObjectAllowed(ctx, media.ID, media.Bucket, media.ObjectKey, bucket, objectKey)
	if err != nil {
		return nil, err
	}
	if !allowedObject {
		return nil, apperrors.ErrForbidden
	}
	if grant.MaxViews != nil && grant.UsedViews >= *grant.MaxViews {
		if _, err := tx.Exec(ctx, `
			UPDATE playback_access_grants
			SET status = 'CONSUMED', updated_at = NOW()
			WHERE id = $1
		`, grantID); err != nil {
			return nil, err
		}
		return nil, apperrors.New(410, "media.playback_grant_consumed", "Playback grant has already been consumed")
	}

	newUsedViews := grant.UsedViews + 1
	newStatus := "ACTIVE"
	if grant.MaxViews != nil && newUsedViews >= *grant.MaxViews {
		newStatus = "CONSUMED"
	}
	if _, err := tx.Exec(ctx, `
		UPDATE playback_access_grants
		SET used_views = $2,
		    status = $3::"PlaybackGrantStatus",
		    consumed_at = CASE WHEN $3::text = 'CONSUMED' THEN NOW() ELSE consumed_at END,
		    updated_at = NOW()
		WHERE id = $1
	`, grantID, newUsedViews, newStatus); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &media, nil
}

func (r *Repository) playbackObjectAllowed(ctx context.Context, mediaID, mediaBucket, originalObjectKey, requestedBucket, requestedObjectKey string) (bool, error) {
	if mediaBucket != requestedBucket {
		return false, nil
	}
	if originalObjectKey == requestedObjectKey {
		return true, nil
	}
	const query = `
		SELECT EXISTS (
			SELECT 1
			FROM video_assets va
			LEFT JOIN video_variants vv ON vv.video_asset_id = va.id
			WHERE va.media_file_id = $1
			  AND (
			    va.master_playlist_key = $2
			    OR va.preview_playlist_key = $2
			    OR va.poster_object_key = $2
			    OR vv.playlist_object_key = $2
			    OR vv.init_segment_key = $2
			    OR ($2 LIKE COALESCE(vv.segment_prefix, '') || '%' AND COALESCE(vv.segment_prefix, '') <> '')
			  )
		)`
	var exists bool
	if err := r.db.QueryRow(ctx, query, mediaID, requestedObjectKey).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func scanUploadSession(row interface{ Scan(dest ...any) error }) (*model.UploadSession, error) {
	var item model.UploadSession
	var purpose string
	var status string
	if err := row.Scan(
		&item.ID,
		&item.OwnerID,
		&item.MediaFileID,
		&purpose,
		&status,
		&item.Bucket,
		&item.ObjectKey,
		&item.FileName,
		&item.MimeType,
		&item.SizeBytes,
		&item.PartSizeBytes,
		&item.TotalParts,
		&item.MultipartUploadID,
		&item.CompletedAt,
		&item.AbortedAt,
		&item.ExpiresAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	item.Purpose = enums.UploadPurpose(purpose)
	item.Status = enums.UploadSessionStatus(status)
	return &item, nil
}

func scanProcessingJob(row interface{ Scan(dest ...any) error }) (*model.ProcessingJob, error) {
	var item model.ProcessingJob
	var jobType string
	var status string
	if err := row.Scan(
		&item.ID,
		&item.QueueName,
		&jobType,
		&status,
		&item.MediaFileID,
		&item.UploadSessionID,
		&item.VideoAssetID,
		&item.PayloadJSON,
		&item.Attempts,
		&item.MaxAttempts,
		&item.LastError,
		&item.ReservedAt,
		&item.StartedAt,
		&item.FinishedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	item.JobType = enums.ProcessingJobType(jobType)
	item.Status = enums.ProcessingJobStatus(status)
	return &item, nil
}

func scanMedia(row interface{ Scan(dest ...any) error }) (*model.MediaFile, error) {
	var item model.MediaFile
	var provider string
	var status string
	var kind string
	if err := row.Scan(
		&item.ID,
		&item.OwnerID,
		&kind,
		&provider,
		&item.Bucket,
		&item.ObjectKey,
		&item.OriginalName,
		&item.MimeType,
		&item.SizeBytes,
		&item.ChecksumSHA256,
		&status,
		&item.IsEncrypted,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.DeletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	item.Kind = enums.MediaKind(kind)
	item.StorageProvider = enums.StorageProvider(provider)
	item.Status = enums.MediaStatus(status)
	return &item, nil
}

func (r *Repository) findVideoAsset(ctx context.Context, mediaID string) (*model.VideoAsset, error) {
	const query = `
		SELECT id, media_file_id, status, master_playlist_key, preview_playlist_key, poster_object_key,
		       duration_millis, width, height, video_codec, audio_codec, created_at, updated_at, ready_at, failed_at
		FROM video_assets
		WHERE media_file_id = $1
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, mediaID)
	var item model.VideoAsset
	var status string
	if err := row.Scan(
		&item.ID,
		&item.MediaFileID,
		&status,
		&item.MasterPlaylistKey,
		&item.PreviewPlaylistKey,
		&item.PosterObjectKey,
		&item.DurationMillis,
		&item.Width,
		&item.Height,
		&item.VideoCodec,
		&item.AudioCodec,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.ReadyAt,
		&item.FailedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	item.Status = enums.VideoAssetStatus(status)
	return &item, nil
}

func (r *Repository) listVideoVariants(ctx context.Context, videoAssetID string) ([]model.VideoVariant, error) {
	const query = `
		SELECT id, video_asset_id, label, status, playlist_object_key, init_segment_key, segment_prefix,
		       container, video_codec, audio_codec, width, height, bitrate_kbps, frame_rate, duration_millis,
		       size_bytes, created_at, updated_at
		FROM video_variants
		WHERE video_asset_id = $1
		ORDER BY bitrate_kbps ASC NULLS LAST, label ASC`
	rows, err := r.db.Query(ctx, query, videoAssetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.VideoVariant, 0)
	for rows.Next() {
		var item model.VideoVariant
		var status string
		if err := rows.Scan(
			&item.ID,
			&item.VideoAssetID,
			&item.Label,
			&status,
			&item.PlaylistObjectKey,
			&item.InitSegmentKey,
			&item.SegmentPrefix,
			&item.Container,
			&item.VideoCodec,
			&item.AudioCodec,
			&item.Width,
			&item.Height,
			&item.BitrateKbps,
			&item.FrameRate,
			&item.DurationMillis,
			&item.SizeBytes,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		item.Status = enums.VideoVariantStatus(status)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) listThumbnails(ctx context.Context, mediaID string) ([]model.MediaThumbnail, error) {
	const query = `
		SELECT id, media_file_id, bucket, object_key, mime_type, width, height, size_bytes, created_at
		FROM media_thumbnails
		WHERE media_file_id = $1
		ORDER BY width ASC, height ASC`
	rows, err := r.db.Query(ctx, query, mediaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.MediaThumbnail, 0)
	for rows.Next() {
		var item model.MediaThumbnail
		if err := rows.Scan(
			&item.ID,
			&item.MediaFileID,
			&item.Bucket,
			&item.ObjectKey,
			&item.MimeType,
			&item.Width,
			&item.Height,
			&item.SizeBytes,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func scanPlaybackGrant(row interface{ Scan(dest ...any) error }) (*model.PlaybackAccessGrant, error) {
	var item model.PlaybackAccessGrant
	var status string
	if err := row.Scan(
		&item.ID,
		&item.MediaFileID,
		&item.ViewerUserID,
		&item.GrantTokenHash,
		&item.Reason,
		&status,
		&item.MaxViews,
		&item.UsedViews,
		&item.ExpiresAt,
		&item.ConsumedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	item.Status = enums.PlaybackGrantStatus(status)
	return &item, nil
}

func detectMediaKind(mimeType string) enums.MediaKind {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return enums.MediaKindImage
	case strings.HasPrefix(mimeType, "video/"):
		return enums.MediaKindVideo
	case strings.HasPrefix(mimeType, "audio/"):
		return enums.MediaKindAudio
	default:
		return enums.MediaKindDocument
	}
}

func normalizePartSize(requested, fallback, sizeBytes int64) int64 {
	partSize := requested
	if partSize <= 0 {
		partSize = fallback
	}
	if partSize <= 0 {
		partSize = 8 * 1024 * 1024
	}
	if partSize > sizeBytes && sizeBytes > 0 {
		partSize = sizeBytes
	}
	return partSize
}

func calculateTotalParts(sizeBytes, partSize int64) int {
	if sizeBytes <= 0 || partSize <= 0 {
		return 1
	}
	return int(math.Ceil(float64(sizeBytes) / float64(partSize)))
}
