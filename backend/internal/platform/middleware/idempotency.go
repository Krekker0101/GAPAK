package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"

	authplatform "github.com/gapak/backend/internal/platform/auth"
)

const idempotencyTTL = 5 * time.Minute

type idempotentResponse struct {
	Status      int                 `json:"status"`
	ContentType string              `json:"contentType,omitempty"`
	Headers     map[string][]string `json:"headers,omitempty"`
	RequestHash string              `json:"requestHash,omitempty"`
	Body        string              `json:"body,omitempty"` // base64-encoded response body
}

// Idempotency deduplicates client-keyed mutation retries and replays the exact
// persisted successful HTTP response. Authentication routes keep their own
// explicit idempotency middleware; the global registration skips /auth paths.
// Redis unavailability does not make an otherwise healthy request unavailable.
func Idempotency(redisClient *redis.Client, db *pgxpool.Pool, jwtManager *authplatform.Manager) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if c.Method() == fiber.MethodGet || c.Method() == fiber.MethodHead || c.Method() == fiber.MethodOptions {
			return c.Next()
		}
		if strings.HasPrefix(c.Path(), "/api/v1/auth/") {
			return c.Next()
		}

		key := strings.TrimSpace(c.Get("X-Idempotency-Key"))
		if key == "" {
			return c.Next()
		}
		if len(key) > 128 {
			return fiber.NewError(fiber.StatusBadRequest, "Idempotency key is too long")
		}

		identity := idempotencyIdentity(c, jwtManager)
		requestHash := idempotencyRequestHash(c)
		digest := sha256.Sum256([]byte(strings.Join([]string{identity, c.Method(), c.Path(), key}, "|")))
		redisKey := "idempotent:" + hex.EncodeToString(digest[:])
		// PostgreSQL is the authoritative idempotency store. Redis is used only
		// when no database is available, so a cache miss can never re-execute a
		// mutation that was already committed and durably recorded.
		if db != nil {
			return executeWithDBIdempotency(c, db, identity, c.Method(), c.Path(), key, requestHash)
		}

		ctx, cancel := context.WithTimeout(c.UserContext(), 750*time.Millisecond)
		defer cancel()

		if redisClient != nil {
			stored, err := redisClient.Get(ctx, redisKey).Result()
			if err == nil {
				var response idempotentResponse
				if json.Unmarshal([]byte(stored), &response) == nil {
					if response.RequestHash != requestHash {
						return fiber.NewError(fiber.StatusConflict, "Idempotency key was already used for a different request")
					}
					if response.Status >= 200 && response.Status < 400 {
						return replayIdempotentResponse(c, response)
					}
				}
			}
			if err != nil && err != redis.Nil {
				// Fall through to the authoritative PostgreSQL idempotency store.
			}
			claimed, err := redisClient.SetNX(ctx, redisKey, "inflight:"+requestHash, idempotencyTTL).Result()
			if err == nil {
				if !claimed {
					stored, _ := redisClient.Get(ctx, redisKey).Result()
					if strings.HasPrefix(stored, "inflight:") {
						return fiber.NewError(fiber.StatusConflict, "Request with this idempotency key is already in progress")
					}
					var response idempotentResponse
					if json.Unmarshal([]byte(stored), &response) == nil {
						if response.RequestHash != requestHash {
							return fiber.NewError(fiber.StatusConflict, "Idempotency key was already used for a different request")
						}
						return replayIdempotentResponse(c, response)
					}
					return fiber.NewError(fiber.StatusConflict, "Request with this idempotency key is already in progress")
				}
				return executeAndPersistRedis(c, redisClient, redisKey, requestHash)
			}
		}

		return c.Next()
	}
}

func idempotencyRequestHash(c *fiber.Ctx) string {
	digest := sha256.New()
	for _, part := range [][]byte{
		[]byte(c.Method()),
		[]byte(c.Path()),
		c.Request().URI().QueryString(),
		[]byte(c.Get(fiber.HeaderContentType)),
		c.Body(),
	} {
		_, _ = digest.Write([]byte{0})
		_, _ = digest.Write(part)
	}
	return hex.EncodeToString(digest.Sum(nil))
}

