package notifications

import (
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/middleware"
)

type Controller struct {
	service  *Service
	validate *validator.Validate
}

func NewController(service *Service, validate *validator.Validate) *Controller {
	return &Controller{service: service, validate: validate}
}

func (ctl *Controller) RegisterRoutes(router fiber.Router, requireAuth fiber.Handler) {
	group := router.Group("/notifications", requireAuth)
	group.Get("/", ctl.list)
	group.Get("/unread-count", ctl.unreadCount)
	group.Post("/:id/read", ctl.markRead)
	group.Post("/read-all", ctl.markAllRead)
}

func (ctl *Controller) list(c *fiber.Ctx) error {
	query, err := httpx.BindQuery[ListQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	items, hasMore, err := ctl.service.List(c.UserContext(), claims.UserID, query.Limit)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(map[string]any{
		"notifications": items,
		"hasMore":       hasMore,
	}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) unreadCount(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	count, err := ctl.service.UnreadCount(c.UserContext(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(UnreadCountResponse{Count: count}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) markRead(c *fiber.Ctx) error {
	id, err := httpx.UUIDParam(c, "id")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	if err := ctl.service.MarkRead(c.UserContext(), claims.UserID, id); err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (ctl *Controller) markAllRead(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	if _, err := ctl.service.MarkAllRead(c.UserContext(), claims.UserID); err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}
