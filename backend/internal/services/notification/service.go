package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/gapak/backend/internal/domain/model"
)

type Service struct {
	db        *pgxpool.Pool
	kafka     KafkaProducer
	redis     RedisCache
	dedup     DeduplicationService
	rateLimit RateLimitService
}

func NewService(
	db *pgxpool.Pool,
	kafka KafkaProducer,
	redis RedisCache,
	dedup DeduplicationService,
	rateLimit RateLimitService,
) *Service {
	return &Service{
		db:        db,
		kafka:     kafka,
		redis:     redis,
		dedup:     dedup,
		rateLimit: rateLimit,
	}
}

type KafkaProducer interface {
	Publish(ctx context.Context, topic string, key string, event interface{}) error
}

type RedisCache interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, value string, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

type DeduplicationService interface {
	IsDuplicate(ctx context.Context, key string, ttl time.Duration) (bool, error)
	RecordMention(ctx context.Context, key string) error
}

type RateLimitService interface {
	CheckRateLimit(ctx context.Context, scope, identifier string, limit int, window time.Duration) (bool, error)
}

// DetectAndCreateMentions detects @mentions in content and creates notifications
func (s *Service) DetectAndCreateMentions(
	ctx context.Context,
	content string,
	authorID string,
	authorUsername string,
	authorDisplayName string,
	authorAvatar *string,
	mentionType model.MentionType,
	contextID string,
	contextType string,
	metadata map[string]string,
) error {
	// Detect mentions in content
	mentionedUsernames := extractMentions(content)
	if len(mentionedUsernames) == 0 {
		return nil
	}

	// Rate limit: prevent spam mentions
	allowed, err := s.rateLimit.CheckRateLimit(ctx, "mention_detection", authorID, 100, time.Hour)
	if err != nil {
		log.Error().Err(err).Msg("Failed to check rate limit for mention detection")
		return fmt.Errorf("rate limit check failed")
	}
	if !allowed {
		return fmt.Errorf("rate limit exceeded for mention detection")
	}

	// Get user IDs for mentioned usernames
	userIDs, err := s.getUserIDsByUsernames(ctx, mentionedUsernames)
	if err != nil {
		return fmt.Errorf("failed to get user IDs: %w", err)
	}

	// Create mentions for each user
	for _, userID := range userIDs {
		// Skip if author is mentioning themselves
		if userID == authorID {
			continue
		}

		// Check for duplicate mentions (deduplication)
		dedupKey := fmt.Sprintf("mention:%s:%s:%s", userID, contextID, contextType)
		isDuplicate, err := s.dedup.IsDuplicate(ctx, dedupKey, 24*time.Hour)
		if err != nil {
			log.Error().Err(err).Msg("Failed to check for duplicate mention")
			continue
		}
		if isDuplicate {
			continue
		}

		// Record the mention for deduplication
		if err := s.dedup.RecordMention(ctx, dedupKey); err != nil {
			log.Error().Err(err).Msg("Failed to record mention for deduplication")
		}

		// Create mention record
		mention := &model.Mention{
			ID:                     uuid.New().String(),
			MentionedUserID:        userID,
			MentionedByUsername:    authorUsername,
			MentionedByDisplayName: authorDisplayName,
			MentionedByAvatar:      authorAvatar,
			Type:                   mentionType,
			Content:                content,
			ContextID:              contextID,
			ContextType:            contextType,
			CreatedAt:              time.Now(),
			IsRead:                 false,
		}

		// Set optional metadata
		if postID, ok := metadata["post_id"]; ok {
			mention.PostID = &postID
		}
		if commentID, ok := metadata["comment_id"]; ok {
			mention.CommentID = &commentID
		}
		if roomID, ok := metadata["room_id"]; ok {
			mention.RoomID = &roomID
		}
		if communityID, ok := metadata["community_id"]; ok {
			mention.CommunityID = &communityID
		}
		if projectID, ok := metadata["project_id"]; ok {
			mention.ProjectID = &projectID
		}
		if storyID, ok := metadata["story_id"]; ok {
			mention.StoryID = &storyID
		}
		if chatID, ok := metadata["chat_id"]; ok {
			mention.ChatID = &chatID
		}

		// Save mention to database
		if err := s.createMention(ctx, mention); err != nil {
			log.Error().Err(err).Str("mention_id", mention.ID).Msg("Failed to create mention")
			continue
		}

		// Create notification
		notification := &model.Notification{
			ID:     uuid.New().String(),
			UserID: userID,
			Type:   model.NotificationTypeMention,
			Title:  fmt.Sprintf("%s mentioned you", authorDisplayName),
			Body:   fmt.Sprintf("%s mentioned you %s", authorDisplayName, getMentionTypeLabel(mentionType)),
			Data: map[string]any{
				"mention_id": mention.ID,
				"author_id":  authorID,
				"username":   authorUsername,
			},
			IsRead:    false,
			CreatedAt: time.Now(),
			ActionURL: buildActionURL(mention),
		}

		if err := s.createNotification(ctx, notification); err != nil {
			log.Error().Err(err).Str("notification_id", notification.ID).Msg("Failed to create notification")
			continue
		}

		// Publish notification event to Kafka for WebSocket delivery
		event := map[string]any{
			"type":         "notification",
			"notification": notification,
			"mention":      mention,
		}
		if err := s.kafka.Publish(ctx, "notifications", userID, event); err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("Failed to publish notification event")
		}

		// Invalidate cache for user's notifications
		cacheKey := fmt.Sprintf("notifications:%s", userID)
		if err := s.redis.Delete(ctx, cacheKey); err != nil {
			log.Error().Err(err).Str("cache_key", cacheKey).Msg("Failed to invalidate cache")
		}
	}

	return nil
}