func captureReplayHeaders(c *fiber.Ctx) map[string][]string {
	headers := make(map[string][]string)
	c.Response().Header.VisitAll(func(key, value []byte) {
		name := string(key)
		if strings.EqualFold(name, fiber.HeaderContentLength) ||
			strings.EqualFold(name, "Connection") ||
			strings.EqualFold(name, "Transfer-Encoding") {
			return
		}
		headers[name] = append(headers[name], string(value))
	})
	return headers
}

func idempotencyIdentity(c *fiber.Ctx, jwtManager *authplatform.Manager) string {
	if jwtManager != nil {
		if token := bearerToken(c.Get(fiber.HeaderAuthorization)); token != "" {
			if claims, err := jwtManager.VerifyAccessToken(c.UserContext(), token); err == nil {
				return "user:" + claims.UserID + ":session:" + claims.SessionID
			}
		}
		if token := strings.TrimSpace(c.Cookies(authplatform.AccessCookieName)); token != "" {
			if claims, err := jwtManager.VerifyAccessToken(c.UserContext(), token); err == nil {
				return "user:" + claims.UserID + ":session:" + claims.SessionID
			}
		}
	}
	path := c.Path()
	if strings.HasPrefix(path, "/api/v1/auth/") {
		var payload map[string]any
		if len(c.Body()) > 0 && json.Unmarshal(c.Body(), &payload) == nil {
			for _, field := range []string{"login", "email", "username", "token"} {
				if v, ok := payload[field].(string); ok && strings.TrimSpace(v) != "" {
					h := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(v))))
					return "auth:" + hex.EncodeToString(h[:])
				}
			}
		}
	}
	if refresh := strings.TrimSpace(c.Cookies("gapak_rt")); refresh != "" {
		h := sha256.Sum256([]byte(refresh))
		return "refresh:" + hex.EncodeToString(h[:])
	}
	if fingerprint := strings.TrimSpace(c.Get("X-Device-Fingerprint")); fingerprint != "" {
		return "device:" + fingerprint
	}
	return "ip:" + strings.TrimSpace(c.IP())
}

func replayIdempotentResponse(c *fiber.Ctx, response idempotentResponse) error {
	body, decodeErr := base64.StdEncoding.DecodeString(response.Body)
	if decodeErr != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Stored idempotent response is invalid")
	}
	for header, values := range response.Headers {
		for _, value := range values {
			c.Append(header, value)
		}
	}
	if response.ContentType != "" && len(response.Headers[fiber.HeaderContentType]) == 0 {
		c.Set(fiber.HeaderContentType, response.ContentType)
	}
	return c.Status(response.Status).Send(body)
}

func executeAndPersistRedis(c *fiber.Ctx, redisClient *redis.Client, redisKey, requestHash string) error {
	if err := c.Next(); err != nil || c.Response().StatusCode() >= 400 {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
		_ = redisClient.Del(cleanupCtx, redisKey).Err()
		cleanupCancel()
		return err
	}
	response := idempotentResponse{Status: c.Response().StatusCode(), ContentType: string(c.Response().Header.ContentType()), Headers: captureReplayHeaders(c), RequestHash: requestHash, Body: base64.StdEncoding.EncodeToString(c.Response().Body())}
	payload, marshalErr := json.Marshal(response)
	if marshalErr != nil {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
		_ = redisClient.Del(cleanupCtx, redisKey).Err()
		cleanupCancel()
		return marshalErr
	}
	persistCtx, persistCancel := context.WithTimeout(context.WithoutCancel(c.UserContext()), 750*time.Millisecond)
	defer persistCancel()
	// If persistence fails, leave the INFLIGHT marker to expire instead of
	// deleting it and immediately allowing a duplicate mutation.
	_ = redisClient.Set(persistCtx, redisKey, payload, idempotencyTTL).Err()
	return nil
}

