package media

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/queue"
	"github.com/gapak/backend/internal/platform/storage"
)

type Service struct {
	repo    *Repository
	storage storage.Service
	queue   *queue.RedisQueue
	config  config.Config
}

func NewService(repo *Repository, signer storage.Service, q *queue.RedisQueue, cfg config.Config) *Service {
	return &Service{
		repo:    repo,
		storage: signer,
		queue:   q,
		config:  cfg,
	}
}

func (s *Service) CreateUploadSession(ctx context.Context, ownerID string, req CreateUploadSessionRequest) (UploadSessionResponse, error) {
	req, err := s.normalizeUploadRequest(req)
	if err != nil {
		return UploadSessionResponse{}, err
	}
	purpose := enums.UploadPurpose(req.Purpose)
	objectKey := s.storage.BuildObjectKey(ownerID, purpose, req.FileName)
	partSize := normalizePartSize(req.PartSizeBytes, s.config.Storage.MultipartPartSizeBytes, req.SizeBytes)
	if !req.Multipart {
		partSize = req.SizeBytes
	}
	totalParts := calculateTotalParts(req.SizeBytes, partSize)
	kind := detectMediaKind(req.MimeType)

	session, err := s.repo.CreateUploadSession(
		ctx,
		ownerID,
		s.storageProvider(),
		s.config.Storage.Bucket,
		req,
		purpose,
		kind,
		objectKey,
		partSize,
		totalParts,
		time.Now().UTC().Add(s.config.Storage.UploadIntentTTL),
	)
	if err != nil {
		return UploadSessionResponse{}, err
	}

	return s.toUploadSessionResponse(session, min(totalParts, 3)), nil
}

func (s *Service) GetUploadSession(ctx context.Context, ownerID, sessionID string) (UploadSessionResponse, error) {
	session, err := s.repo.FindUploadSession(ctx, ownerID, sessionID)
	if err != nil {
		return UploadSessionResponse{}, err
	}
	return s.toUploadSessionResponse(session, 0), nil
}

func (s *Service) RequestUploadPart(ctx context.Context, ownerID, sessionID string, req RequestUploadPartRequest) (UploadPartGrantResponse, error) {
	session, err := s.repo.FindUploadSession(ctx, ownerID, sessionID)
	if err != nil {
		return UploadPartGrantResponse{}, err
	}
	if err := s.ensureUploadSessionActive(session); err != nil {
		return UploadPartGrantResponse{}, err
	}
	if req.PartNumber > session.TotalParts {
		return UploadPartGrantResponse{}, apperrors.New(400, "media.part_number_out_of_range", "Requested upload part exceeds total parts for this session")
	}

	return UploadPartGrantResponse{
		PartNumber: req.PartNumber,
		Request: s.toSignedRequest(s.storage.PresignUploadPart(storage.UploadPartRequest{
			Bucket:          session.Bucket,
			ObjectKey:       session.ObjectKey,
			UploadSessionID: session.ID,
			PartNumber:      req.PartNumber,
			ContentType:     session.MimeType,
			ExpiresAt:       time.Now().UTC().Add(s.config.Storage.SignedURLTTL),
		})),
	}, nil
}

