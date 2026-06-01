package live

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
	group := router.Group("/live-streams", requireAuth)
	group.Get("/", ctl.list)
	group.Get("/:streamId", ctl.get)
	group.Get("/:streamId/events", ctl.events)
	group.Get("/:streamId/chat", ctl.chat)
	group.Post("/", ctl.create)
	group.Post("/:streamId/start", ctl.start)
	group.Post("/:streamId/end", ctl.end)
	group.Post("/:streamId/join", ctl.join)
	group.Post("/:streamId/chat", ctl.postChatMessage)
}

func (ctl *Controller) list(c *fiber.Ctx) error {
	query, err := httpx.BindQuery[ListQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.List(c.UserContext(), claims.UserID, query.Page, query.Limit)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) get(c *fiber.Ctx) error {
	streamID, err := httpx.UUIDParam(c, "streamId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Get(c.UserContext(), claims.UserID, streamID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) events(c *fiber.Ctx) error {
	streamID, err := httpx.UUIDParam(c, "streamId")
	if err != nil {
		return err
	}
	query, err := httpx.BindQuery[ListEventsQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, pagination, err := ctl.service.Events(c.UserContext(), claims.UserID, streamID, query.After, query.Limit)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), pagination))
}

func (ctl *Controller) create(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[CreateLiveStreamRequest](c, ctl.validate)
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

func (ctl *Controller) start(c *fiber.Ctx) error {
	streamID, err := httpx.UUIDParam(c, "streamId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Start(c.UserContext(), claims.UserID, streamID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) end(c *fiber.Ctx) error {
	streamID, err := httpx.UUIDParam(c, "streamId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.End(c.UserContext(), claims.UserID, streamID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) join(c *fiber.Ctx) error {
	streamID, err := httpx.UUIDParam(c, "streamId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[JoinLiveRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Join(c.UserContext(), claims.UserID, streamID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) chat(c *fiber.Ctx) error {
	streamID, err := httpx.UUIDParam(c, "streamId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Chat(c.UserContext(), claims.UserID, streamID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) postChatMessage(c *fiber.Ctx) error {
	streamID, err := httpx.UUIDParam(c, "streamId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[LiveChatMessageRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.PostChatMessage(c.UserContext(), claims.UserID, streamID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}
