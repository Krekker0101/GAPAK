package workers

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

var ErrJobNotReserved = errors.New("processing job is not reserved")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) MarkJobRunning(ctx context.Context, jobID string) error {
	const query = `
		UPDATE processing_jobs
		SET status = 'RUNNING',
		    reserved_at = COALESCE(reserved_at, NOW()),
		    started_at = COALESCE(started_at, NOW()),
		    finished_at = NULL,
		    updated_at = NOW(),
		    last_error = NULL
		WHERE id = $1
		  AND status = 'RESERVED'`
	commandTag, err := r.db.Exec(ctx, query, jobID)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrJobNotReserved
	}
	return nil
}

func (r *Repository) ClaimJobByID(ctx context.Context, jobID string, staleBefore time.Time) (*model.ProcessingJob, error) {
	const query = `
		UPDATE processing_jobs
		SET status = 'RESERVED', reserved_at = NOW(), updated_at = NOW()
		WHERE id = $1
		  AND (
		    status = 'PENDING'
		    OR (status = 'FAILED' AND attempts < max_attempts)
		    OR (status = 'RESERVED' AND (reserved_at IS NULL OR reserved_at < $2))
		  )
		RETURNING id, queue_name, job_type, status, media_file_id, upload_session_id, video_asset_id,
		          payload_json, attempts, max_attempts, last_error, reserved_at, started_at, finished_at, created_at, updated_at`
	job, err := scanProcessingJob(r.db.QueryRow(ctx, query, jobID, staleBefore))
	if errors.Is(err, apperrors.ErrNotFound) {
		return nil, nil
	}
	return job, err
}

func (r *Repository) ClaimNextProcessingJob(ctx context.Context, queueName string, staleBefore time.Time) (*model.ProcessingJob, error) {
	const query = `
		WITH candidate AS (
			SELECT id
			FROM processing_jobs
			WHERE queue_name = $1
			  AND (
			    status = 'PENDING'
			    OR (status = 'FAILED' AND attempts < max_attempts)
			    OR (status = 'RESERVED' AND (reserved_at IS NULL OR reserved_at < $2))
			  )
			ORDER BY created_at ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE processing_jobs pj
		SET status = 'RESERVED', reserved_at = NOW(), updated_at = NOW()
		FROM candidate
		WHERE pj.id = candidate.id
		RETURNING pj.id, pj.queue_name, pj.job_type, pj.status, pj.media_file_id, pj.upload_session_id, pj.video_asset_id,
		          pj.payload_json, pj.attempts, pj.max_attempts, pj.last_error, pj.reserved_at, pj.started_at, pj.finished_at,
		          pj.created_at, pj.updated_at`
	job, err := scanProcessingJob(r.db.QueryRow(ctx, query, queueName, staleBefore))
	if errors.Is(err, apperrors.ErrNotFound) {
		return nil, nil
	}
	return job, err
}

func (r *Repository) MarkJobSucceeded(ctx context.Context, jobID string) error {
	const query = `
		UPDATE processing_jobs
		SET status = 'SUCCEEDED', reserved_at = NULL, finished_at = NOW(), updated_at = NOW(), last_error = NULL
		WHERE id = $1`
	_, err := r.db.Exec(ctx, query, jobID)
	return err
}

func (r *Repository) MarkJobFailed(ctx context.Context, jobID string, errText string) error {
	const query = `
		UPDATE processing_jobs
		SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'DEAD' ELSE 'FAILED' END,
		    attempts = attempts + 1,
		    reserved_at = NULL,
		    finished_at = NOW(),
		    updated_at = NOW(),
		    last_error = $2
		WHERE id = $1`
	_, err := r.db.Exec(ctx, query, jobID, errText)
	return err
}

func (r *Repository) FindProcessingJob(ctx context.Context, jobID string) (*model.ProcessingJob, error) {
	const query = `
		SELECT id, queue_name, job_type, status, media_file_id, upload_session_id, video_asset_id,
		       payload_json, attempts, max_attempts, last_error, reserved_at, started_at, finished_at, created_at, updated_at
		FROM processing_jobs
		WHERE id = $1
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, jobID)

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

func (r *Repository) FindMediaFile(ctx context.Context, mediaID string) (*model.MediaFile, error) {
	const query = `
		SELECT id, owner_id, COALESCE(kind, 'DOCUMENT') AS kind, storage_provider, bucket, object_key, original_name,
		       mime_type, size_bytes, checksum_sha256, status, is_encrypted, created_at, updated_at, deleted_at
		FROM media_files
		WHERE id = $1
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, mediaID)

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

func (r *Repository) MarkMediaReady(ctx context.Context, mediaID string) error {
	const query = `UPDATE media_files SET status = 'READY', updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, mediaID)
	return err
}

func (r *Repository) EnsureVideoAsset(ctx context.Context, media *model.MediaFile) (string, error) {
	const findQuery = `SELECT id FROM video_assets WHERE media_file_id = $1 LIMIT 1`
	var existing string
	if err := r.db.QueryRow(ctx, findQuery, media.ID).Scan(&existing); err == nil {
		return existing, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	videoID := uuid.NewString()
	const createQuery = `
		INSERT INTO video_assets (
			id, media_file_id, status, master_playlist_key, preview_playlist_key, poster_object_key,
			duration_millis, width, height, video_codec, audio_codec, ready_at, updated_at
		)
		VALUES ($1, $2, 'PROCESSING', $3, $4, $5, $6, $7, $8, $9, $10, NULL, NOW())`
	_, err := r.db.Exec(ctx, createQuery,
		videoID,
		media.ID,
		nil,
		nil,
		nil,
		15000,
		1280,
		720,
		"h264",
		"aac",
	)
	if err != nil {
		return "", err
	}
	return videoID, nil
}

func (r *Repository) MarkVideoAssetReady(ctx context.Context, videoAssetID string) error {
	const query = `UPDATE video_assets SET status = 'READY', ready_at = NOW(), failed_at = NULL, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, videoAssetID)
	return err
}