func (s *Service) CompleteUploadSession(ctx context.Context, ownerID, sessionID string, req CompleteUploadSessionRequest) (UploadSessionResponse, error) {
	session, err := s.repo.FindUploadSession(ctx, ownerID, sessionID)
	if err != nil {
		return UploadSessionResponse{}, err
	}
	if err := s.ensureUploadSessionActive(session); err != nil {
		return UploadSessionResponse{}, err
	}
	if err := s.validateCompletedParts(session, req.Parts); err != nil {
		return UploadSessionResponse{}, err
	}
	if err := s.FinalizeUploadedObject(session, req.Parts); err != nil {
		return UploadSessionResponse{}, err
	}

	session, err = s.repo.CompleteUploadSession(ctx, ownerID, sessionID, req.Parts)
	if err != nil {
		return UploadSessionResponse{}, err
	}

	jobType, queueName := s.processingPlan(enums.UploadPurpose(session.Purpose))
	job, err := s.repo.CreateProcessingJob(ctx, queueName, jobType, session.MediaFileID, session.ID, map[string]any{
		"purpose":     session.Purpose,
		"mediaFileId": session.MediaFileID,
		"objectKey":   session.ObjectKey,
		"mimeType":    session.MimeType,
		"totalParts":  session.TotalParts,
	})
	if err != nil {
		return UploadSessionResponse{}, err
	}

	if s.queue != nil {
		if err := s.queue.Publish(ctx, queueName, queue.Envelope{
			ID:          job.ID,
			Type:        string(job.JobType),
			ResourceID:  session.MediaFileID,
			ResourceRef: session.ID,
			Payload:     json.RawMessage(job.PayloadJSON),
			QueuedAt:    time.Now().UTC(),
		}); err != nil {
			// PostgreSQL is the source of truth for processing jobs; Redis is only the fast dispatch path.
		}
	}

	return s.toUploadSessionResponse(session, 0), nil
}

func (s *Service) AbortUploadSession(ctx context.Context, ownerID, sessionID string) (AcceptedResponse, error) {
	session, err := s.repo.FindUploadSession(ctx, ownerID, sessionID)
	if err != nil {
		return AcceptedResponse{}, err
	}
	if session.Status == enums.UploadSessionCompleted || session.Status == enums.UploadSessionAborted || session.Status == enums.UploadSessionExpired {
		return AcceptedResponse{}, apperrors.New(409, "media.upload_session_finalized", "Upload session is already finalized")
	}
	if err := s.repo.AbortUploadSession(ctx, ownerID, sessionID); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) GetAsset(ctx context.Context, viewerID, mediaID string) (MediaAssetResponse, error) {
	aggregate, err := s.repo.GetAggregate(ctx, viewerID, mediaID)
	if err != nil {
		return MediaAssetResponse{}, err
	}
	return s.toMediaAssetResponse(viewerID, aggregate), nil
}

func (s *Service) CreatePlaybackGrant(ctx context.Context, viewerID, mediaID string, req CreatePlaybackGrantRequest) (PlaybackGrantResponse, error) {
	mediaFile, err := s.repo.FindAccessibleMedia(ctx, viewerID, mediaID)
	if err != nil {
		return PlaybackGrantResponse{}, err
	}
	if mediaFile.Status != enums.MediaReady {
		return PlaybackGrantResponse{}, apperrors.New(409, "media.not_ready", "Media is not ready for playback")
	}
	grant, mediaFile, err := s.repo.CreatePlaybackGrant(ctx, viewerID, mediaID, req, time.Now().UTC().Add(s.config.Storage.PlaybackGrantTTL))
	if err != nil {
		return PlaybackGrantResponse{}, err
	}
	response := PlaybackGrantResponse{
		ID:        grant.ID,
		Status:    string(grant.Status),
		MaxViews:  grant.MaxViews,
		UsedViews: grant.UsedViews,
		ExpiresAt: grant.ExpiresAt,
		Request: s.toSignedRequest(s.storage.PresignPlayback(storage.PlaybackRequest{
			Bucket:       mediaFile.Bucket,
			ObjectKey:    mediaFile.ObjectKey,
			ViewerUserID: viewerID,
			GrantID:      grant.ID,
			ExpiresAt:    grant.ExpiresAt,
		})),
	}
	if strings.HasPrefix(mediaFile.MimeType, "video/") {
		if aggregate, err := s.repo.GetAggregate(ctx, viewerID, mediaID); err == nil && aggregate.VideoAsset != nil {
			hasHLSVariants := false
			response.VariantRequests = map[string]SignedRequestResponse{}
			for _, variant := range aggregate.Variants {
				if variant.Status != enums.VideoVariantReady || strings.TrimSpace(variant.PlaylistObjectKey) == "" {
					continue
				}
				if strings.HasSuffix(strings.ToLower(variant.PlaylistObjectKey), ".m3u8") {
					hasHLSVariants = true
				}
				response.VariantRequests[variant.Label] = s.toSignedRequest(s.storage.PresignPlayback(storage.PlaybackRequest{
					Bucket:       mediaFile.Bucket,
					ObjectKey:    variant.PlaylistObjectKey,
					ViewerUserID: viewerID,
					GrantID:      grant.ID,
					ExpiresAt:    grant.ExpiresAt,
				}))
			}
			if len(response.VariantRequests) == 0 {
				response.VariantRequests = nil
			}
			if hasHLSVariants && aggregate.VideoAsset.MasterPlaylistKey != nil && strings.TrimSpace(*aggregate.VideoAsset.MasterPlaylistKey) != "" {
				adaptive := s.toSignedRequest(s.storage.PresignPlayback(storage.PlaybackRequest{
					Bucket:       mediaFile.Bucket,
					ObjectKey:    *aggregate.VideoAsset.MasterPlaylistKey,
					ViewerUserID: viewerID,
					GrantID:      grant.ID,
					ExpiresAt:    grant.ExpiresAt,
				}))
				response.AdaptiveRequest = &adaptive
			}
		}
	}
	return response, nil
}

