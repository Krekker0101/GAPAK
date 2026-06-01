package workers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	"github.com/gapak/backend/internal/platform/queue"
)

type Runner struct {
	cfg    config.Config
	logger zerolog.Logger
	repo   *Repository
	queue  *queue.RedisQueue
}

func NewRunner(cfg config.Config, logger zerolog.Logger, repo *Repository, q *queue.RedisQueue) *Runner {
	return &Runner{
		cfg:    cfg,
		logger: logger,
		repo:   repo,
		queue:  q,
	}
}

func (r *Runner) Run(ctx context.Context) error {
	workers := []struct {
		queueName string
		parallel  int
	}{
		{queueName: r.cfg.Queue.MediaProcessingQueue, parallel: max(1, r.cfg.Worker.MediaProcessingParallel)},
		{queueName: r.cfg.Queue.StoryProcessingQueue, parallel: 1},
		{queueName: r.cfg.Queue.LiveReplayQueue, parallel: 1},
		{queueName: r.cfg.Queue.CleanupQueue, parallel: 1},
	}

	var wg sync.WaitGroup
	for _, worker := range workers {
		for i := 0; i < worker.parallel; i++ {
			wg.Add(1)
			go func(queueName string, workerIndex int) {
				defer wg.Done()
				r.runQueue(ctx, queueName, workerIndex)
			}(worker.queueName, i+1)
		}
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		r.runRealtimeRelay(ctx)
	}()

	<-ctx.Done()
	wg.Wait()
	return nil
}

func (r *Runner) runQueue(ctx context.Context, queueName string, workerIndex int) {
	log := r.logger.With().Str("queue", queueName).Int("workerIndex", workerIndex).Logger()
	if r.queue == nil || !r.queue.Available() {
		log.Warn().Msg("redis queue is unavailable; using database polling fallback")
	}

	for ctx.Err() == nil {
		job, err := r.nextJob(ctx, queueName, log)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Error().Err(err).Msg("job fetch failed")
			continue
		}
		if job == nil {
			continue
		}

		if err := r.handleJob(ctx, job); err != nil {
			if errors.Is(err, ErrJobNotReserved) {
				continue
			}
			log.Error().Err(err).Str("jobId", job.ID).Str("jobType", string(job.JobType)).Msg("job failed")
			_ = r.repo.MarkJobFailed(ctx, job.ID, err.Error())
			continue
		}

		if err := r.repo.MarkJobSucceeded(ctx, job.ID); err != nil {
			log.Error().Err(err).Str("jobId", job.ID).Msg("job succeeded but status update failed")
		}
	}
}

func (r *Runner) runRealtimeRelay(ctx context.Context) {
	log := r.logger.With().Str("component", "realtime_relay").Logger()
	if r.queue == nil || !r.queue.Available() {
		log.Warn().Msg("redis live relay is unavailable; realtime events remain readable from PostgreSQL")
	}

	batchSize := r.cfg.Worker.BatchSize
	if batchSize <= 0 {
		batchSize = 10
	}

	for ctx.Err() == nil {
		if r.queue == nil || !r.queue.Available() {
			if !sleepWithContext(ctx, r.cfg.Worker.PollInterval) {
				return
			}
			continue
		}

		events, err := r.repo.ClaimRealtimeEvents(ctx, batchSize, nowUTC().Add(-r.cfg.Queue.ClaimTTL))
		if err != nil {
			log.Error().Err(err).Msg("realtime event claim failed")
			if !sleepWithContext(ctx, r.cfg.Worker.PollInterval) {
				return
			}
			continue
		}
		if len(events) == 0 {
			if !sleepWithContext(ctx, r.cfg.Worker.PollInterval) {
				return
			}
			continue
		}

		for _, event := range events {
			payload := json.RawMessage(event.PayloadJSON)
			if err := r.queue.PublishLiveEvent(ctx, event.Channel, payload); err != nil {
				log.Error().Err(err).Str("eventId", event.ID).Str("channel", event.Channel).Msg("realtime relay publish failed")
				_ = r.repo.MarkRealtimeEventRelayFailed(ctx, event.ID, err.Error())
				continue
			}
			if err := r.repo.MarkRealtimeEventRelayed(ctx, event.ID); err != nil {
				log.Error().Err(err).Str("eventId", event.ID).Msg("realtime relay status update failed")
			}
		}
	}
}

