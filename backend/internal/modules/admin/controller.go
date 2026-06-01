package admin

import (
	"strconv"
	"strings"

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

func (ctl *Controller) RegisterRoutes(
	router fiber.Router,
	requireAuth fiber.Handler,
	requireDashboardRead fiber.Handler,
	requireUsersRead fiber.Handler,
	requireUsersWrite fiber.Handler,
	requireContentRead fiber.Handler,
	requireContentWrite fiber.Handler,
) {
	group := router.Group("/admin", requireAuth)
	group.Get("/overview", requireDashboardRead, ctl.overview)
	group.Get("/users", requireUsersRead, ctl.listUsers)
	group.Patch("/users/:userID", requireUsersWrite, ctl.updateUser)
	group.Get("/content/pages", requireContentRead, ctl.listPages)
	group.Get("/content/pages/:slug", requireContentRead, ctl.getPage)
	group.Put("/content/pages/:slug", requireContentWrite, ctl.updatePage)
}

func (ctl *Controller) overview(c *fiber.Ctx) error {
	response, err := ctl.service.Overview(c.UserContext())
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) listUsers(c *fiber.Ctx) error {
	response, err := ctl.service.ListUsers(c.UserContext(), ListUsersParams{
		Search: strings.TrimSpace(c.Query("search")),
		Role:   strings.TrimSpace(c.Query("role")),
		Status: strings.TrimSpace(c.Query("status")),
		Limit:  intQuery(c, "limit", defaultUserLimit),
		Offset: intQuery(c, "offset", 0),
	})
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) updateUser(c *fiber.Ctx) error {
	userID, err := httpx.UUIDParam(c, "userID")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[UpdateUserRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.UpdateUser(c.UserContext(), claims.UserID, userID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) listPages(c *fiber.Ctx) error {
	pages, err := ctl.service.ListPages(c.UserContext(), c.Query("locale"))
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(map[string]any{"pages": pages}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) getPage(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.GetPage(c.UserContext(), c.Params("slug"), c.Query("locale", "en"), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) updatePage(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[UpdatePageRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.UpdatePage(c.UserContext(), c.Params("slug"), claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func intQuery(c *fiber.Ctx, key string, fallback int) int {
	value := strings.TrimSpace(c.Query(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