func (s *Service) CreateIntent(ctx context.Context, ownerID string, req CreateUploadIntentRequest) (UploadIntentResponse, error) {
	if req.Purpose == "" {
		req.Purpose = string(enums.UploadPurposePostAttachment)
	}
	return s.CreateUploadSession(ctx, ownerID, req)
}

func (s *Service) Access(ctx context.Context, ownerID, mediaID string) (UploadIntentResponse, error) {
	aggregate, err := s.repo.GetAggregate(ctx, ownerID, mediaID)
	if err != nil {
		return UploadIntentResponse{}, err
	}
	response := UploadIntentResponse{
		ID:          aggregate.Media.ID,
		MediaFileID: aggregate.Media.ID,
		Purpose:     string(enums.UploadPurposePostAttachment),
		Status:      string(aggregate.Media.Status),
		Bucket:      aggregate.Media.Bucket,
		ObjectKey:   aggregate.Media.ObjectKey,
		FileName:    deref(aggregate.Media.OriginalName),
		MimeType:    aggregate.Media.MimeType,
		SizeBytes:   aggregate.Media.SizeBytes,
		ExpiresAt:   time.Now().UTC().Add(s.config.Storage.SignedURLTTL),
	}
	return response, nil
}

func (s *Service) Finalize(ctx context.Context, ownerID, sessionID string, req FinalizeUploadRequest) (AcceptedResponse, error) {
	_, err := s.CompleteUploadSession(ctx, ownerID, sessionID, req)
	if err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) processingPlan(purpose enums.UploadPurpose) (enums.ProcessingJobType, string) {
	switch purpose {
	case enums.UploadPurposeClip:
		return enums.ProcessingJobVideoTranscode, s.config.Queue.MediaProcessingQueue
	case enums.UploadPurposeStory:
		return enums.ProcessingJobStoryOptimize, s.config.Queue.StoryProcessingQueue
	case enums.UploadPurposeLiveReplay:
		return enums.ProcessingJobLiveReplayFinalize, s.config.Queue.LiveReplayQueue
	default:
		return enums.ProcessingJobMediaAnalyze, s.config.Queue.MediaProcessingQueue
	}
}

func (s *Service) storageProvider() enums.StorageProvider {
	switch strings.ToUpper(strings.TrimSpace(s.config.Storage.Provider)) {
	case string(enums.StorageProviderMinio):
		return enums.StorageProviderMinio
	case string(enums.StorageProviderLocal):
		return enums.StorageProviderLocal
	default:
		return enums.StorageProviderS3
	}
}

