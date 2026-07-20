package deduplication

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

// Service handles message deduplication
type Service struct {
	redis  *redis.Client
	db     Database
	logger *zerolog.Logger
	ttl    time.Duration
}

// Database interface for deduplication operations
type Database interface {
	CreateDeduplicationRecord(ctx context.Context, record *Record) error
	GetDeduplicationRecord(ctx context.Context, clientMessageID string) (*Record, error)
	DeleteExpiredRecords(ctx context.Context, before time.Time) error
}

// Record represents a deduplication record
type Record struct {
	ClientMessageID string
	ServerMessageID string
	UserID          string
	ChatID          string
	CreatedAt       time.Time
	ExpiresAt       time.Time
}

// NewService creates a new deduplication service
func NewService(redis *redis.Client, db Database, logger *zerolog.Logger) *Service {
	return &Service{
		redis:  redis,
		db:     db,
		logger: logger,
		ttl:    24 * time.Hour, // 24 hour TTL
	}
}

// IsDuplicate checks if a message is a duplicate
func (s *Service) IsDuplicate(ctx context.Context, clientMessageID string) (bool, error) {
	// Check Redis cache first
	key := s.getCacheKey(clientMessageID)
	exists, err := s.redis.Exists(ctx, key).Result()
	if err != nil {
		s.logger.Error().Err(err).Str("client_message_id", clientMessageID).Msg("failed to check Redis")
		// Fall through to database check
	} else if exists > 0 {
		return true, nil
	}

	// Check database as fallback
	record, err := s.db.GetDeduplicationRecord(ctx, clientMessageID)
	if err != nil {
		return false, nil // Assume not duplicate on error
	}

	if record != nil && time.Now().Before(record.ExpiresAt) {
		// Cache the result
		s.cacheRecord(ctx, record)
		return true, nil
	}

	return false, nil
}

// Record stores a deduplication record
func (s *Service) Record(ctx context.Context, clientMessageID, serverMessageID, userID, chatID string) error {
	now := time.Now()
	record := &Record{
		ClientMessageID: clientMessageID,
		ServerMessageID: serverMessageID,
		UserID:          userID,
		ChatID:          chatID,
		CreatedAt:       now,
		ExpiresAt:       now.Add(s.ttl),
	}

	// Store in Redis cache
	if err := s.cacheRecord(ctx, record); err != nil {
		s.logger.Error().Err(err).Msg("failed to cache record")
	}

	// Store in database
	if err := s.db.CreateDeduplicationRecord(ctx, record); err != nil {
		s.logger.Error().Err(err).Msg("failed to store record in database")
		// Don't fail - cache is sufficient for deduplication
	}

	s.logger.Debug().
		Str("client_message_id", clientMessageID).
		Str("server_message_id", serverMessageID).
		Str("user_id", userID).
		Str("chat_id", chatID).
		Msg("deduplication record created")

	return nil
}

// GetServerID retrieves the server message ID for a client message ID
func (s *Service) GetServerID(ctx context.Context, clientMessageID string) (string, error) {
	// Check Redis cache first
	key := s.getCacheKey(clientMessageID)
	data, err := s.redis.Get(ctx, key).Result()
	if err == nil && data != "" {
		var record Record
		if err := json.Unmarshal([]byte(data), &record); err == nil {
			return record.ServerMessageID, nil
		}
	}

	// Check database
	record, err := s.db.GetDeduplicationRecord(ctx, clientMessageID)
	if err != nil {
		return "", err
	}

	if record == nil || time.Now().After(record.ExpiresAt) {
		return "", fmt.Errorf("record not found or expired")
	}

	return record.ServerMessageID, nil
}

// Cleanup removes expired records
func (s *Service) Cleanup(ctx context.Context) error {
	// Cleanup database
	if err := s.db.DeleteExpiredRecords(ctx, time.Now()); err != nil {
		s.logger.Error().Err(err).Msg("failed to cleanup database records")
	}

	// Redis handles TTL automatically
	s.logger.Info().Msg("deduplication cleanup completed")
	return nil
}

// cacheRecord stores a record in Redis cache
func (s *Service) cacheRecord(ctx context.Context, record *Record) error {
	key := s.getCacheKey(record.ClientMessageID)
	data, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal record: %w", err)
	}

	return s.redis.Set(ctx, key, data, s.ttl).Err()
}

// getCacheKey returns the Redis cache key for a client message ID
func (s *Service) getCacheKey(clientMessageID string) string {
	return fmt.Sprintf("dedup:%s", clientMessageID)
}

// StartCleanup starts a background cleanup goroutine
func (s *Service) StartCleanup(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.Cleanup(ctx); err != nil {
				s.logger.Error().Err(err).Msg("cleanup failed")
			}
		}
	}
}
