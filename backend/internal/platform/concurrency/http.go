package concurrency

import (
	"context"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/platform/httpx"
)

type storeContextKey string

const storeKey storeContextKey = "gapak.concurrency.store"

func WithStore(c *fiber.Ctx, store *Store) { c.Locals(storeKey, store) }
func StoreFromFiber(c *fiber.Ctx) *Store {
	if v := c.Locals(storeKey); v != nil {
		if s, ok := v.(*Store); ok {
			return s
		}
	}
	return nil
}

func PrepareMutation(c *fiber.Ctx) error {
	rev, ok, err := ParseIfMatch(c.Get("If-Match"))
	if err != nil {
		return err
	}
	if ok {
		ctx := WithExpectedRevision(c.UserContext(), rev)
		if store := StoreFromFiber(c); store != nil {
			ctx = WithSecret(ctx, string(store.secret))
		}
		c.SetUserContext(ctx)
	}
	return nil
}

func WriteVersionedJSON(c *fiber.Ctx, resourceType, resourceID string, payload any, meta any) error {
	metaMap := normalizeMeta(meta)
	store := StoreFromFiber(c)
	if store == nil {
		return c.JSON(httpx.OK(payload, c.GetRespHeader(fiber.HeaderXRequestID), metaMap))
	}
	rev, err := store.GetRevision(c.UserContext(), resourceType, resourceID)
	if err != nil {
		return err
	}
	etag := ETag(resourceType, resourceID, rev, string(store.secret))
	c.Set("ETag", etag)
	c.Set("Cache-Control", "private, no-cache, must-revalidate")
	c.Set("Vary", "Authorization, Cookie")
	if matches := strings.TrimSpace(c.Get("If-None-Match")); matches != "" && (matches == "*" || strings.TrimSpace(matches) == etag) {
		c.Status(fiber.StatusNotModified)
		return nil
	}
	return c.JSON(httpx.OK(payload, c.GetRespHeader(fiber.HeaderXRequestID), metaMap))
}

func normalizeMeta(meta any) map[string]any {
	if meta == nil {
		return nil
	}
	if m, ok := meta.(map[string]any); ok {
		return m
	}
	return map[string]any{"value": meta}
}

func SetMutationETag(c *fiber.Ctx, resourceType, resourceID string) error {
	store := StoreFromFiber(c)
	if store == nil {
		return nil
	}
	rev, err := store.GetRevision(c.UserContext(), resourceType, resourceID)
	if err != nil {
		return err
	}
	c.Set("ETag", ETag(resourceType, resourceID, rev, string(store.secret)))
	c.Set("Cache-Control", "no-store")
	return nil
}

func WithExpectedRevisionContext(ctx context.Context, revision int64) context.Context {
	return WithExpectedRevision(ctx, revision)
}