func (s *Service) toUploadSessionResponse(session *model.UploadSession, grantCount int) UploadSessionResponse {
	response := UploadSessionResponse{
		ID:            session.ID,
		MediaFileID:   session.MediaFileID,
		Purpose:       string(session.Purpose),
		Status:        string(session.Status),
		Bucket:        session.Bucket,
		ObjectKey:     session.ObjectKey,
		FileName:      session.FileName,
		MimeType:      session.MimeType,
		SizeBytes:     session.SizeBytes,
		PartSizeBytes: session.PartSizeBytes,
		TotalParts:    session.TotalParts,
		ExpiresAt:     session.ExpiresAt,
	}
	if grantCount > 0 {
		response.PartGrants = make([]UploadPartGrantResponse, 0, grantCount)
		for partNumber := 1; partNumber <= grantCount; partNumber++ {
			response.PartGrants = append(response.PartGrants, UploadPartGrantResponse{
				PartNumber: partNumber,
				Request: s.toSignedRequest(s.storage.PresignUploadPart(storage.UploadPartRequest{
					Bucket:          session.Bucket,
					ObjectKey:       session.ObjectKey,
					UploadSessionID: session.ID,
					PartNumber:      partNumber,
					ContentType:     session.MimeType,
					ExpiresAt:       time.Now().UTC().Add(s.config.Storage.SignedURLTTL),
				})),
			})
		}
	}
	return response
}

func (s *Service) toMediaAssetResponse(viewerID string, aggregate *MediaAggregate) MediaAssetResponse {
	exposeStorageKeys := aggregate.Media.OwnerID == viewerID
	bucket := ""
	objectKey := ""
	if exposeStorageKeys {
		bucket = aggregate.Media.Bucket
		objectKey = aggregate.Media.ObjectKey
	}
	response := MediaAssetResponse{
		ID:           aggregate.Media.ID,
		OwnerID:      aggregate.Media.OwnerID,
		Kind:         string(aggregate.Media.Kind),
		Status:       string(aggregate.Media.Status),
		Bucket:       bucket,
		ObjectKey:    objectKey,
		OriginalName: aggregate.Media.OriginalName,
		MimeType:     aggregate.Media.MimeType,
		SizeBytes:    aggregate.Media.SizeBytes,
		IsEncrypted:  aggregate.Media.IsEncrypted,
		Thumbnails:   make([]ThumbnailResponse, 0, len(aggregate.Thumbnails)),
	}
	for _, item := range aggregate.Thumbnails {
		objectKey := ""
		if exposeStorageKeys {
			objectKey = item.ObjectKey
		}
		response.Thumbnails = append(response.Thumbnails, ThumbnailResponse{
			ID:        item.ID,
			ObjectKey: objectKey,
			MimeType:  item.MimeType,
			Width:     item.Width,
			Height:    item.Height,
			SizeBytes: item.SizeBytes,
		})
	}
	if aggregate.VideoAsset != nil {
		var masterPlaylistKey, previewPlaylistKey, posterObjectKey *string
		if exposeStorageKeys {
			masterPlaylistKey = aggregate.VideoAsset.MasterPlaylistKey
			previewPlaylistKey = aggregate.VideoAsset.PreviewPlaylistKey
			posterObjectKey = aggregate.VideoAsset.PosterObjectKey
		}
		video := &VideoAssetResponse{
			ID:                 aggregate.VideoAsset.ID,
			Status:             string(aggregate.VideoAsset.Status),
			MasterPlaylistKey:  masterPlaylistKey,
			PreviewPlaylistKey: previewPlaylistKey,
			PosterObjectKey:    posterObjectKey,
			DurationMillis:     aggregate.VideoAsset.DurationMillis,
			Width:              aggregate.VideoAsset.Width,
			Height:             aggregate.VideoAsset.Height,
			VideoCodec:         aggregate.VideoAsset.VideoCodec,
			AudioCodec:         aggregate.VideoAsset.AudioCodec,
			Variants:           make([]VideoVariantResponse, 0, len(aggregate.Variants)),
		}
		for _, item := range aggregate.Variants {
			playlistObjectKey := ""
			var initSegmentKey, segmentPrefix *string
			if exposeStorageKeys {
				playlistObjectKey = item.PlaylistObjectKey
				initSegmentKey = item.InitSegmentKey
				segmentPrefix = item.SegmentPrefix
			}
			video.Variants = append(video.Variants, VideoVariantResponse{
				ID:                item.ID,
				Label:             item.Label,
				Status:            string(item.Status),
				PlaylistObjectKey: playlistObjectKey,
				InitSegmentKey:    initSegmentKey,
				SegmentPrefix:     segmentPrefix,
				Container:         item.Container,
				VideoCodec:        item.VideoCodec,
				AudioCodec:        item.AudioCodec,
				Width:             item.Width,
				Height:            item.Height,
				BitrateKbps:       item.BitrateKbps,
				FrameRate:         item.FrameRate,
				DurationMillis:    item.DurationMillis,
			})
		}
		response.VideoAsset = video
	}
	return response
}

