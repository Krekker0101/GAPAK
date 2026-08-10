package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/platform/observability"
)

func NewRedis(_ context.Context, cfg config.RedisConfig, registry *observability.Registry) (*redis.Client, error) {
	options, err := redis.ParseURL(cfg.URL)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(options)
	if registry != nil {
		client.AddHook(observability.RedisHook{Registry: registry})
	}
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}
	return client, nil
}