func executeWithDBIdempotency(c *fiber.Ctx, db *pgxpool.Pool, identity, method, path, key, requestHash string) error {
	ctx, cancel := context.WithTimeout(c.UserContext(), 2*time.Second)
	defer cancel()
	var stored idempotentResponse
	var responseBody string
	var responseHeaders []byte
	var status *int
	var contentType string
	var state string
	row := db.QueryRow(ctx, `
		INSERT INTO http_idempotency_records (id, identity_key, method, path, idempotency_key, request_hash, status, content_type, headers_json, body_b64, state, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NULL, '', '{}'::jsonb, '', 'INFLIGHT', NOW() + INTERVAL '5 minutes', NOW(), NOW())
		ON CONFLICT (identity_key, method, path, idempotency_key) DO NOTHING
		RETURNING status, content_type, headers_json, body_b64, state`, uuid.NewString(), identity, method, path, key, requestHash)
	if err := row.Scan(&status, &contentType, &responseHeaders, &responseBody, &state); err == nil {
		if status != nil && *status >= 200 && *status < 400 && state == "DONE" {
			_ = json.Unmarshal(responseHeaders, &stored.Headers)
			stored.Status, stored.ContentType, stored.RequestHash, stored.Body = *status, contentType, requestHash, responseBody
			return replayIdempotentResponse(c, stored)
		}
		if state == "INFLIGHT" {
			// This request won the INSERT and owns the key.
			goto EXECUTE
		}
	} else {
		// No RETURNING row means another worker owns the key; inspect it.
		row = db.QueryRow(ctx, `SELECT status, content_type, headers_json, body_b64, state, request_hash FROM http_idempotency_records WHERE identity_key=$1 AND method=$2 AND path=$3 AND idempotency_key=$4`, identity, method, path, key)
		var existingHash string
		if err := row.Scan(&status, &contentType, &responseHeaders, &responseBody, &state, &existingHash); err != nil {
			return err
		}
		if existingHash != requestHash {
			return fiber.NewError(fiber.StatusConflict, "Idempotency key was already used for a different request")
		}
		if state == "DONE" && status != nil && *status >= 200 && *status < 400 {
			_ = json.Unmarshal(responseHeaders, &stored.Headers)
			stored.Status, stored.ContentType, stored.RequestHash, stored.Body = *status, contentType, requestHash, responseBody
			return replayIdempotentResponse(c, stored)
		}
		if state == "INFLIGHT" {
			var reclaimed int
			err := db.QueryRow(ctx, `
				UPDATE http_idempotency_records
				SET id=$5, expires_at=NOW()+INTERVAL '5 minutes', updated_at=NOW()
				WHERE identity_key=$1 AND method=$2 AND path=$3 AND idempotency_key=$4
				  AND request_hash=$6 AND state='INFLIGHT' AND expires_at <= NOW()
				RETURNING 1`, identity, method, path, key, uuid.NewString(), requestHash).Scan(&reclaimed)
			if err == nil && reclaimed == 1 {
				goto EXECUTE
			}
			return fiber.NewError(fiber.StatusConflict, "Request with this idempotency key is already in progress")
		}
	}
EXECUTE:
	// The claim timeout protects only database coordination. Business handlers
	// may legitimately take longer, so persistence gets a fresh bounded context.
	cancel()
	handlerErr := c.Next()
	persistCtx, persistCancel := context.WithTimeout(context.WithoutCancel(c.UserContext()), 2*time.Second)
	defer persistCancel()
	if handlerErr != nil || c.Response().StatusCode() >= 400 {
		_, _ = db.Exec(persistCtx, `DELETE FROM http_idempotency_records WHERE identity_key=$1 AND method=$2 AND path=$3 AND idempotency_key=$4 AND state='INFLIGHT'`, identity, method, path, key)
		return handlerErr
	}
	stored = idempotentResponse{Status: c.Response().StatusCode(), ContentType: string(c.Response().Header.ContentType()), Headers: captureReplayHeaders(c), RequestHash: requestHash, Body: base64.StdEncoding.EncodeToString(c.Response().Body())}
	headersJSON, _ := json.Marshal(stored.Headers)
	_, err := db.Exec(persistCtx, `UPDATE http_idempotency_records SET status=$5, content_type=$6, headers_json=$7::jsonb, body_b64=$8, state='DONE', updated_at=NOW() WHERE identity_key=$1 AND method=$2 AND path=$3 AND idempotency_key=$4 AND request_hash=$9`, identity, method, path, key, stored.Status, stored.ContentType, headersJSON, stored.Body, requestHash)
	return err
}