// GetNotifications retrieves notifications for a user
func (s *Service) GetNotifications(ctx context.Context, userID string, limit int, offset int) ([]*model.Notification, int64, error) {
	// Try cache first
	cacheKey := fmt.Sprintf("notifications:%s:%d:%d", userID, limit, offset)
	cached, err := s.redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
		var notifications []*model.Notification
		if err := json.Unmarshal([]byte(cached), &notifications); err == nil {
			return notifications, int64(len(notifications)), nil
		}
	}

	// Fetch from database
	notifications, err := s.getNotificationsFromDB(ctx, userID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get notifications: %w", err)
	}

	// Cache the results
	if len(notifications) > 0 {
		data, _ := json.Marshal(notifications)
		s.redis.Set(ctx, cacheKey, string(data), 5*time.Minute)
	}

	return notifications, int64(len(notifications)), nil
}

// MarkAsRead marks a notification as read
func (s *Service) MarkAsRead(ctx context.Context, notificationID, userID string) error {
	// Update database
	if err := s.updateNotificationReadStatus(ctx, notificationID, true); err != nil {
		return fmt.Errorf("failed to mark notification as read: %w", err)
	}

	// Invalidate cache
	cacheKey := fmt.Sprintf("notifications:%s", userID)
	if err := s.redis.Delete(ctx, cacheKey); err != nil {
		log.Error().Err(err).Str("cache_key", cacheKey).Msg("Failed to invalidate cache")
	}

	return nil
}

// MarkAllAsRead marks all notifications as read for a user
func (s *Service) MarkAllAsRead(ctx context.Context, userID string) error {
	// Update database
	if err := s.updateAllNotificationsReadStatus(ctx, userID, true); err != nil {
		return fmt.Errorf("failed to mark all notifications as read: %w", err)
	}

	// Invalidate cache
	cacheKey := fmt.Sprintf("notifications:%s", userID)
	if err := s.redis.Delete(ctx, cacheKey); err != nil {
		log.Error().Err(err).Str("cache_key", cacheKey).Msg("Failed to invalidate cache")
	}

	return nil
}

// GetMentionAnalytics retrieves mention analytics for a user
func (s *Service) GetMentionAnalytics(ctx context.Context, userID string) (*model.MentionAnalytics, []*model.TopMentioner, []*model.TopCommunity, error) {
	analytics, err := s.getMentionAnalyticsFromDB(ctx, userID)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to get mention analytics: %w", err)
	}

	topMentioners, err := s.getTopMentioners(ctx, userID, 5)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get top mentioners")
	}

	topCommunities, err := s.getTopCommunities(ctx, userID, 5)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get top communities")
	}

	return analytics, topMentioners, topCommunities, nil
}

// Helper functions

func extractMentions(content string) []string {
	// Simple regex to extract @username mentions
	// In production, use a more sophisticated parser
	var mentions []string
	// TODO: Implement proper mention extraction
	return mentions
}

func (s *Service) getUserIDsByUsernames(ctx context.Context, usernames []string) ([]string, error) {
	// Fetch user IDs from database
	// TODO: Implement database query
	return []string{}, nil
}

func (s *Service) createMention(ctx context.Context, mention *model.Mention) error {
	query := `
		INSERT INTO mentions (
			id, mentioned_user_id, mentioned_by_username, mentioned_by_display_name,
			mentioned_by_avatar, type, content, context_id, context_type,
			created_at, is_read, post_id, comment_id, room_id, community_id,
			project_id, story_id, chat_id
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
	`
	_, err := s.db.Exec(ctx, query,
		mention.ID, mention.MentionedUserID, mention.MentionedByUsername,
		mention.MentionedByDisplayName, mention.MentionedByAvatar, mention.Type,
		mention.Content, mention.ContextID, mention.ContextType, mention.CreatedAt,
		mention.IsRead, mention.PostID, mention.CommentID, mention.RoomID,
		mention.CommunityID, mention.ProjectID, mention.StoryID, mention.ChatID,
	)
	return err
}

