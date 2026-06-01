package moderation

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

func (ctl *Controller) RegisterRoutes(router fiber.Router, requireAuth fiber.Handler, requireModerationRead fiber.Handler, requireModerationWrite fiber.Handler) {
	group := router.Group("/moderation", requireAuth)
	group.Post("/reports", ctl.create)
	group.Get("/reports", ctl.own)

	admin := router.Group("/admin/moderation", requireAuth, requireModerationRead)
	admin.Get("/reports", ctl.all)
	admin.Post("/reports/:reportId/resolve", requireModerationWrite, ctl.resolve)
}

func (ctl *Controller) create(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[CreateReportRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Create(c.UserContext(), claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) own(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Own(c.UserContext(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) all(c *fiber.Ctx) error {
	response, err := ctl.service.All(c.UserContext())
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) resolve(c *fiber.Ctx) error {
	reportID, err := httpx.UUIDParam(c, "reportId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[ResolveReportRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Resolve(c.UserContext(), claims.UserID, reportID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}
