package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/gapak/backend/internal/app"
	"github.com/gapak/backend/internal/platform/version"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if version.Commit == "unknown" {
		if commit := strings.TrimSpace(os.Getenv("RAILWAY_GIT_COMMIT_SHA")); commit != "" {
			version.Commit = commit
		}
	}
	if version.Version == "dev" && strings.TrimSpace(os.Getenv("RAILWAY_GIT_BRANCH")) != "" {
		version.Version = strings.TrimSpace(os.Getenv("RAILWAY_GIT_BRANCH"))
	}

	// stdout is classified as informational by Railway; keep normal startup
	// metadata out of stderr so a healthy boot is not rendered as an error.
	fmt.Printf("gapak startup version=%s commit=%s build_time=%s\n", version.Version, version.Commit, version.BuildTime)

	application, err := app.New(ctx)
	if err != nil {
		log.Fatalf("bootstrap failed: %v", err)
	}

	if err := application.Run(ctx); err != nil {
		log.Fatalf("server exited with error: %v", err)
	}
}
