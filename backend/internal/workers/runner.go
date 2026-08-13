package workers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	"github.com/gapak/backend/internal/platform/observability"
	pushplatform "github.com/gapak/backend/internal/platform/push"
	"github.com/gapak/backend/internal/platform/queue"
	"github.com/gapak/backend/internal/platform/storage"
)

type Runner struct {
	cfg       config.Config
	logger    zerolog.Logger
	repo      *Repository
	queue     *queue.RedisQueue
	store     storage.ObjectStore
	ffmpegSem chan struct{}
	metrics   *observability.Registry
	push      *pushplatform.Dispatcher
}

func NewRunner(cfg config.Config, logger zerolog.Logger, repo *Repository, q *queue.RedisQueue, store storage.ObjectStore, metrics *observability.Registry, pushDispatcher *pushplatform.Dispatcher) *Runner {
	concurrency := cfg.Storage.FFmpegConcurrency
	if concurrency <= 0 {
		concurrency = 1
	}
	return &Runner{
		cfg:       cfg,
		logger:    logger,
		repo:      repo,
		queue:     q,
		store:     store,
		ffmpegSem: make(chan struct{}, concurrency),
		metrics:   metrics,
		push:      pushDispatcher,
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

	if r.push != nil && r.push.Enabled() {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r.push.Run(ctx, r.cfg.Push.PollInterval, r.cfg.Push.BatchSize)
		}()
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		r.runMediaCleanup(ctx)
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

	consumerID := fmt.Sprintf("%s-%s-%d", r.consumerPrefix(), queueName, workerIndex)

	for ctx.Err() == nil {
		job, ack, err := r.nextJob(ctx, queueName, consumerID, log)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Error().Err(err).Msg("job fetch failed")
			continue
		}
		if job == nil {
			if r.metrics != nil {
				r.metrics.WorkerQueueDepth.Set(observability.Label("queue", queueName), 0)
			}
			continue
		}
		if r.metrics != nil && r.queue != nil && r.queue.Available() {
			if depth, e := r.queue.Depth(ctx, queueName); e == nil {
				r.metrics.WorkerQueueDepth.Set(observability.Label("queue", queueName), depth)
			}
		}

		jobCtx, stopLease := context.WithCancel(ctx)
		leaseDone := make(chan struct{})
		go r.renewJobLease(jobCtx, job, log, leaseDone, stopLease)

		started := time.Now()
		err = r.handleJob(jobCtx, job)
		if r.metrics != nil {
			outcome := "success"
			if err != nil {
				outcome = "failure"
			}
			r.metrics.WorkerJobs.Inc(observability.Label("queue", queueName) + observability.Label("outcome", outcome))
			r.metrics.WorkerLatency.Observe(observability.Label("queue", queueName), time.Since(started).Seconds())
		}
		stopLease()
		<-leaseDone

		if err != nil {
			if errors.Is(err, ErrJobNotReserved) {
				if ack != nil {
					_ = ack()
				}
				continue
			}
			log.Error().Err(err).Str("jobId", job.ID).Str("jobType", string(job.JobType)).Msg("job failed")
			_ = r.repo.MarkJobFailed(ctx, job.ID, valueOrEmpty(job.LeaseToken), err.Error())
			if r.metrics != nil {
				r.metrics.WorkerJobs.Inc(observability.Label("queue", queueName) + observability.Label("outcome", "retry_or_dead"))
			}
			continue
		}

		if err := r.repo.MarkJobSucceeded(ctx, job.ID, valueOrEmpty(job.LeaseToken)); err != nil {
			log.Error().Err(err).Str("jobId", job.ID).Msg("job succeeded but status update failed")
		}
		if ack != nil {
			_ = ack()
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
				_ = r.repo.MarkRealtimeEventRelayFailed(ctx, event.ID, valueOrEmpty(event.RelayLeaseToken), err.Error())
				continue
			}
			if err := r.repo.MarkRealtimeEventRelayed(ctx, event.ID, valueOrEmpty(event.RelayLeaseToken)); err != nil {
				log.Error().Err(err).Str("eventId", event.ID).Msg("realtime relay status update failed")
			}
		}
	}
}