func (r *Repository) MarkVideoAssetFailed(ctx context.Context, videoAssetID string) error {
	const query = `UPDATE video_assets SET status = 'FAILED', failed_at = NOW(), updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, videoAssetID)
	return err
}

func (r *Repository) EnsureDefaultVideoVariants(ctx context.Context, videoAssetID string, objectKey string) error {
	baseKey := strings.TrimSuffix(objectKey, filepathExt(objectKey))
	variants := []struct {
		label   string
		width   int
		height  int
		bitrate int
	}{
		{label: "240p", width: 426, height: 240, bitrate: 400},
		{label: "360p", width: 640, height: 360, bitrate: 800},
		{label: "480p", width: 854, height: 480, bitrate: 1200},
		{label: "720p", width: 1280, height: 720, bitrate: 2500},
		{label: "1080p", width: 1920, height: 1080, bitrate: 4500},
	}
	for _, variant := range variants {
		const query = `
			INSERT INTO video_variants (
				id, video_asset_id, label, status, playlist_object_key, init_segment_key, segment_prefix,
				container, video_codec, audio_codec, width, height, bitrate_kbps, frame_rate, duration_millis, updated_at
			)
			VALUES ($1, $2, $3, 'READY', $4, NULL, NULL, 'mp4', 'h264', 'aac', $5, $6, $7, $8, $9, NOW())
			ON CONFLICT (video_asset_id, label) DO NOTHING`
		if _, err := r.db.Exec(ctx, query,
			uuid.NewString(),
			videoAssetID,
			variant.label,
			baseKey+"/variants/"+variant.label+".mp4",
			variant.width,
			variant.height,
			variant.bitrate,
			30,
			15000,
		); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) FinalizeUploadSession(ctx context.Context, sessionID string) error {
	const query = `
		UPDATE upload_sessions
		SET status = 'COMPLETED', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
		WHERE id = $1`
	_, err := r.db.Exec(ctx, query, sessionID)
	return err
}

func filepathExt(value string) string {
	for i := len(value) - 1; i >= 0; i-- {
		if value[i] == '.' {
			return value[i:]
		}
		if value[i] == '/' {
			break
		}
	}
	return ""
}

func (r *Repository) ExpireOrphanedUploads(ctx context.Context, olderThan time.Time) error {
	const query = `
		UPDATE upload_sessions
		SET status = 'EXPIRED', updated_at = NOW()
		WHERE status IN ('INITIATED', 'PARTIAL')
		  AND expires_at < $1`
	_, err := r.db.Exec(ctx, query, olderThan)
	return err
}

func (r *Repository) ClaimRealtimeEvents(ctx context.Context, batchSize int64, staleBefore time.Time) ([]model.RealtimeEvent, error) {
	const query = `
		WITH candidates AS (
			SELECT id
			FROM realtime_events
			WHERE relay_status IN ('PENDING', 'FAILED')
			   OR (relay_status = 'RESERVED' AND (reserved_at IS NULL OR reserved_at < $2))
			ORDER BY sequence ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE realtime_events re
		SET relay_status = 'RESERVED',
		    reserved_at = NOW(),
		    updated_at = NOW()
		FROM candidates
		WHERE re.id = candidates.id
		RETURNING re.id, re.sequence, re.channel, re.aggregate_type, re.aggregate_id, re.event_type,
		          re.payload_json, re.relay_status, re.relay_attempts, re.last_relay_error,
		          re.reserved_at, re.relayed_at, re.created_at, re.updated_at`
	rows, err := r.db.Query(ctx, query, batchSize, staleBefore)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.RealtimeEvent, 0)
	for rows.Next() {
		item, err := scanRealtimeEvent(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) MarkRealtimeEventRelayed(ctx context.Context, eventID string) error {
	const query = `
		UPDATE realtime_events
		SET relay_status = 'RELAYED',
		    relayed_at = NOW(),
		    reserved_at = NULL,
		    updated_at = NOW(),
		    last_relay_error = NULL
		WHERE id = $1`
	_, err := r.db.Exec(ctx, query, eventID)
	return err
}

func (r *Repository) MarkRealtimeEventRelayFailed(ctx context.Context, eventID string, errText string) error {
	const query = `
		UPDATE realtime_events
		SET relay_status = 'FAILED',
		    relay_attempts = relay_attempts + 1,
		    reserved_at = NULL,
		    updated_at = NOW(),
		    last_relay_error = $2
		WHERE id = $1`
	_, err := r.db.Exec(ctx, query, eventID, errText)
	return err
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

func scanRealtimeEvent(row interface{ Scan(dest ...any) error }) (*model.RealtimeEvent, error) {
	var item model.RealtimeEvent
	if err := row.Scan(
		&item.ID,
		&item.Sequence,
		&item.Channel,
		&item.AggregateType,
		&item.AggregateID,
		&item.EventType,
		&item.PayloadJSON,
		&item.RelayStatus,
		&item.RelayAttempts,
		&item.LastRelayError,
		&item.ReservedAt,
		&item.RelayedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &item, nil
}
