package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
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

type Delivery struct {
	Envelope
	ack func() error
}

// Ack removes the message from the queue after successful processing.
func (d *Delivery) Ack() error {
	if d == nil || d.ack == nil {
		return nil
	}
	return d.ack()
}

type Publisher interface {
	Publish(ctx context.Context, queueName string, envelope Envelope) error
	PublishLiveEvent(ctx context.Context, channel string, payload any) error
}

type Consumer interface {
	Consume(ctx context.Context, queueName string, timeout time.Duration, consumerID string) (*Delivery, error)
}

type RedisQueue struct {
	client  *redis.Client
	group   string
	minIdle time.Duration
}

func NewRedisQueue(client *redis.Client) *RedisQueue {
	return &RedisQueue{
		client:  client,
		group:   "queue-workers",
		minIdle: 5 * time.Minute,
	}
}

func (q *RedisQueue) Available() bool {
	return q != nil && q.client != nil
}

func (q *RedisQueue) streamKey(queueName string) string {
	return fmt.Sprintf("stream:%s", queueName)
}

func (q *RedisQueue) Publish(ctx context.Context, queueName string, envelope Envelope) error {
	if !q.Available() {
		return apperrors.ErrDependencyUnavailable
	}
	body, err := json.Marshal(envelope)
	if err != nil {
		return err
	}
	_, err = q.client.XAdd(ctx, &redis.XAddArgs{
		Stream: q.streamKey(queueName),
		MaxLen: 10000,
		Approx: true,
		Values: map[string]interface{}{"payload": string(body)},
	}).Result()
	return err
}

func (q *RedisQueue) Consume(ctx context.Context, queueName string, timeout time.Duration, consumerID string) (*Delivery, error) {
	if !q.Available() {
		return nil, apperrors.ErrDependencyUnavailable
	}
	if consumerID == "" {
		consumerID = "default"
	}
	streamKey := q.streamKey(queueName)
	if err := q.ensureGroup(ctx, streamKey); err != nil {
		return nil, err
	}

	// Claim messages that were delivered to another consumer but never acknowledged.
	msgs, _, err := q.client.XAutoClaim(ctx, &redis.XAutoClaimArgs{
		Stream:   streamKey,
		Group:    q.group,
		Consumer: consumerID,
		MinIdle:  q.minIdle,
		Start:    "0",
		Count:    1,
	}).Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return nil, err
	}
	if len(msgs) > 0 {
		return q.toDelivery(ctx, streamKey, msgs[0])
	}

	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	streams, err := q.client.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    q.group,
		Consumer: consumerID,
		Streams:  []string{streamKey, ">"},
		Count:    1,
		Block:    timeout,
	}).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, nil
		}
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			return nil, nil
		}
		return nil, err
	}
	for _, stream := range streams {
		for _, msg := range stream.Messages {
			return q.toDelivery(ctx, streamKey, msg)
		}
	}
	return nil, nil
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

func (q *RedisQueue) ensureGroup(ctx context.Context, streamKey string) error {
	err := q.client.XGroupCreateMkStream(ctx, streamKey, q.group, "$").Err()
	if err == nil {
		return nil
	}
	if strings.Contains(err.Error(), "BUSYGROUP") {
		return nil
	}
	return err
}

func (q *RedisQueue) toDelivery(ctx context.Context, streamKey string, msg redis.XMessage) (*Delivery, error) {
	raw, ok := msg.Values["payload"].(string)
	if !ok {
		return nil, apperrors.New(500, "queue.invalid_payload", "queue payload missing or invalid")
	}
	var envelope Envelope
	if err := json.Unmarshal([]byte(raw), &envelope); err != nil {
		return nil, err
	}
	streamID := msg.ID
	d := &Delivery{
		Envelope: envelope,
		ack: func() error {
			ackCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
			defer cancel()
			return q.client.XAck(ackCtx, streamKey, q.group, streamID).Err()
		},
	}
	return d, nil
}