func (r *Runner) nextJob(ctx context.Context, queueName, consumerID string, log zerolog.Logger) (*model.ProcessingJob, func() error, error) {
	staleBefore := nowUTC().Add(-r.cfg.Queue.ClaimTTL)
	attemptedRedisConsume := false
	redisConsumeFailed := false

	if r.queue != nil && r.queue.Available() {
		attemptedRedisConsume = true
		delivery, err := r.queue.Consume(ctx, queueName, r.cfg.Worker.PollInterval, consumerID)
		if err != nil {
			redisConsumeFailed = true
			log.Warn().Err(err).Msg("redis queue consume failed; falling back to database polling")
		} else if delivery != nil {
			job, claimErr := r.repo.ClaimJobByID(ctx, delivery.ID, staleBefore)
			if claimErr != nil {
				return nil, delivery.Ack, claimErr
			}
			if job != nil {
				return job, delivery.Ack, nil
			}
			// Stale notification (e.g. job already running or dead). Ack and fall through to DB polling.
			_ = delivery.Ack()
		}
	}

	job, err := r.repo.ClaimNextProcessingJob(ctx, queueName, staleBefore)
	if err != nil || job != nil {
		return job, nil, err
	}
	if attemptedRedisConsume && !redisConsumeFailed {
		return nil, nil, nil
	}

	timer := time.NewTimer(r.cfg.Worker.PollInterval)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return nil, nil, ctx.Err()
	case <-timer.C:
		return nil, nil, nil
	}
}

func (r *Runner) renewJobLease(ctx context.Context, job *model.ProcessingJob, log zerolog.Logger, done chan<- struct{}, cancel context.CancelFunc) {
	defer close(done)
	leaseToken := valueOrEmpty(job.LeaseToken)
	if leaseToken == "" {
		return
	}
	interval := r.cfg.Queue.ClaimTTL / 3
	if interval < time.Second {
		interval = time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := r.repo.RenewJobLease(ctx, job.ID, leaseToken); err != nil {
				log.Error().Err(err).Str("jobId", job.ID).Msg("job lease renewal failed; cancelling job")
				cancel()
				return
			}
		}
	}
}

func (r *Runner) handleJob(ctx context.Context, job *model.ProcessingJob) error {
	if err := r.repo.MarkJobRunning(ctx, job.ID, valueOrEmpty(job.LeaseToken)); err != nil {
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
		return r.reconcileMedia(ctx)
	default:
		return fmt.Errorf("unsupported job type %s", job.JobType)
	}
}

func (r *Runner) processMedia(ctx context.Context, jobID string) error {
	started := time.Now()
	defer func() {
		if r.metrics != nil {
			r.metrics.MediaLatency.Observe(observability.Label("pipeline", "media"), time.Since(started).Seconds())
		}
	}()
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

	if strings.HasPrefix(media.MimeType, "video/") {
		videoAssetID, err := r.repo.EnsureVideoAsset(ctx, media)
		if err != nil {
			return err
		}
		if err := r.processAdaptiveVideo(ctx, media, videoAssetID); err != nil {
			if r.metrics != nil {
				r.metrics.MediaEvents.Inc(observability.Label("event", "ffmpeg_failure"))
			}
			_ = r.repo.MarkVideoAssetFailed(ctx, videoAssetID)
			_ = r.repo.MarkMediaFailed(ctx, media.ID)
			return err
		}
	}
	if r.metrics != nil {
		r.metrics.MediaEvents.Inc(observability.Label("event", "processed"))
	}
	if err := r.repo.MarkMediaReady(ctx, media.ID); err != nil {
		return err
	}
	if job.UploadSessionID != nil {
		if err := r.repo.FinalizeUploadSession(ctx, *job.UploadSessionID); err != nil {
			return err
		}
	}
	return nil
}

