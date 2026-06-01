package posts

import (
	"context"
	"strings"
	"time"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, userID string, req CreatePostRequest) (PostResponse, error) {
	normalized, err := s.normalizeCreateRequest(req)
	if err != nil {
		return PostResponse{}, err
	}
	if err := s.repo.EnsureOwnedMedia(ctx, userID, normalized.MediaFileIDs); err != nil {
		return PostResponse{}, err
	}
	if err := s.validateContentMedia(ctx, userID, normalized.ContentType, normalized.MediaFileIDs); err != nil {
		return PostResponse{}, err
	}
	req = normalized
	post, err := s.repo.Create(ctx, userID, req)
	if err != nil {
		return PostResponse{}, err
	}
	return s.hydrate(ctx, userID, post)
}

func (s *Service) Update(ctx context.Context, userID, postID string, req UpdatePostRequest) (PostResponse, error) {
	existing, err := s.repo.GetOwnedPost(ctx, userID, postID)
	if err != nil {
		return PostResponse{}, err
	}
	existingAudience, err := s.repo.AudienceUserIDs(ctx, postID)
	if err != nil {
		return PostResponse{}, err
	}
	existingMedia, err := s.repo.MediaFileIDs(ctx, postID)
	if err != nil {
		return PostResponse{}, err
	}

	normalized, err := s.normalizeUpdateRequest(existing, existingAudience, existingMedia, req)
	if err != nil {
		return PostResponse{}, err
	}
	if err := s.repo.EnsureOwnedMedia(ctx, userID, normalized.MediaFileIDs); err != nil {
		return PostResponse{}, err
	}
	if err := s.validateContentMedia(ctx, userID, contentTypeValue(normalized.ContentType), normalized.MediaFileIDs); err != nil {
		return PostResponse{}, err
	}

	post, err := s.repo.Update(ctx, userID, postID, normalized)
	if err != nil {
		return PostResponse{}, err
	}
	return s.hydrate(ctx, userID, post)
}

func (s *Service) Delete(ctx context.Context, userID, postID string) (AcceptedResponse, error) {
	if err := s.repo.Delete(ctx, userID, postID); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) Get(ctx context.Context, viewerID, postID string) (PostResponse, error) {
	post, err := s.repo.GetVisiblePost(ctx, viewerID, postID)
	if err != nil {
		return PostResponse{}, err
	}
	return s.hydrate(ctx, viewerID, post)
}

func (s *Service) Feed(ctx context.Context, viewerID string, page, limit int, contentType string) ([]PostResponse, error) {
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = 20
	}
	contentType = strings.ToUpper(strings.TrimSpace(contentType))
	items, err := s.repo.Feed(ctx, viewerID, page, limit, contentType)
	if err != nil {
		return nil, err
	}
	response := make([]PostResponse, 0, len(items))
	for _, item := range items {
		hydrated, err := s.hydrate(ctx, viewerID, &item)
		if err != nil {
			return nil, err
		}
		response = append(response, hydrated)
	}
	return response, nil
}

func (s *Service) hydrate(ctx context.Context, viewerID string, post *model.Post) (PostResponse, error) {
	audience, err := s.repo.AudienceUserIDs(ctx, post.ID)
	if err != nil {
		return PostResponse{}, err
	}
	mediaIDs, err := s.repo.MediaFileIDs(ctx, post.ID)
	if err != nil {
		return PostResponse{}, err
	}
	commentCount, err := s.repo.GetCommentCount(ctx, post.ID)
	if err != nil {
		return PostResponse{}, err
	}
	isLiked, err := s.repo.IsPostLiked(ctx, viewerID, post.ID)
	if err != nil {
		return PostResponse{}, err
	}
	if viewerID != post.AuthorID {
		audience = nil
	}
	return PostResponse{
		ID:               post.ID,
		AuthorID:         post.AuthorID,
		ContentType:      string(post.ContentType),
		Body:             post.Body,
		Privacy:          string(post.Privacy),
		LikeCount:        post.LikeCount,
		CommentCount:     commentCount,
		IsLiked:          isLiked,
		ExpiresAt:        post.ExpiresAt,
		OneTimeViewLimit: post.OneTimeViewLimit,
		AudienceUserIDs:  audience,
		MediaFileIDs:     mediaIDs,
		PublishedAt:      post.PublishedAt,
		EditedAt:         post.EditedAt,
	}, nil
}

