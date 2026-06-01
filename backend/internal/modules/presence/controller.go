package presence

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
	group := router.Group("/presence", requireAuth)
	group.Get("/me", ctl.me)
	group.Get("/users/:userId", ctl.get)
	group.Post("/query", ctl.query)
	group.Post("/heartbeat", ctl.heartbeat)
	group.Post("/disconnect", ctl.disconnect)
}

func (ctl *Controller) me(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Me(c.UserContext(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) get(c *fiber.Ctx) error {
	userID, err := httpx.UUIDParam(c, "userId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Get(c.UserContext(), claims.UserID, userID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) query(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[PresenceQueryRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Query(c.UserContext(), claims.UserID, payload.UserIDs)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) heartbeat(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[HeartbeatRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Heartbeat(c.UserContext(), claims.UserID, claims.SessionID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) disconnect(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[DisconnectRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Disconnect(c.UserContext(), claims.UserID, claims.SessionID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}
