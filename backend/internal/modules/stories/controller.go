package stories

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
	group := router.Group("/stories", requireAuth)
	group.Get("/feed", ctl.feed)
	group.Get("/:storyId", ctl.get)
	group.Get("/:storyId/viewers", ctl.viewers)
	group.Post("/", ctl.create)
	group.Post("/:storyId/reactions", ctl.react)
	group.Post("/:storyId/highlight", ctl.highlight)
}

func (ctl *Controller) feed(c *fiber.Ctx) error {
	query, err := httpx.BindQuery[FeedQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Feed(c.UserContext(), claims.UserID, query.Page, query.Limit)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) get(c *fiber.Ctx) error {
	storyID, err := httpx.UUIDParam(c, "storyId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Get(c.UserContext(), claims.UserID, storyID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) viewers(c *fiber.Ctx) error {
	storyID, err := httpx.UUIDParam(c, "storyId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Viewers(c.UserContext(), claims.UserID, storyID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) create(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[CreateStoryRequest](c, ctl.validate)
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

func (ctl *Controller) react(c *fiber.Ctx) error {
	storyID, err := httpx.UUIDParam(c, "storyId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[ReactStoryRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.React(c.UserContext(), claims.UserID, storyID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) highlight(c *fiber.Ctx) error {
	storyID, err := httpx.UUIDParam(c, "storyId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[HighlightStoryRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Highlight(c.UserContext(), claims.UserID, storyID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}
