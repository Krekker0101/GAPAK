package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"github.com/gapak/backend/internal/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	application, err := app.New(ctx)
	if err != nil {
		log.Fatalf("bootstrap failed: %v", err)
	}

	if err := application.Run(ctx); err != nil {
		log.Fatalf("server exited with error: %v", err)
	}
}
