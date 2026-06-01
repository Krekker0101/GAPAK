FROM golang:1.24.3-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /gapak-api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /gapak-worker ./cmd/worker
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /gapak-migrate ./cmd/migrate

FROM alpine:3.21

WORKDIR /app

RUN addgroup -S gapak && adduser -S gapak -G gapak

COPY --from=builder /gapak-api /usr/local/bin/gapak-api
COPY --from=builder /gapak-worker /usr/local/bin/gapak-worker
COPY --from=builder /gapak-migrate /usr/local/bin/gapak-migrate
COPY docs ./docs
COPY db ./db
COPY .env.example ./.env.example

USER gapak

EXPOSE 8080

CMD ["gapak-api"]