func (s *Service) toSignedRequest(request storage.SignedRequest) SignedRequestResponse {
	return SignedRequestResponse{
		Method:    request.Method,
		URL:       request.URL,
		Headers:   request.Headers,
		ExpiresAt: request.ExpiresAt,
	}
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s *Service) normalizeUploadRequest(req CreateUploadSessionRequest) (CreateUploadSessionRequest, error) {
	req.Purpose = strings.ToUpper(strings.TrimSpace(req.Purpose))
	req.FileName = strings.TrimSpace(req.FileName)
	req.MimeType = strings.ToLower(strings.TrimSpace(req.MimeType))
	if req.FileName == "" {
		return CreateUploadSessionRequest{}, apperrors.New(400, "media.file_name_required", "File name is required")
	}
	if req.SizeBytes <= 0 || req.SizeBytes > s.config.Storage.MaxUploadBytes {
		return CreateUploadSessionRequest{}, apperrors.New(400, "media.file_size_invalid", "File size exceeds allowed limits")
	}
	if !s.allowedMimeType(req.MimeType) {
		return CreateUploadSessionRequest{}, apperrors.New(400, "media.mime_type_not_allowed", "MIME type is not allowed")
	}
	if req.PartSizeBytes > 0 && req.PartSizeBytes > s.config.Storage.MaxUploadBytes {
		return CreateUploadSessionRequest{}, apperrors.New(400, "media.part_size_invalid", "Multipart part size exceeds maximum upload size")
	}
	return req, nil
}

func (s *Service) ensureUploadSessionActive(session *model.UploadSession) error {
	if session == nil {
		return apperrors.ErrNotFound
	}
	if session.ExpiresAt.Before(time.Now().UTC()) {
		return apperrors.New(410, "media.upload_session_expired", "Upload session has expired")
	}
	switch session.Status {
	case enums.UploadSessionCompleted, enums.UploadSessionAborted, enums.UploadSessionExpired:
		return apperrors.New(409, "media.upload_session_finalized", "Upload session is already finalized")
	default:
		return nil
	}
}

func (s *Service) validateCompletedParts(session *model.UploadSession, parts []CompletedUploadPart) error {
	if len(parts) == 0 {
		return apperrors.New(400, "media.parts_required", "Completed upload parts are required")
	}
	seen := make(map[int]struct{}, len(parts))
	var totalSize int64
	for _, part := range parts {
		if part.PartNumber < 1 || part.PartNumber > session.TotalParts {
			return apperrors.New(400, "media.part_number_out_of_range", "Completed upload part exceeds total parts for this session")
		}
		if _, ok := seen[part.PartNumber]; ok {
			return apperrors.New(400, "media.duplicate_part_number", "Duplicate upload part numbers are not allowed")
		}
		seen[part.PartNumber] = struct{}{}
		totalSize += part.SizeBytes
	}
	if len(parts) != session.TotalParts {
		return apperrors.New(400, "media.incomplete_parts", "All expected upload parts must be completed before finalization")
	}
	if totalSize > session.SizeBytes {
		return apperrors.New(400, "media.completed_size_invalid", "Completed upload parts exceed declared upload size")
	}
	return nil
}

func (s *Service) allowedMimeType(mimeType string) bool {
	for _, allowed := range s.config.Storage.AllowedMIMETypes {
		if strings.EqualFold(strings.TrimSpace(allowed), mimeType) {
			return true
		}
	}
	return false
}
