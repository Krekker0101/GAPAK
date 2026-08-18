package users

import (
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/platform/concurrency"
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
	group := router.Group("/users", requireAuth)
	group.Get("/me", ctl.getMe)
	group.Get("/search", ctl.search)
	group.Get("/discover", ctl.discover)
	group.Get("/:userId", ctl.getPublic)
	group.Patch("/me", ctl.updateMe)
	group.Patch("/me/privacy", ctl.updatePrivacy)
	group.Patch("/me/theme", ctl.updateTheme)
}

func (ctl *Controller) getPublic(c *fiber.Ctx) error {
	userID, err := httpx.UUIDParam(c, "userId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.GetPublicProfile(c.UserContext(), claims.UserID, userID)
	if err != nil {
		return err
	}
	return concurrency.WriteVersionedJSON(c, "user_profile", userID, response, nil)
}

func (ctl *Controller) search(c *fiber.Ctx) error {
	query, err := httpx.BindQuery[SearchUsersQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	if query.Limit == 0 {
		query.Limit = 20
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Search(c.UserContext(), claims.UserID, query.Query, query.Limit)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) discover(c *fiber.Ctx) error {
	query, err := httpx.BindQuery[DiscoverUsersQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	if query.Sort == "" {
		query.Sort = "top"
	}
	if query.Limit == 0 {
		query.Limit = 20
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Discover(c.UserContext(), claims.UserID, query.Sort, query.Limit)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) getMe(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.GetMe(c.UserContext(), claims.UserID)
	if err != nil {
		return err
	}
	return concurrency.WriteVersionedJSON(c, "user_profile", claims.UserID, response, nil)
}

func (ctl *Controller) updateMe(c *fiber.Ctx) error {
	if err := concurrency.PrepareMutation(c); err != nil {
		return err
	}
	payload, err := httpx.BindBody[UpdateProfileRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.UpdateMe(c.UserContext(), claims.UserID, payload)
	if err != nil {
		return err
	}
	if err := concurrency.SetMutationETag(c, "user_profile", claims.UserID); err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) updateTheme(c *fiber.Ctx) error {
	if err := concurrency.PrepareMutation(c); err != nil {
		return err
	}
	payload, err := httpx.BindBody[UpdateThemeRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.UpdateTheme(c.UserContext(), claims.UserID, payload)
	if err != nil {
		return err
	}
	if err := concurrency.SetMutationETag(c, "user_profile", claims.UserID); err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) updatePrivacy(c *fiber.Ctx) error {
	if err := concurrency.PrepareMutation(c); err != nil {
		return err
	}
	payload, err := httpx.BindBody[UpdatePrivacyRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.UpdatePrivacy(c.UserContext(), claims.UserID, payload)
	if err != nil {
		return err
	}
	if err := concurrency.SetMutationETag(c, "user_profile", claims.UserID); err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}
