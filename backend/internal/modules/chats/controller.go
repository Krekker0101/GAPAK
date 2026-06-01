package chats

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
	group := router.Group("/chats", requireAuth)
	group.Get("/", ctl.list)
	group.Post("/direct", ctl.createDirect)
	group.Get("/:chatId/events", ctl.events)
	group.Get("/:chatId/messages", ctl.messages)
	group.Post("/:chatId/messages", ctl.send)
}

func (ctl *Controller) list(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.List(c.UserContext(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) createDirect(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[CreateDirectChatRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.CreateDirect(c.UserContext(), claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) messages(c *fiber.Ctx) error {
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	query, err := httpx.BindQuery[MessagesQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Messages(c.UserContext(), claims.UserID, chatID, query.Page, query.Limit)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) events(c *fiber.Ctx) error {
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	query, err := httpx.BindQuery[EventsQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, pagination, err := ctl.service.Events(c.UserContext(), claims.UserID, chatID, query.After, query.Limit)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), pagination))
}

func (ctl *Controller) send(c *fiber.Ctx) error {
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[SendMessageRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Send(c.UserContext(), claims.UserID, chatID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}
