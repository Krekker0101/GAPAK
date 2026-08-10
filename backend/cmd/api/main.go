package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"github.com/gapak/backend/internal/app"
	"github.com/gapak/backend/internal/platform/version"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	log.Printf("gapak startup version=%s commit=%s build_time=%s", version.Version, version.Commit, version.BuildTime)

	application, err := app.New(ctx)
	if err != nil {
		log.Fatalf("bootstrap failed: %v", err)
	}

	if err := application.Run(ctx); err != nil {
		log.Fatalf("server exited with error: %v", err)
	}
}
