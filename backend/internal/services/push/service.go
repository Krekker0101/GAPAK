package push

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

// Service handles push notification delivery
type Service struct {
	redis         *redis.Client
	db            Database
	apnsClient    APNSClient
	fcmClient     FCMClient
	webPushClient WebPushClient
	logger        *zerolog.Logger
	workers       int
}

// Database interface for push operations
type Database interface {
	CreatePushNotification(ctx context.Context, notification *Notification) error
	GetPushNotification(ctx context.Context, id string) (*Notification, error)
	UpdatePushNotification(ctx context.Context, notification *Notification) error
	GetPushTokens(ctx context.Context, userID string) ([]*PushToken, error)
}

// APNSClient interface for Apple Push Notification Service
type APNSClient interface {
	Send(ctx context.Context, token string, payload *Payload) error
}

// FCMClient interface for Firebase Cloud Messaging
type FCMClient interface {
	Send(ctx context.Context, token string, payload *Payload) error
}

// WebPushClient interface for Web Push
type WebPushClient interface {
	Send(ctx context.Context, subscription *WebPushSubscription, payload *Payload) error
}

// Notification represents a push notification
type Notification struct {
	ID            string
	UserID        string
	DeviceID      string
	Platform      Platform
	Payload       *Payload
	Status        Status
	SentAt        *time.Time
	DeliveredAt   *time.Time
	FailureReason string
	RetryCount    int
	MaxRetries    int
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// PushToken represents a push notification token
type PushToken struct {
	ID         string
	UserID     string
	DeviceID   string
	Token      string
	Platform   Platform
	IsActive   bool
	LastUsedAt *time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// Payload represents a push notification payload
type Payload struct {
	Title string            `json:"title"`
	Body  string            `json:"body"`
	Data  map[string]string `json:"data"`
	Sound string            `json:"sound,omitempty"`
	Badge int               `json:"badge,omitempty"`
}

// Platform represents the push platform
type Platform string

const (
	PlatformAPNS Platform = "apns"
	PlatformFCM  Platform = "fcm"
	PlatformWeb  Platform = "web"
)

// Status represents the notification status
type Status string

const (
	StatusPending   Status = "pending"
	StatusSent      Status = "sent"
	StatusDelivered Status = "delivered"
	StatusFailed    Status = "failed"
)

// WebPushSubscription represents a web push subscription
type WebPushSubscription struct {
	Endpoint string
	Keys     struct {
		P256dh string
		Auth   string
	}
}

// NewService creates a new push service
func NewService(
	redis *redis.Client,
	db Database,
	apnsClient APNSClient,
	fcmClient FCMClient,
	webPushClient WebPushClient,
	logger *zerolog.Logger,
) *Service {
	return &Service{
		redis:         redis,
		db:            db,
		apnsClient:    apnsClient,
		fcmClient:     fcmClient,
		webPushClient: webPushClient,
		logger:        logger,
		workers:       10, // Number of concurrent workers
	}
}

// QueuePushNotification queues a push notification for delivery
func (s *Service) QueuePushNotification(ctx context.Context, userID string, payload *Payload, platforms []Platform) error {
	// Get user's push tokens
	tokens, err := s.db.GetPushTokens(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get push tokens: %w", err)
	}

	// Create notification for each token
	for _, token := range tokens {
		// Check if platform is requested
		if len(platforms) > 0 {
			platformRequested := false
			for _, p := range platforms {
				if token.Platform == p {
					platformRequested = true
					break
				}
			}
			if !platformRequested {
				continue
			}
		}

		// Create notification
		notification := &Notification{
			ID:         generateID(),
			UserID:     userID,
			DeviceID:   token.DeviceID,
			Platform:   token.Platform,
			Payload:    payload,
			Status:     StatusPending,
			RetryCount: 0,
			MaxRetries: 3,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}

		// Store in database
		if err := s.db.CreatePushNotification(ctx, notification); err != nil {
			s.logger.Error().Err(err).Str("user_id", userID).Msg("failed to create notification")
			continue
		}

		// Add to Redis queue
		queueKey := s.getQueueKey(userID)
		if err := s.redis.LPush(ctx, queueKey, notification.ID).Err(); err != nil {
			s.logger.Error().Err(err).Msg("failed to queue notification")
			continue
		}

		// Set TTL (24 hours)
		s.redis.Expire(ctx, queueKey, 24*time.Hour)
	}

	s.logger.Debug().
		Str("user_id", userID).
		Int("count", len(tokens)).
		Msg("push notifications queued")

	return nil
}

// StartQueueProcessor starts the queue processor
func (s *Service) StartQueueProcessor(ctx context.Context) {
	// Start multiple workers
	var wg sync.WaitGroup
	for i := 0; i < s.workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			s.processQueue(ctx, workerID)
		}(i)
	}
	wg.Wait()
}

