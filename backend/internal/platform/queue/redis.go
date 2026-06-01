package queue

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Envelope struct {
	ID          string          `json:"id"`
	Type        string          `json:"type"`
	ResourceID  string          `json:"resourceId"`
	ResourceRef string          `json:"resourceRef,omitempty"`
	Payload     json.RawMessage `json:"payload"`
	QueuedAt    time.Time       `json:"queuedAt"`
}

type Publisher interface {
	Publish(ctx context.Context, queueName string, envelope Envelope) error
	PublishLiveEvent(ctx context.Context, channel string, payload any) error
}

type Consumer interface {
	Consume(ctx context.Context, queueName string, timeout time.Duration) (*Envelope, error)
}

type RedisQueue struct {
	client *redis.Client
}

func NewRedisQueue(client *redis.Client) *RedisQueue {
	return &RedisQueue{client: client}
}

func (q *RedisQueue) Available() bool {
	return q != nil && q.client != nil
}

func (q *RedisQueue) Publish(ctx context.Context, queueName string, envelope Envelope) error {
	if !q.Available() {
		return apperrors.ErrDependencyUnavailable
	}
	body, err := json.Marshal(envelope)
	if err != nil {
		return err
	}
	return q.client.LPush(ctx, queueName, body).Err()
}

func (q *RedisQueue) Consume(ctx context.Context, queueName string, timeout time.Duration) (*Envelope, error) {
	if !q.Available() {
		return nil, apperrors.ErrDependencyUnavailable
	}
	values, err := q.client.BRPop(ctx, timeout, queueName).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, nil
		}
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			return nil, nil
		}
		return nil, err
	}
	if len(values) != 2 {
		return nil, apperrors.ErrInternal
	}
	var envelope Envelope
	if err := json.Unmarshal([]byte(values[1]), &envelope); err != nil {
		return nil, err
	}
	return &envelope, nil
}

func (q *RedisQueue) PublishLiveEvent(ctx context.Context, channel string, payload any) error {
	if !q.Available() {
		return apperrors.ErrDependencyUnavailable
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return q.client.Publish(ctx, channel, body).Err()
}