func (r *Runner) processAdaptiveVideo(ctx context.Context, media *model.MediaFile, videoAssetID string) error {
	if !strings.EqualFold(strings.TrimSpace(r.cfg.Storage.Provider), string(enums.StorageProviderLocal)) {
		// Marking a video READY without producing its advertised HLS assets would
		// create a silent production data-integrity failure. Until the object-store
		// processing path is explicitly implemented, fail the job and let the
		// retry/dead-letter policy handle it deterministically.
		return fmt.Errorf("adaptive video transcoding is not available for storage provider %q", r.cfg.Storage.Provider)
	}

	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return fmt.Errorf("ffmpeg is required for secure video processing")
	}

	inputPath, err := r.resolveObjectPath(media.Bucket, media.ObjectKey)
	if err != nil {
		return err
	}
	if _, err := os.Stat(inputPath); err != nil {
		return err
	}

	baseKey := strings.TrimSuffix(media.ObjectKey, filepathExt(media.ObjectKey))
	info, err := r.probeVideo(ctx, inputPath)
	if err != nil {
		return fmt.Errorf("media probe failed: %w", err)
	}
	if r.cfg.Storage.FFmpegMaxDuration > 0 && info.durationMillis > int(r.cfg.Storage.FFmpegMaxDuration/time.Millisecond) {
		return fmt.Errorf("media duration exceeds configured limit")
	}
	if info.width == 0 || info.height == 0 {
		info.width = 1920
		info.height = 1080
	}
	if info.videoCodec == "" {
		info.videoCodec = "h264"
	}
	if info.audioCodec == "" {
		info.audioCodec = "aac"
	}
	if info.durationMillis <= 0 {
		return fmt.Errorf("media duration could not be determined")
	}

	if err := r.repo.UpdateVideoAsset(ctx, videoAssetID, info.width, info.height, info.durationMillis, info.videoCodec, info.audioCodec); err != nil {
		return err
	}

	variants := selectVideoVariants(videoVariants(), info.height)
	if len(variants) == 0 {
		return r.repo.MarkVideoAssetReady(ctx, videoAssetID)
	}

	for _, variant := range variants {
		select {
		case r.ffmpegSem <- struct{}{}:
		case <-ctx.Done():
			return ctx.Err()
		}
		variantDir, err := r.resolveObjectPath(media.Bucket, filepath.ToSlash(filepath.Join(baseKey, "variants", variant.label)))
		if err != nil {
			<-r.ffmpegSem
			return err
		}
		if err := os.MkdirAll(variantDir, 0o755); err != nil {
			<-r.ffmpegSem
			return err
		}

		playlistFile := filepath.Join(variantDir, "index.m3u8")
		segmentPattern := filepath.Join(variantDir, "segment_%03d.ts")
		transcodeCtx, cancel := context.WithTimeout(ctx, r.cfg.Storage.FFmpegTimeout)
		args := []string{
			"-hide_banner", "-loglevel", "error",
			"-threads", strconv.Itoa(max(1, r.cfg.Storage.FFmpegThreads)),
			"-filter_threads", strconv.Itoa(max(1, r.cfg.Storage.FFmpegThreads)),
			"-filter_complex_threads", strconv.Itoa(max(1, r.cfg.Storage.FFmpegThreads)),
			"-timelimit", strconv.Itoa(max(1, int(r.cfg.Storage.FFmpegTimeout.Seconds()))),
			"-y", "-i", inputPath,
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
			"-f", "hls",
			"-hls_time", "4",
			"-hls_playlist_type", "vod",
			"-hls_segment_filename", segmentPattern,
			"-hls_flags", "independent_segments",
			playlistFile,
		}
		cmd := exec.CommandContext(transcodeCtx, "ffmpeg", args...)
		outputCh := make(chan []byte, 1)
		go func() {
			output, runErr := cmd.CombinedOutput()
			if runErr != nil {
				outputCh <- []byte(runErr.Error() + "\n" + strings.TrimSpace(string(output)))
			} else {
				outputCh <- nil
			}
		}()
		monitorDone := make(chan struct{})
		go func() {
			defer close(monitorDone)
			ticker := time.NewTicker(500 * time.Millisecond)
			defer ticker.Stop()
			for {
				select {
				case <-transcodeCtx.Done():
					return
				case <-ticker.C:
					sz, err := directorySize(variantDir)
					if err == nil && r.cfg.Storage.FFmpegMaxOutputBytes > 0 && sz > r.cfg.Storage.FFmpegMaxOutputBytes {
						cancel()
						return
					}
				}
			}
		}()
		output := <-outputCh
		cancel()
		<-monitorDone
		<-r.ffmpegSem
		if output != nil {
			_ = os.RemoveAll(variantDir)
			return fmt.Errorf("ffmpeg hls %s failed: %s", variant.label, strings.TrimSpace(string(output)))
		}

		playlistKey := filepath.ToSlash(filepath.Join(baseKey, "variants", variant.label, "index.m3u8"))
		segmentPrefix := filepath.ToSlash(filepath.Join(baseKey, "variants", variant.label, "segment_"))
		var variantSize int64
		entries, _ := os.ReadDir(variantDir)
		for _, entry := range entries {
			if fi, err := entry.Info(); err == nil {
				variantSize += fi.Size()
			}
		}

		if err := r.repo.CreateVideoVariant(ctx, CreateVideoVariantParams{
			VideoAssetID:      videoAssetID,
			Label:             variant.label,
			PlaylistObjectKey: playlistKey,
			SegmentPrefix:     segmentPrefix,
			Container:         "hls",
			VideoCodec:        "h264",
			AudioCodec:        "aac",
			Width:             variant.width,
			Height:            variant.height,
			BitrateKbps:       variant.bitrate,
			FrameRate:         30,
			DurationMillis:    info.durationMillis,
			SizeBytes:         variantSize,
		}); err != nil {
			return err
		}
	}

	masterPath, err := r.resolveObjectPath(media.Bucket, baseKey+".m3u8")
	if err != nil {
		return err
	}
	if err := r.writeMasterPlaylist(masterPath, baseKey, variants); err != nil {
		return err
	}
	if err := r.repo.SetVideoAssetMasterPlaylist(ctx, videoAssetID, baseKey+".m3u8"); err != nil {
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

func selectVideoVariants(all []videoVariantSpec, sourceHeight int) []videoVariantSpec {
	var out []videoVariantSpec
	for _, v := range all {
		if v.height <= sourceHeight {
			out = append(out, v)
		}
	}
	if len(out) == 0 {
		return all[:1]
	}
	return out
}

func (r *Runner) writeMasterPlaylist(path, baseKey string, variants []videoVariantSpec) error {
	var buf strings.Builder
	buf.WriteString("#EXTM3U\n")
	buf.WriteString("#EXT-X-VERSION:4\n")
	for _, v := range variants {
		bandwidth := v.bitrate * 1000
		if v.label != "" {
			bandwidth += 128000
		}
		buf.WriteString(fmt.Sprintf("#EXT-X-STREAM-INF:BANDWIDTH=%d,RESOLUTION=%dx%d,CODECS=\"avc1.42c01e,mp4a.40.2\"\n", bandwidth, v.width, v.height))
		buf.WriteString(filepath.ToSlash(filepath.Join(baseKey, "variants", v.label, "index.m3u8")) + "\n")
	}
	return os.WriteFile(path, []byte(buf.String()), 0o644)
}

type ffprobeStream struct {
	Index      int    `json:"index"`
	CodecName  string `json:"codec_name"`
	CodecType  string `json:"codec_type"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	Duration   string `json:"duration"`
	RFrameRate string `json:"r_frame_rate"`
}

type ffprobeFormat struct {
	Duration string `json:"duration"`
}

type ffprobeOutput struct {
	Streams []ffprobeStream `json:"streams"`
	Format  ffprobeFormat   `json:"format"`
}

type videoInfo struct {
	width          int
	height         int
	durationMillis int
	videoCodec     string
	audioCodec     string
}

func (r *Runner) probeVideo(ctx context.Context, inputPath string) (videoInfo, error) {
	if _, err := exec.LookPath("ffprobe"); err != nil {
		return videoInfo{}, fmt.Errorf("ffprobe is required for secure media processing")
	}

	probeCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	cmd := exec.CommandContext(probeCtx, "ffprobe",
		"-v", "error",
		"-print_format", "json",
		"-show_streams",
		"-show_format",
		inputPath,
	)
	out, err := cmd.Output()
	if err != nil {
		return videoInfo{}, err
	}

	var parsed ffprobeOutput
	if err := json.Unmarshal(out, &parsed); err != nil {
		return videoInfo{}, err
	}

	info := videoInfo{}
	for _, s := range parsed.Streams {
		switch s.CodecType {
		case "video":
			info.width = s.Width
			info.height = s.Height
			info.videoCodec = s.CodecName
			if s.Duration != "" {
				if sec, err := strconv.ParseFloat(s.Duration, 64); err == nil {
					info.durationMillis = int(sec * 1000)
				}
			}
		case "audio":
			info.audioCodec = s.CodecName
		}
	}
	if info.durationMillis == 0 && parsed.Format.Duration != "" {
		if sec, err := strconv.ParseFloat(parsed.Format.Duration, 64); err == nil {
			info.durationMillis = int(sec * 1000)
		}
	}
	return info, nil
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

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (r *Runner) consumerPrefix() string {
	hostname, err := os.Hostname()
	if err != nil || hostname == "" {
		hostname = "worker"
	}
	return hostname
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

func directorySize(root string) (int64, error) {
	var total int64
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			total += info.Size()
		}
		return nil
	})
	return total, err
}

func (r *Runner) reconcileMedia(ctx context.Context) error {
	cutoff := nowUTC().Add(-r.cfg.Queue.ClaimTTL)
	if err := r.repo.ExpireOrphanedUploads(ctx, cutoff); err != nil {
		return err
	}
	if err := r.repo.FailStuckProcessingJobs(ctx, cutoff); err != nil {
		return err
	}
	if r.store == nil {
		return nil
	}
	objects, err := r.store.ListObjects(ctx, r.cfg.Storage.Bucket, "", 10000)
	if err != nil {
		return err
	}
	owned, err := r.repo.ListReferencedObjectKeys(ctx, r.cfg.Storage.Bucket, 10000)
	if err != nil {
		return err
	}
	ref := make(map[string]struct{}, len(owned))
	prefixes := make([]string, 0)
	for _, key := range owned {
		ref[key] = struct{}{}
		if strings.HasSuffix(key, "segment_") {
			prefixes = append(prefixes, key)
		}
	}
	orphans := make([]string, 0)
	for _, key := range objects {
		if strings.HasSuffix(key, ".assembling") || strings.Contains(key, ".part.") {
			orphans = append(orphans, key)
			continue
		}
		if _, ok := ref[key]; !ok {
			protected := false
			for _, prefix := range prefixes {
				if strings.HasPrefix(key, prefix) {
					protected = true
					break
				}
			}
			if !protected {
				orphans = append(orphans, key)
			}
		}
	}
	if len(orphans) > 0 {
		return r.store.DeleteObjects(ctx, r.cfg.Storage.Bucket, orphans)
	}
	return nil
}

func (r *Runner) runMediaCleanup(ctx context.Context) {
	interval := r.cfg.Worker.CleanupInterval
	if interval <= 0 {
		interval = 30 * time.Minute
	}
	if err := r.reconcileMedia(ctx); err != nil {
		r.logger.Error().Err(err).Msg("initial media reconciliation failed")
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := r.reconcileMedia(ctx); err != nil {
				r.logger.Error().Err(err).Msg("media reconciliation failed")
			}
		}
	}
}