// processQueue processes the push notification queue
func (s *Service) processQueue(ctx context.Context, workerID int) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.processBatch(ctx, workerID)
		}
	}
}

// processBatch processes a batch of notifications
func (s *Service) processBatch(ctx context.Context, workerID int) {
	// Get all queue keys
	keys, err := s.redis.Keys(ctx, "push_queue:*").Result()
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get queue keys")
		return
	}

	// Process each queue
	for _, key := range keys {
		// Process batch of 100 notifications
		for i := 0; i < 100; i++ {
			// Pop from queue
			notificationID, err := s.redis.RPop(ctx, key).Result()
			if err != nil {
				break // Queue empty or error
			}

			// Get notification
			notification, err := s.db.GetPushNotification(ctx, notificationID)
			if err != nil {
				s.logger.Error().Err(err).Str("notification_id", notificationID).Msg("failed to get notification")
				continue
			}

			// Send push
			if err := s.sendPush(ctx, notification); err != nil {
				s.logger.Error().Err(err).
					Str("notification_id", notificationID).
					Str("user_id", notification.UserID).
					Msg("failed to send push")

				// Retry later
				notification.RetryCount++
				notification.FailureReason = err.Error()
				notification.UpdatedAt = time.Now()

				if notification.RetryCount < notification.MaxRetries {
					// Requeue with exponential backoff
					backoff := time.Duration(notification.RetryCount) * time.Minute
					time.Sleep(backoff)
					s.redis.LPush(ctx, key, notificationID)
				} else {
					// Mark as failed
					notification.Status = StatusFailed
					s.db.UpdatePushNotification(ctx, notification)
				}
			} else {
				// Mark as sent
				notification.Status = StatusSent
				now := time.Now()
				notification.SentAt = &now
				notification.UpdatedAt = now
				s.db.UpdatePushNotification(ctx, notification)
			}
		}
	}
}

// sendPush sends a push notification
func (s *Service) sendPush(ctx context.Context, notification *Notification) error {
	switch notification.Platform {
	case PlatformAPNS:
		return s.apnsClient.Send(ctx, notification.DeviceID, notification.Payload)
	case PlatformFCM:
		return s.fcmClient.Send(ctx, notification.DeviceID, notification.Payload)
	case PlatformWeb:
		// Get web push subscription from device
		subscription, err := s.getWebPushSubscription(ctx, notification.DeviceID)
		if err != nil {
			return err
		}
		return s.webPushClient.Send(ctx, subscription, notification.Payload)
	default:
		return fmt.Errorf("unsupported platform: %s", notification.Platform)
	}
}

// getWebPushSubscription retrieves web push subscription for a device
func (s *Service) getWebPushSubscription(ctx context.Context, deviceID string) (*WebPushSubscription, error) {
	// In production, fetch from database or cache
	// This is a placeholder
	return &WebPushSubscription{
		Endpoint: "https://fcm.googleapis.com/...",
	}, nil
}

// RegisterPushToken registers a push token for a device
func (s *Service) RegisterPushToken(ctx context.Context, userID, deviceID, token string, platform Platform) error {
	pushToken := &PushToken{
		ID:        generateID(),
		UserID:    userID,
		DeviceID:  deviceID,
		Token:     token,
		Platform:  platform,
		IsActive:  true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.db.CreatePushNotification(ctx, &Notification{
		ID:        pushToken.ID,
		UserID:    userID,
		DeviceID:  deviceID,
		Platform:  platform,
		CreatedAt: time.Now(),
	}); err != nil {
		return fmt.Errorf("failed to register push token: %w", err)
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("device_id", deviceID).
		Str("platform", string(platform)).
		Msg("push token registered")

	return nil
}

// UnregisterPushToken unregisters a push token
func (s *Service) UnregisterPushToken(ctx context.Context, userID, token string) error {
	// In production, mark as inactive instead of deleting
	s.logger.Info().
		Str("user_id", userID).
		Msg("push token unregistered")

	return nil
}

// getQueueKey returns the Redis queue key for a user
func (s *Service) getQueueKey(userID string) string {
	return fmt.Sprintf("push_queue:%s", userID)
}

// generateID generates a unique ID
func generateID() string {
	return fmt.Sprintf("push_%d", time.Now().UnixNano())
}
