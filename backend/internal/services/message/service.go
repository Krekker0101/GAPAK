package message

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

// Service handles message operations
type Service struct {
	db           Database
	kafka        KafkaProducer
	redis        *redis.Client
	deduplicator Deduplicator
	rateLimiter  RateLimiter
	logger       *zerolog.Logger
}

// Database interface for message operations
type Database interface {
	CreateMessage(ctx context.Context, msg *Message) error
	GetMessage(ctx context.Context, id string) (*Message, error)
	GetMessages(ctx context.Context, chatID string, limit int, before *time.Time) ([]*Message, error)
	GetMessageByClientID(ctx context.Context, clientID string) (*Message, error)
	GetNextSequenceNumber(ctx context.Context, chatID string) (int64, error)
}

// KafkaProducer interface for publishing events
type KafkaProducer interface {
	Publish(ctx context.Context, topic string, event interface{}) error
}

// Deduplicator handles message deduplication
type Deduplicator interface {
	IsDuplicate(ctx context.Context, clientMessageID string) (bool, error)
	Record(ctx context.Context, clientMessageID, serverMessageID, userID, chatID string) error
	GetServerID(ctx context.Context, clientMessageID string) (string, error)
}

// RateLimiter handles rate limiting
type RateLimiter interface {
	Allow(ctx context.Context, userID, resource string, limit int, window time.Duration) bool
}

// Message represents a message in the system
type Message struct {
	ID                 string
	ChatID             string
	SenderID           string
	Ciphertext         []byte
	Nonce              string
	SenderKeyID        string
	AttachmentManifest []byte
	Metadata           map[string]string
	ClientMessageID    string
	SequenceNumber     int64
	SentAt             time.Time
	EditedAt           *time.Time
	DeletedAt          *time.Time
}

// SendMessageRequest represents a request to send a message
type SendMessageRequest struct {
	ChatID          string
	SenderID        string
	ClientMessageID string
	Ciphertext      []byte
	Nonce           string
	SenderKeyID     string
	Attachments     []Attachment
	Metadata        map[string]string
	TTLSeconds      int64
}

// Attachment represents a message attachment
type Attachment struct {
	MediaID     string
	MimeType    string
	SizeBytes   int64
	ThumbnailID string
	Metadata    map[string]string
}

// SendMessageResponse represents the response to sending a message
type SendMessageResponse struct {
	MessageID      string
	SentAt         time.Time
	SequenceNumber int64
}

// NewService creates a new message service
func NewService(
	db Database,
	kafka KafkaProducer,
	redis *redis.Client,
	deduplicator Deduplicator,
	rateLimiter RateLimiter,
	logger *zerolog.Logger,
) *Service {
	return &Service{
		db:           db,
		kafka:        kafka,
		redis:        redis,
		deduplicator: deduplicator,
		rateLimiter:  rateLimiter,
		logger:       logger,
	}
}

