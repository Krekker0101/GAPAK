package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/platform/observability"

	"github.com/gapak/backend/internal/config"
)

func NewPostgres(ctx context.Context, cfg config.DatabaseConfig, registry *observability.Registry) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, err
	}

	poolConfig.MaxConns = cfg.MaxOpenConns
	poolConfig.MinConns = cfg.MinOpenConns
	poolConfig.MaxConnLifetime = cfg.MaxConnLifetime
	poolConfig.MaxConnIdleTime = cfg.MaxConnIdleTime
	if registry != nil {
		poolConfig.ConnConfig.Tracer = observability.QueryTracer{Registry: registry}
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, err
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres ping failed: %w", err)
	}

	return pool, nil
}

func StartPoolMetrics(ctx context.Context, pool *pgxpool.Pool, registry *observability.Registry) {
	if pool == nil || registry == nil {
		return
	}
	update := func() {
		s := pool.Stat()
		registry.SetDBStats(observability.DBStats{
			AcquireCount: uint64(s.AcquireCount()), AcquiredConns: s.AcquiredConns(), IdleConns: s.IdleConns(), TotalConns: s.TotalConns(), MaxConns: s.MaxConns(),
		})
	}
	update()
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				update()
			}
		}
	}()
}
