package push

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
func (c *Controller) RegisterRoutes(router fiber.Router, requireAuth fiber.Handler) {
	group := router.Group("/notifications/devices", requireAuth)
	group.Post("/", c.register)
	group.Get("/", c.list)
	group.Delete("/:id", c.revoke)
}
func (c *Controller) register(ctx *fiber.Ctx) error {
	req, err := httpx.BindBody[RegisterDeviceRequest](ctx, c.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(ctx)
	response, err := c.service.Register(ctx.UserContext(), claims.UserID, req)
	if err != nil {
		return err
	}
	return ctx.Status(fiber.StatusOK).JSON(httpx.OK(response, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}
func (c *Controller) list(ctx *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(ctx)
	items, err := c.service.List(ctx.UserContext(), claims.UserID)
	if err != nil {
		return err
	}
	return ctx.JSON(httpx.OK(map[string]any{"devices": items}, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}
func (c *Controller) revoke(ctx *fiber.Ctx) error {
	id, err := httpx.UUIDParam(ctx, "id")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(ctx)
	if err := c.service.Revoke(ctx.UserContext(), claims.UserID, id); err != nil {
		return err
	}
	return ctx.SendStatus(fiber.StatusNoContent)
}
