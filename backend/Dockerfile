ARG GO_VERSION=1.26.6
ARG RUNTIME_VERSION=3.21

FROM golang:${GO_VERSION}-alpine AS builder

ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_TIME=unknown

WORKDIR /src

RUN apk add --no-cache ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN set -eux; \
    mkdir -p /out; \
    LDFLAGS="-s -w -X github.com/gapak/backend/internal/platform/version.Version=${VERSION} -X github.com/gapak/backend/internal/platform/version.Commit=${COMMIT} -X github.com/gapak/backend/internal/platform/version.BuildTime=${BUILD_TIME}"; \
    for target in api worker migrate admin; do \
      CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
      go build -trimpath -buildvcs=false -ldflags "${LDFLAGS}" -o "/out/gapak-${target}" "./cmd/${target}"; \
    done

FROM alpine:${RUNTIME_VERSION}

ARG VERSION=dev
LABEL org.opencontainers.image.title="GAPAK Backend" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="https://github.com/gapak/backend"

RUN apk add --no-cache ffmpeg ca-certificates tzdata \
    && addgroup -S gapak \
    && adduser -S -G gapak -h /nonexistent -s /sbin/nologin gapak \
    && mkdir -p /app /tmp \
    && chown -R gapak:gapak /app /tmp

WORKDIR /app
COPY --from=builder /out/gapak-api /usr/local/bin/gapak-api
COPY --from=builder /out/gapak-worker /usr/local/bin/gapak-worker
COPY --from=builder /out/gapak-migrate /usr/local/bin/gapak-migrate
COPY --from=builder /out/gapak-admin /usr/local/bin/gapak-admin
COPY docs ./docs
COPY db ./db
COPY .env.example ./.env.example

USER gapak

EXPOSE 8080 9091

ENTRYPOINT ["/usr/local/bin/gapak-api"]
