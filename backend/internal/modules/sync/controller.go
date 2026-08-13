package sync

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
	router.Get("/sync", requireAuth, c.get)
}

func (c *Controller) get(ctx *fiber.Ctx) error {
	query, err := httpx.BindQuery[Query](ctx, c.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(ctx)
	response, err := c.service.Sync(ctx.UserContext(), claims.UserID, query.Cursor, query.Limit)
	if err != nil {
		return err
	}
	return ctx.JSON(httpx.OK(response, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}