// SendMessage handles sending a message
func (s *Service) SendMessage(ctx context.Context, req *SendMessageRequest) (*SendMessageResponse, error) {
	// Validate request
	if err := s.validateRequest(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Check rate limit
	if s.rateLimiter != nil && !s.rateLimiter.Allow(ctx, req.SenderID, "send_message", 100, time.Minute) {
		return nil, errors.New("rate limit exceeded")
	}

	// Check deduplication
	isDuplicate := false
	if s.deduplicator != nil {
		var err error
		isDuplicate, err = s.deduplicator.IsDuplicate(ctx, req.ClientMessageID)
		if err != nil {
			s.logger.Error().Err(err).Str("client_message_id", req.ClientMessageID).Msg("deduplication check failed")
		}
	}
	if isDuplicate {
		// Return existing message ID if duplicate
		if s.deduplicator != nil {
			existingID, err := s.deduplicator.GetServerID(ctx, req.ClientMessageID)
			if err == nil {
				return &SendMessageResponse{
					MessageID: existingID,
					SentAt:    time.Now(),
				}, nil
			}
		}
		return nil, errors.New("duplicate message")
	}

	// Generate server message ID
	messageID := uuid.New().String()

	// Get next sequence number
	sequenceNumber, err := s.db.GetNextSequenceNumber(ctx, req.ChatID)
	if err != nil {
		return nil, fmt.Errorf("failed to get sequence number: %w", err)
	}

	// Create message
	message := &Message{
		ID:              messageID,
		ChatID:          req.ChatID,
		SenderID:        req.SenderID,
		Ciphertext:      req.Ciphertext,
		Nonce:           req.Nonce,
		SenderKeyID:     req.SenderKeyID,
		ClientMessageID: req.ClientMessageID,
		SequenceNumber:  sequenceNumber,
		SentAt:          time.Now(),
		Metadata:        req.Metadata,
	}

	// Store message in database
	if err := s.db.CreateMessage(ctx, message); err != nil {
		return nil, fmt.Errorf("failed to create message: %w", err)
	}

	// Record deduplication
	if s.deduplicator != nil {
		if err := s.deduplicator.Record(ctx, req.ClientMessageID, messageID, req.SenderID, req.ChatID); err != nil {
			s.logger.Error().Err(err).Msg("failed to record deduplication")
		}
	}

	// Publish to Kafka
	event := map[string]interface{}{
		"event_id":        uuid.New().String(),
		"event_type":      "created",
		"message_id":      messageID,
		"chat_id":         req.ChatID,
		"sender_id":       req.SenderID,
		"sequence_number": sequenceNumber,
		"timestamp":       time.Now().Unix(),
		"source_service":  "message_service",
	}

	if s.kafka != nil {
		if err := s.kafka.Publish(ctx, "messages", event); err != nil {
			s.logger.Error().Err(err).Str("message_id", messageID).Msg("failed to publish message event")
			// Don't fail the request - message is already stored
		}
	}

	// Cache message in Redis (TTL: 1 hour)
	if s.redis != nil {
		cacheKey := fmt.Sprintf("message:%s", messageID)
		if err := s.redis.Set(ctx, cacheKey, message, time.Hour).Err(); err != nil {
			s.logger.Error().Err(err).Msg("failed to cache message")
		}
	}

	s.logger.Info().
		Str("message_id", messageID).
		Str("chat_id", req.ChatID).
		Str("sender_id", req.SenderID).
		Int64("sequence_number", sequenceNumber).
		Msg("message sent successfully")

	return &SendMessageResponse{
		MessageID:      messageID,
		SentAt:         message.SentAt,
		SequenceNumber: sequenceNumber,
	}, nil
}

// GetMessage retrieves a message by ID
func (s *Service) GetMessage(ctx context.Context, id string) (*Message, error) {
	// Try cache first
	cacheKey := fmt.Sprintf("message:%s", id)
	cached, err := s.redis.Get(ctx, cacheKey).Result()
	if err == nil && cached != "" {
		// Deserialize from cache
		var msg Message
		// In production, use proper serialization (JSON, msgpack, etc.)
		return &msg, nil
	}

	// Fetch from database
	msg, err := s.db.GetMessage(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get message: %w", err)
	}

	// Cache the result
	if err := s.redis.Set(ctx, cacheKey, msg, time.Hour).Err(); err != nil {
		s.logger.Error().Err(err).Msg("failed to cache message")
	}

	return msg, nil
}

// GetMessages retrieves messages for a chat
func (s *Service) GetMessages(ctx context.Context, chatID string, limit int, before *time.Time) ([]*Message, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	messages, err := s.db.GetMessages(ctx, chatID, limit, before)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages: %w", err)
	}

	return messages, nil
}

