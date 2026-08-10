package observability

import (
	"context"
	"net"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisHook struct{ Registry *Registry }

func (h RedisHook) DialHook(next redis.DialHook) redis.DialHook {
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		conn, err := next(ctx, network, addr)
		if h.Registry != nil {
			value := int64(0)
			if err == nil {
				value = 1
			}
			h.Registry.RedisConnectionState.Set(Label("state", "connected"), value)
		}
		return conn, err
	}
}

func (h RedisHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		started := time.Now()
		err := next(ctx, cmd)
		if h.Registry != nil {
			key := Label("command", cmd.Name())
			h.Registry.RedisCommands.Inc(key)
			h.Registry.RedisLatency.Observe(key, time.Since(started).Seconds())
			if err != nil && err != redis.Nil {
				h.Registry.RedisErrors.Inc(key)
				h.Registry.RedisConnectionState.Set(Label("state", "connected"), 0)
			} else if err == nil {
				h.Registry.RedisConnectionState.Set(Label("state", "connected"), 1)
			}
		}
		return err
	}
}

func (h RedisHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		started := time.Now()
		err := next(ctx, cmds)
		if h.Registry != nil {
			for _, cmd := range cmds {
				key := Label("command", cmd.Name())
				h.Registry.RedisCommands.Inc(key)
				h.Registry.RedisLatency.Observe(key, time.Since(started).Seconds())
				if e := cmd.Err(); e != nil && e != redis.Nil {
					h.Registry.RedisErrors.Inc(key)
				}
			}
			if err == nil {
				h.Registry.RedisConnectionState.Set(Label("state", "connected"), 1)
			} else {
				h.Registry.RedisConnectionState.Set(Label("state", "connected"), 0)
			}
		}
		return err
	}
}