func (s *Service) normalizeCreateRequest(req CreatePostRequest) (CreatePostRequest, error) {
	req.Body = strings.TrimSpace(req.Body)
	req.ContentType = strings.ToUpper(strings.TrimSpace(req.ContentType))
	if req.ContentType == "" {
		req.ContentType = string(enums.PostContentTypePost)
	}
	req.Privacy = strings.ToUpper(strings.TrimSpace(req.Privacy))
	req.AudienceUserIDs = uniqueStrings(req.AudienceUserIDs)
	req.MediaFileIDs = uniqueStrings(req.MediaFileIDs)
	return validatePostRequest(req)
}

func (s *Service) normalizeUpdateRequest(existing *model.Post, existingAudience, existingMedia []string, req UpdatePostRequest) (UpdatePostRequest, error) {
	body := existing.Body
	if req.Body != nil {
		body = strings.TrimSpace(*req.Body)
	}

	contentType := string(existing.ContentType)
	if req.ContentType != nil {
		contentType = strings.ToUpper(strings.TrimSpace(*req.ContentType))
	}

	privacy := string(existing.Privacy)
	if req.Privacy != nil {
		privacy = strings.ToUpper(strings.TrimSpace(*req.Privacy))
	}

	expiresAt := existing.ExpiresAt
	if req.Privacy != nil && privacy != string(enums.PostPrivacyTimed) {
		expiresAt = nil
	}
	if req.ExpiresAt != nil {
		value := req.ExpiresAt.UTC()
		expiresAt = &value
	}

	oneTimeViewLimit := existing.OneTimeViewLimit
	if req.Privacy != nil && privacy != string(enums.PostPrivacyOneTime) {
		oneTimeViewLimit = nil
	}
	if req.OneTimeViewLimit != nil {
		value := *req.OneTimeViewLimit
		oneTimeViewLimit = &value
	}

	audience := existingAudience
	if req.AudienceUserIDs != nil {
		audience = uniqueStrings(req.AudienceUserIDs)
	}
	mediaIDs := existingMedia
	if req.MediaFileIDs != nil {
		mediaIDs = uniqueStrings(req.MediaFileIDs)
	}

	normalized := UpdatePostRequest{
		ContentType:      &contentType,
		Body:             &body,
		Privacy:          &privacy,
		ExpiresAt:        expiresAt,
		OneTimeViewLimit: oneTimeViewLimit,
		AudienceUserIDs:  audience,
		MediaFileIDs:     mediaIDs,
	}
	return validatePostUpdate(normalized)
}

func validatePostRequest(req CreatePostRequest) (CreatePostRequest, error) {
	req.ContentType = strings.ToUpper(strings.TrimSpace(req.ContentType))
	if req.ContentType == "" {
		req.ContentType = string(enums.PostContentTypePost)
	}
	contentType := enums.PostContentType(req.ContentType)
	if contentType != enums.PostContentTypePost && contentType != enums.PostContentTypeClip {
		return CreatePostRequest{}, apperrors.New(400, "posts.content_type_invalid", "Unsupported content type")
	}
	if req.Body == "" {
		return CreatePostRequest{}, apperrors.New(400, "posts.body_required", "Post body cannot be empty")
	}
	privacy := enums.PostPrivacy(req.Privacy)
	now := time.Now().UTC()
	switch privacy {
	case enums.PostPrivacyTimed:
		if req.ExpiresAt == nil || !req.ExpiresAt.After(now) {
			return CreatePostRequest{}, apperrors.New(400, "posts.expires_at_required", "Timed posts require a future expiration time")
		}
	case enums.PostPrivacyOneTime:
		if req.OneTimeViewLimit == nil {
			defaultLimit := 1
			req.OneTimeViewLimit = &defaultLimit
		}
		if req.ExpiresAt != nil && !req.ExpiresAt.After(now) {
			return CreatePostRequest{}, apperrors.New(400, "posts.expires_at_invalid", "Post expiration must be in the future")
		}
	default:
		req.ExpiresAt = nil
		req.OneTimeViewLimit = nil
	}

	if contentType == enums.PostContentTypeClip && len(req.MediaFileIDs) == 0 {
		return CreatePostRequest{}, apperrors.New(400, "posts.clip_video_required", "Clips require one uploaded video")
	}

	if privacy == enums.PostPrivacyPrivate || privacy == enums.PostPrivacyOneTime || privacy == enums.PostPrivacyTimed {
		if len(req.AudienceUserIDs) == 0 {
			return CreatePostRequest{}, apperrors.New(400, "posts.audience_required", "Private, one-time, and timed posts require an explicit audience")
		}
	} else {
		req.AudienceUserIDs = nil
	}

	return req, nil
}

