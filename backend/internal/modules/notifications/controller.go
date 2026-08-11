package notifications

import (
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/middleware"
)

type Controller struct{ db *pgxpool.Pool }

func NewController(db *pgxpool.Pool) *Controller { return &Controller{db: db} }

func (ctl *Controller) RegisterRoutes(router fiber.Router, requireAuth fiber.Handler) {
	group := router.Group("/notifications", requireAuth)
	group.Get("/", ctl.list)
	group.Get("/unread-count", ctl.unreadCount)
	group.Post("/:id/read", ctl.markRead)
	group.Post("/read-all", ctl.markAllRead)
}

type item struct {
	ID        string         `json:"id"`
	Type      string         `json:"type"`
	Title     string         `json:"title"`
	Body      string         `json:"body,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
	ReadAt    *time.Time     `json:"readAt,omitempty"`
	ActionURL *string        `json:"targetUrl,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

func (ctl *Controller) list(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	limit := c.QueryInt("limit", 20)
	if limit < 1 {
		limit = 1
	}
	if limit > 50 {
		limit = 50
	}
	rows, err := ctl.db.Query(c.UserContext(), `
        SELECT id::text, type, title, body, created_at, CASE WHEN is_read THEN created_at ELSE NULL END, action_url, COALESCE(data, '{}'::jsonb)
        FROM notifications WHERE user_id=$1 ORDER BY created_at DESC, id DESC LIMIT $2`, claims.UserID, limit)
	if err != nil {
		return err
	}
	defer rows.Close()
	out := make([]item, 0, limit)
	for rows.Next() {
		var v item
		var data []byte
		if err := rows.Scan(&v.ID, &v.Type, &v.Title, &v.Body, &v.CreatedAt, &v.ReadAt, &v.ActionURL, &data); err != nil {
			return err
		}
		v.Metadata = map[string]any{}
		_ = jsonUnmarshal(data, &v.Metadata)
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return c.JSON(httpx.OK(map[string]any{"notifications": out, "hasMore": len(out) == limit}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) unreadCount(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	var count int
	if err := ctl.db.QueryRow(c.UserContext(), `SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=FALSE`, claims.UserID).Scan(&count); err != nil {
		return err
	}
	return c.JSON(httpx.OK(map[string]int{"count": count}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) markRead(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	id, err := httpx.UUIDParam(c, "id")
	if err != nil {
		return err
	}
	tag, err := ctl.db.Exec(c.UserContext(), `UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2`, id, claims.UserID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (ctl *Controller) markAllRead(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	if _, err := ctl.db.Exec(c.UserContext(), `UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND is_read=FALSE`, claims.UserID); err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Small local decoder keeps the module independent from the legacy notification model package.
func jsonUnmarshal(data []byte, dst *map[string]any) error {
	if len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, dst)
}
