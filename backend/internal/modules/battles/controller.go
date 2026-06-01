package battles

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
	group := router.Group("/battles", requireAuth)
	group.Get("/", ctl.list)
	group.Get("/:battleId", ctl.get)
	group.Post("/", ctl.create)
	group.Post("/:battleId/respond", ctl.respond)
	group.Post("/:battleId/votes", ctl.vote)
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
	battleID, err := httpx.UUIDParam(c, "battleId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Get(c.UserContext(), claims.UserID, battleID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) create(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[CreateBattleRequest](c, ctl.validate)
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

func (ctl *Controller) respond(c *fiber.Ctx) error {
	battleID, err := httpx.UUIDParam(c, "battleId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[RespondBattleRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Respond(c.UserContext(), claims.UserID, battleID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) vote(c *fiber.Ctx) error {
	battleID, err := httpx.UUIDParam(c, "battleId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[VoteBattleRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Vote(c.UserContext(), claims.UserID, battleID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}