func validatePostUpdate(req UpdatePostRequest) (UpdatePostRequest, error) {
	if req.ContentType == nil {
		return UpdatePostRequest{}, apperrors.New(400, "posts.content_type_required", "Content type is required")
	}
	contentType := enums.PostContentType(*req.ContentType)
	if contentType != enums.PostContentTypePost && contentType != enums.PostContentTypeClip {
		return UpdatePostRequest{}, apperrors.New(400, "posts.content_type_invalid", "Unsupported content type")
	}
	if req.Body == nil || strings.TrimSpace(*req.Body) == "" {
		return UpdatePostRequest{}, apperrors.New(400, "posts.body_required", "Post body cannot be empty")
	}
	if contentType == enums.PostContentTypeClip && len(req.MediaFileIDs) == 0 {
		return UpdatePostRequest{}, apperrors.New(400, "posts.clip_video_required", "Clips require one uploaded video")
	}
	return req, validatePostBusinessRules(*req.Privacy, req.ExpiresAt, req.OneTimeViewLimit, req.AudienceUserIDs)
}

func (s *Service) validateContentMedia(ctx context.Context, userID, contentType string, mediaIDs []string) error {
	summaries, err := s.repo.MediaAttachmentSummaries(ctx, userID, mediaIDs)
	if err != nil {
		return err
	}
	if contentType != string(enums.PostContentTypeClip) {
		return nil
	}
	if len(summaries) != 1 {
		return apperrors.New(400, "posts.clip_video_required", "Clips require exactly one video attachment")
	}
	media := summaries[0]
	if media.Status != enums.MediaReady {
		return apperrors.New(409, "posts.clip_video_processing", "Clip video is still being processed")
	}
	if media.Kind != enums.MediaKindVideo || !strings.HasPrefix(strings.ToLower(media.MimeType), "video/") {
		return apperrors.New(400, "posts.clip_video_required", "Clips can only be published with a video file")
	}
	if media.Purpose != enums.UploadPurposeClip {
		return apperrors.New(400, "posts.clip_upload_purpose_required", "Clip videos must be uploaded with CLIP purpose")
	}
	return nil
}