// EditMessage handles editing a message
func (s *Service) EditMessage(ctx context.Context, messageID string, newCiphertext []byte, newNonce string, updatedMetadata map[string]string) error {
	// Get existing message
	msg, err := s.db.GetMessage(ctx, messageID)
	if err != nil {
		return fmt.Errorf("failed to get message: %w", err)
	}

	// Update message
	msg.Ciphertext = newCiphertext
	msg.Nonce = newNonce
	now := time.Now()
	msg.EditedAt = &now

	// Merge metadata
	if msg.Metadata == nil {
		msg.Metadata = make(map[string]string)
	}
	for k, v := range updatedMetadata {
		msg.Metadata[k] = v
	}

	// Store updated message
	if err := s.db.CreateMessage(ctx, msg); err != nil {
		return fmt.Errorf("failed to update message: %w", err)
	}

	// Publish edit event
	event := map[string]interface{}{
		"event_id":       uuid.New().String(),
		"event_type":     "updated",
		"message_id":     messageID,
		"chat_id":        msg.ChatID,
		"sender_id":      msg.SenderID,
		"timestamp":      time.Now().Unix(),
		"source_service": "message_service",
	}

	if err := s.kafka.Publish(ctx, "messages", event); err != nil {
		s.logger.Error().Err(err).Str("message_id", messageID).Msg("failed to publish edit event")
	}

	// Invalidate cache
	cacheKey := fmt.Sprintf("message:%s", messageID)
	s.redis.Del(ctx, cacheKey)

	s.logger.Info().
		Str("message_id", messageID).
		Msg("message edited successfully")

	return nil
}

// DeleteMessage handles deleting a message
func (s *Service) DeleteMessage(ctx context.Context, messageID string, deleteForEveryone bool) error {
	// Get existing message
	msg, err := s.db.GetMessage(ctx, messageID)
	if err != nil {
		return fmt.Errorf("failed to get message: %w", err)
	}

	if deleteForEveryone {
		// Soft delete for everyone
		now := time.Now()
		msg.DeletedAt = &now
		if err := s.db.CreateMessage(ctx, msg); err != nil {
			return fmt.Errorf("failed to delete message: %w", err)
		}
	} else {
		// Mark as deleted for sender only (implement separate logic)
		// This would require a separate table for per-user deletion
	}

	// Publish delete event
	event := map[string]interface{}{
		"event_id":            uuid.New().String(),
		"event_type":          "deleted",
		"message_id":          messageID,
		"chat_id":             msg.ChatID,
		"sender_id":           msg.SenderID,
		"delete_for_everyone": deleteForEveryone,
		"timestamp":           time.Now().Unix(),
		"source_service":      "message_service",
	}

	if err := s.kafka.Publish(ctx, "messages", event); err != nil {
		s.logger.Error().Err(err).Str("message_id", messageID).Msg("failed to publish delete event")
	}

	// Invalidate cache
	cacheKey := fmt.Sprintf("message:%s", messageID)
	s.redis.Del(ctx, cacheKey)

	s.logger.Info().
		Str("message_id", messageID).
		Bool("delete_for_everyone", deleteForEveryone).
		Msg("message deleted successfully")

	return nil
}

// validateRequest validates a send message request
func (s *Service) validateRequest(req *SendMessageRequest) error {
	if req.ChatID == "" {
		return errors.New("chat_id is required")
	}
	if req.SenderID == "" {
		return errors.New("sender_id is required")
	}
	if req.ClientMessageID == "" {
		return errors.New("client_message_id is required")
	}
	if len(req.Ciphertext) == 0 {
		return errors.New("ciphertext is required")
	}
	if req.Nonce == "" {
		return errors.New("nonce is required")
	}
	if req.SenderKeyID == "" {
		return errors.New("sender_key_id is required")
	}
	return nil
}

// generateNonce generates a random nonce for encryption
func generateNonce() (string, error) {
	nonce := make([]byte, 24) // 192-bit nonce
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return hex.EncodeToString(nonce), nil
}