func (s *Service) createNotification(ctx context.Context, notification *model.Notification) error {
	query := `
		INSERT INTO notifications (id, user_id, type, title, body, data, is_read, created_at, action_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := s.db.Exec(ctx, query,
		notification.ID, notification.UserID, notification.Type,
		notification.Title, notification.Body, notification.Data,
		notification.IsRead, notification.CreatedAt, notification.ActionURL,
	)
	return err
}

func (s *Service) getNotificationsFromDB(ctx context.Context, userID string, limit, offset int) ([]*model.Notification, error) {
	query := `
		SELECT id, user_id, type, title, body, data, is_read, created_at, action_url
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := s.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []*model.Notification
	for rows.Next() {
		var notification model.Notification
		var dataJSON []byte
		err := rows.Scan(
			&notification.ID, &notification.UserID, &notification.Type,
			&notification.Title, &notification.Body, &dataJSON,
			&notification.IsRead, &notification.CreatedAt, &notification.ActionURL,
		)
		if err != nil {
			return nil, err
		}
		if len(dataJSON) > 0 {
			json.Unmarshal(dataJSON, &notification.Data)
		}
		notifications = append(notifications, &notification)
	}

	return notifications, nil
}

func (s *Service) updateNotificationReadStatus(ctx context.Context, notificationID string, isRead bool) error {
	query := `UPDATE notifications SET is_read = $1 WHERE id = $2`
	_, err := s.db.Exec(ctx, query, isRead, notificationID)
	return err
}

func (s *Service) updateAllNotificationsReadStatus(ctx context.Context, userID string, isRead bool) error {
	query := `UPDATE notifications SET is_read = $1 WHERE user_id = $2`
	_, err := s.db.Exec(ctx, query, isRead, userID)
	return err
}

func (s *Service) getMentionAnalyticsFromDB(ctx context.Context, userID string) (*model.MentionAnalytics, error) {
	// TODO: Implement database query
	return &model.MentionAnalytics{}, nil
}

func (s *Service) getTopMentioners(ctx context.Context, userID string, limit int) ([]*model.TopMentioner, error) {
	// TODO: Implement database query
	return []*model.TopMentioner{}, nil
}

func (s *Service) getTopCommunities(ctx context.Context, userID string, limit int) ([]*model.TopCommunity, error) {
	// TODO: Implement database query
	return []*model.TopCommunity{}, nil
}

func getMentionTypeLabel(mentionType model.MentionType) string {
	switch mentionType {
	case model.MentionTypeChat:
		return "in a chat"
	case model.MentionTypeComment:
		return "in a comment"
	case model.MentionTypePost:
		return "in a post"
	case model.MentionTypeStory:
		return "in a story"
	case model.MentionTypeRoom:
		return "in a room"
	case model.MentionTypeCommunity:
		return "in a community"
	case model.MentionTypeProject:
		return "in a project"
	case model.MentionTypeAICollaboration:
		return "in AI collaboration"
	default:
		return ""
	}
}

func buildActionURL(mention *model.Mention) *string {
	var url string
	switch mention.Type {
	case model.MentionTypeChat:
		if mention.ChatID != nil {
			url = fmt.Sprintf("/chats/%s", *mention.ChatID)
		}
	case model.MentionTypeComment:
		if mention.PostID != nil && mention.CommentID != nil {
			url = fmt.Sprintf("/posts/%s#comment-%s", *mention.PostID, *mention.CommentID)
		}
	case model.MentionTypePost:
		if mention.PostID != nil {
			url = fmt.Sprintf("/posts/%s", *mention.PostID)
		}
	case model.MentionTypeStory:
		if mention.StoryID != nil {
			url = fmt.Sprintf("/stories/%s", *mention.StoryID)
		}
	case model.MentionTypeRoom:
		if mention.RoomID != nil {
			url = fmt.Sprintf("/rooms/%s", *mention.RoomID)
		}
	case model.MentionTypeCommunity:
		if mention.CommunityID != nil {
			url = fmt.Sprintf("/communities/%s", *mention.CommunityID)
		}
	case model.MentionTypeProject:
		if mention.ProjectID != nil {
			url = fmt.Sprintf("/projects/%s", *mention.ProjectID)
		}
	}

	if url == "" {
		return nil
	}
	return &url
}