func validatePostBusinessRules(privacyRaw string, expiresAt *time.Time, oneTimeViewLimit *int, audience []string) error {
	privacy := enums.PostPrivacy(privacyRaw)
	now := time.Now().UTC()
	switch privacy {
	case enums.PostPrivacyTimed:
		if expiresAt == nil || !expiresAt.After(now) {
			return apperrors.New(400, "posts.expires_at_required", "Timed posts require a future expiration time")
		}
	case enums.PostPrivacyOneTime:
		if oneTimeViewLimit == nil || *oneTimeViewLimit < 1 {
			return apperrors.New(400, "posts.one_time_limit_required", "One-time posts require a view limit")
		}
		if expiresAt != nil && !expiresAt.After(now) {
			return apperrors.New(400, "posts.expires_at_invalid", "Post expiration must be in the future")
		}
	default:
		if expiresAt != nil || oneTimeViewLimit != nil {
			return apperrors.New(400, "posts.privacy_state_invalid", "Expiration and one-time limits are only allowed for timed and one-time posts")
		}
	}

	if privacy == enums.PostPrivacyPrivate || privacy == enums.PostPrivacyOneTime || privacy == enums.PostPrivacyTimed {
		if len(audience) == 0 {
			return apperrors.New(400, "posts.audience_required", "Private, one-time, and timed posts require an explicit audience")
		}
	}
	return nil
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func (s *Service) LikePost(ctx context.Context, userID, postID string) error {
	post, err := s.repo.GetVisiblePost(ctx, userID, postID)
	if err != nil {
		return err
	}
	return s.repo.LikePost(ctx, userID, post.ID)
}

func (s *Service) UnlikePost(ctx context.Context, userID, postID string) error {
	post, err := s.repo.GetVisiblePost(ctx, userID, postID)
	if err != nil {
		return err
	}
	return s.repo.UnlikePost(ctx, userID, post.ID)
}

func (s *Service) GetPostLikes(ctx context.Context, userID, postID string, page, limit int) ([]LikesListResponse, error) {
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = 20
	}
	post, err := s.repo.GetVisiblePost(ctx, userID, postID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetPostLikes(ctx, post.ID, page, limit)
}

func (s *Service) GetComments(ctx context.Context, userID, postID string, page, limit int, sortBy string) ([]CommentResponse, error) {
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = 20
	}
	post, err := s.repo.GetVisiblePost(ctx, userID, postID)
	if err != nil {
		return nil, err
	}
	comments, err := s.repo.GetComments(ctx, post.ID, page, limit, sortBy)
	if err != nil {
		return nil, err
	}
	return s.hydrateComments(ctx, userID, comments)
}

func (s *Service) CreateComment(ctx context.Context, userID, postID string, req CreateCommentRequest) (CommentResponse, error) {
	post, err := s.repo.GetVisiblePost(ctx, userID, postID)
	if err != nil {
		return CommentResponse{}, err
	}

	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		return CommentResponse{}, apperrors.New(400, "comments.content_required", "Comment content cannot be empty")
	}

	comment, err := s.repo.CreateComment(ctx, userID, post.ID, req)
	if err != nil {
		return CommentResponse{}, err
	}
	return s.hydrateComment(ctx, userID, comment)
}

func (s *Service) UpdateComment(ctx context.Context, userID, commentID string, req UpdateCommentRequest) (CommentResponse, error) {
	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		return CommentResponse{}, apperrors.New(400, "comments.content_required", "Comment content cannot be empty")
	}

	comment, err := s.repo.UpdateComment(ctx, userID, commentID, req)
	if err != nil {
		return CommentResponse{}, err
	}
	return s.hydrateComment(ctx, userID, comment)
}

func (s *Service) DeleteComment(ctx context.Context, userID, commentID string) error {
	return s.repo.DeleteComment(ctx, userID, commentID)
}

func (s *Service) LikeComment(ctx context.Context, userID, commentID string) error {
	return s.repo.LikeComment(ctx, userID, commentID)
}

func (s *Service) UnlikeComment(ctx context.Context, userID, commentID string) error {
	return s.repo.UnlikeComment(ctx, userID, commentID)
}

func (s *Service) hydrateComment(ctx context.Context, viewerID string, comment *model.Comment) (CommentResponse, error) {
	isLiked, err := s.repo.IsCommentLiked(ctx, viewerID, comment.ID)
	if err != nil {
		return CommentResponse{}, err
	}
	return CommentResponse{
		ID:              comment.ID,
		PostID:          comment.PostID,
		AuthorID:        comment.AuthorID,
		ParentCommentID: comment.ParentCommentID,
		Content:         comment.Content,
		LikeCount:       comment.LikeCount,
		ReplyCount:      comment.ReplyCount,
		IsLiked:         isLiked,
		CreatedAt:       comment.CreatedAt,
		UpdatedAt:       comment.UpdatedAt,
	}, nil
}

func (s *Service) hydrateComments(ctx context.Context, viewerID string, comments []model.Comment) ([]CommentResponse, error) {
	result := make([]CommentResponse, 0, len(comments))
	for _, comment := range comments {
		hydrated, err := s.hydrateComment(ctx, viewerID, &comment)
		if err != nil {
			return nil, err
		}
		result = append(result, hydrated)
	}
	return result, nil
}