func (r *Runner) nextJob(ctx context.Context, queueName string, log zerolog.Logger) (*model.ProcessingJob, error) {
	staleBefore := nowUTC().Add(-r.cfg.Queue.ClaimTTL)
	attemptedRedisConsume := false
	redisConsumeFailed := false

	if r.queue != nil && r.queue.Available() {
		attemptedRedisConsume = true
		envelope, err := r.queue.Consume(ctx, queueName, r.cfg.Worker.PollInterval)
		if err != nil {
			redisConsumeFailed = true
			log.Warn().Err(err).Msg("redis queue consume failed; falling back to database polling")
		} else if envelope != nil {
			job, claimErr := r.repo.ClaimJobByID(ctx, envelope.ID, staleBefore)
			if claimErr != nil {
				return nil, claimErr
			}
			if job != nil {
				return job, nil
			}
		}
	}

	job, err := r.repo.ClaimNextProcessingJob(ctx, queueName, staleBefore)
	if err != nil || job != nil {
		return job, err
	}
	if attemptedRedisConsume && !redisConsumeFailed {
		return nil, nil
	}

	timer := time.NewTimer(r.cfg.Worker.PollInterval)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-timer.C:
		return nil, nil
	}
}

func (r *Runner) handleJob(ctx context.Context, job *model.ProcessingJob) error {
	if err := r.repo.MarkJobRunning(ctx, job.ID); err != nil {
		return err
	}

	jobType := job.JobType
	switch jobType {
	case enums.ProcessingJobMediaAnalyze, enums.ProcessingJobVideoTranscode, enums.ProcessingJobThumbnailGenerate:
		return r.processMedia(ctx, job.ID)
	case enums.ProcessingJobStoryOptimize:
		return r.processStory(ctx, job.ID)
	case enums.ProcessingJobLiveReplayFinalize:
		return r.processLiveReplay(ctx, job.ID)
	case enums.ProcessingJobCleanupOrphans:
		return r.repo.ExpireOrphanedUploads(ctx, nowUTC())
	default:
		return fmt.Errorf("unsupported job type %s", job.JobType)
	}
}

func (r *Runner) processMedia(ctx context.Context, jobID string) error {
	job, err := r.repo.FindProcessingJob(ctx, jobID)
	if err != nil {
		return err
	}
	if job.MediaFileID == nil {
		return errors.New("processing job has no media_file_id")
	}

	media, err := r.repo.FindMediaFile(ctx, *job.MediaFileID)
	if err != nil {
		return err
	}

	if err := r.repo.MarkMediaReady(ctx, media.ID); err != nil {
		return err
	}
	if job.UploadSessionID != nil {
		if err := r.repo.FinalizeUploadSession(ctx, *job.UploadSessionID); err != nil {
			return err
		}
	}

	if strings.HasPrefix(media.MimeType, "video/") {
		videoAssetID, err := r.repo.EnsureVideoAsset(ctx, media)
		if err != nil {
			return err
		}
		if err := r.processAdaptiveVideo(ctx, media, videoAssetID); err != nil {
			_ = r.repo.MarkVideoAssetFailed(ctx, videoAssetID)
			return err
		}
	}
	return nil
}

