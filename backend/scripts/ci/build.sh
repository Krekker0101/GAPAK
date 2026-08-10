#!/bin/sh
set -eu

VERSION="${VERSION:-dev}"
COMMIT="${COMMIT:-unknown}"
BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
LDFLAGS="-s -w -X github.com/gapak/backend/internal/platform/version.Version=${VERSION} -X github.com/gapak/backend/internal/platform/version.Commit=${COMMIT} -X github.com/gapak/backend/internal/platform/version.BuildTime=${BUILD_TIME}"

mkdir -p bin
for target in api worker migrate admin; do
  CGO_ENABLED=0 GOOS=linux GOARCH="${GOARCH:-amd64}" \
    go build -trimpath -buildvcs=false -ldflags "$LDFLAGS" -o "bin/gapak-${target}" "./cmd/${target}"
done