func (r *Runner) processAdaptiveVideo(ctx context.Context, media *model.MediaFile, videoAssetID string) error {
	if !strings.EqualFold(strings.TrimSpace(r.cfg.Storage.Provider), string(enums.StorageProviderLocal)) {
		r.logger.Warn().Str("mediaId", media.ID).Msg("adaptive video transcoding currently requires local storage; original playback remains available")
		return r.repo.MarkVideoAssetReady(ctx, videoAssetID)
	}

	if _, err := exec.LookPath("ffmpeg"); err != nil {
		r.logger.Warn().Str("mediaId", media.ID).Msg("ffmpeg is unavailable; adaptive video variants were skipped and original playback remains available")
		return r.repo.MarkVideoAssetReady(ctx, videoAssetID)
	}

	inputPath, err := r.resolveObjectPath(media.Bucket, media.ObjectKey)
	if err != nil {
		return err
	}
	if _, err := os.Stat(inputPath); err != nil {
		return err
	}

	baseKey := strings.TrimSuffix(media.ObjectKey, filepathExt(media.ObjectKey))
	for _, variant := range videoVariants() {
		outputPath, err := r.resolveObjectPath(media.Bucket, filepath.ToSlash(filepath.Join(baseKey, "variants", variant.label+".mp4")))
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
			return err
		}
		transcodeCtx, cancel := context.WithTimeout(ctx, 20*time.Minute)
		cmd := exec.CommandContext(transcodeCtx,
			"ffmpeg",
			"-y",
			"-i", inputPath,
			"-map", "0:v:0",
			"-map", "0:a?",
			"-sn",
			"-vf", fmt.Sprintf("scale=-2:%d", variant.height),
			"-c:v", "libx264",
			"-preset", "veryfast",
			"-profile:v", "main",
			"-b:v", fmt.Sprintf("%dk", variant.bitrate),
			"-maxrate", fmt.Sprintf("%dk", variant.bitrate),
			"-bufsize", fmt.Sprintf("%dk", variant.bitrate*2),
			"-c:a", "aac",
			"-b:a", "128k",
			"-movflags", "+faststart",
			outputPath,
		)
		output, runErr := cmd.CombinedOutput()
		cancel()
		if runErr != nil {
			return fmt.Errorf("ffmpeg transcode %s: %w: %s", variant.label, runErr, strings.TrimSpace(string(output)))
		}
	}

	if err := r.repo.EnsureDefaultVideoVariants(ctx, videoAssetID, media.ObjectKey); err != nil {
		return err
	}
	return r.repo.MarkVideoAssetReady(ctx, videoAssetID)
}

type videoVariantSpec struct {
	label   string
	width   int
	height  int
	bitrate int
}

func videoVariants() []videoVariantSpec {
	return []videoVariantSpec{
		{label: "240p", width: 426, height: 240, bitrate: 400},
		{label: "360p", width: 640, height: 360, bitrate: 800},
		{label: "480p", width: 854, height: 480, bitrate: 1200},
		{label: "720p", width: 1280, height: 720, bitrate: 2500},
		{label: "1080p", width: 1920, height: 1080, bitrate: 4500},
	}
}

func (r *Runner) resolveObjectPath(bucket, objectKey string) (string, error) {
	root := filepath.Clean(r.cfg.Storage.LocalRootPath)
	baseDir := filepath.Join(root, filepath.Clean(bucket))
	targetPath := filepath.Join(baseDir, filepath.FromSlash(filepath.Clean(objectKey)))
	relative, err := filepath.Rel(baseDir, targetPath)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(relative, "..") {
		return "", fmt.Errorf("object key resolves outside storage root")
	}
	return targetPath, nil
}

func (r *Runner) processStory(ctx context.Context, jobID string) error {
	return r.processMedia(ctx, jobID)
}

func (r *Runner) processLiveReplay(ctx context.Context, jobID string) error {
	return r.processMedia(ctx, jobID)
}

func nowUTC() time.Time {
	return time.Now().UTC()
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func sleepWithContext(ctx context.Context, duration time.Duration) bool {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
