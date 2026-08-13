package subscriptions

import (
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/platform/concurrency"
	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/middleware"
)

type paginationQuery struct {
	Page  int `query:"page" validate:"omitempty,min=1"`
	Limit int `query:"limit" validate:"omitempty,min=1,max=100"`
}

type Controller struct {
	service  *Service
	validate *validator.Validate
}

func NewController(service *Service, validate *validator.Validate) *Controller {
	return &Controller{service: service, validate: validate}
}

func (c *Controller) Subscribe(ctx *fiber.Ctx) error {
	userID := middleware.ClaimsFromContext(ctx).UserID
	creatorID, err := httpx.UUIDParam(ctx, "creatorId")
	if err != nil {
		return err
	}
	sub, err := c.service.Subscribe(ctx.Context(), userID, creatorID)
	if err != nil {
		return err
	}
	return ctx.Status(fiber.StatusCreated).JSON(httpx.OK(sub, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (c *Controller) Unsubscribe(ctx *fiber.Ctx) error {
	if err := concurrency.PrepareMutation(ctx); err != nil {
		return err
	}
	userID := middleware.ClaimsFromContext(ctx).UserID
	creatorID, err := httpx.UUIDParam(ctx, "creatorId")
	if err != nil {
		return err
	}
	if err := c.service.Unsubscribe(ctx.Context(), userID, creatorID); err != nil {
		return err
	}
	return ctx.Status(fiber.StatusNoContent).Send(nil)
}

func (c *Controller) ChangeSubscriptionType(ctx *fiber.Ctx) error {
	if err := concurrency.PrepareMutation(ctx); err != nil {
		return err
	}
	userID := middleware.ClaimsFromContext(ctx).UserID
	creatorID, err := httpx.UUIDParam(ctx, "creatorId")
	if err != nil {
		return err
	}
	req, err := httpx.BindBody[UpdateSubscriptionTypeRequest](ctx, c.validate)
	if err != nil {
		return err
	}
	sub, err := c.service.ChangeSubscriptionType(ctx.Context(), userID, creatorID, req.SubscriptionType)
	if err != nil {
		return err
	}
	return ctx.JSON(httpx.OK(sub, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (c *Controller) GetSubscribers(ctx *fiber.Ctx) error {
	userID, err := httpx.UUIDParam(ctx, "userId")
	if err != nil {
		return err
	}
	query, err := httpx.BindQuery[paginationQuery](ctx, c.validate)
	if err != nil {
		return err
	}
	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 {
		query.Limit = 20
	}
	offset := (query.Page - 1) * query.Limit
	subscribers, total, err := c.service.GetSubscribers(ctx.Context(), userID, query.Limit, offset)
	if err != nil {
		return err
	}
	hasMore := total > (query.Page * query.Limit)
	return ctx.JSON(httpx.OK(PagedSubscribersResponse{
		Items:    subscribers,
		Total:    total,
		Page:     query.Page,
		PageSize: query.Limit,
		HasMore:  hasMore,
	}, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (c *Controller) GetSubscriptions(ctx *fiber.Ctx) error {
	userID := middleware.ClaimsFromContext(ctx).UserID
	creators, _, err := c.service.GetSubscriptions(ctx.Context(), userID, 0, 0)
	if err != nil {
		return err
	}
	return ctx.JSON(httpx.OK(creators, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (c *Controller) IsSubscribed(ctx *fiber.Ctx) error {
	userID := middleware.ClaimsFromContext(ctx).UserID
	creatorID, err := httpx.UUIDParam(ctx, "creatorId")
	if err != nil {
		return err
	}
	isSubscribed, err := c.service.IsSubscribed(ctx.Context(), userID, creatorID)
	if err != nil {
		return err
	}
	return ctx.JSON(httpx.OK(map[string]bool{"isSubscribed": isSubscribed}, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (c *Controller) RequestSubscription(ctx *fiber.Ctx) error {
	userID := middleware.ClaimsFromContext(ctx).UserID
	req, err := httpx.BindBody[CreateSubscriptionRequestRequest](ctx, c.validate)
	if err != nil {
		return err
	}
	subReq, err := c.service.RequestSubscription(ctx.Context(), userID, req.CreatorID, req.Message)
	if err != nil {
		return err
	}
	return ctx.Status(fiber.StatusCreated).JSON(httpx.OK(subReq, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (c *Controller) ApproveSubscriptionRequest(ctx *fiber.Ctx) error {
	requestID, err := httpx.UUIDParam(ctx, "requestId")
	if err != nil {
		return err
	}
	creatorID := middleware.ClaimsFromContext(ctx).UserID
	sub, err := c.service.ApproveSubscriptionRequest(ctx.Context(), creatorID, requestID)
	if err != nil {
		return err
	}
	return ctx.JSON(httpx.OK(sub, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (c *Controller) RejectSubscriptionRequest(ctx *fiber.Ctx) error {
	requestID, err := httpx.UUIDParam(ctx, "requestId")
	if err != nil {
		return err
	}
	creatorID := middleware.ClaimsFromContext(ctx).UserID
	if err := c.service.RejectSubscriptionRequest(ctx.Context(), creatorID, requestID); err != nil {
		return err
	}
	return ctx.Status(fiber.StatusNoContent).Send(nil)
}

func (c *Controller) GetPendingRequests(ctx *fiber.Ctx) error {
	userID := middleware.ClaimsFromContext(ctx).UserID
	query, err := httpx.BindQuery[paginationQuery](ctx, c.validate)
	if err != nil {
		return err
	}
	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 {
		query.Limit = 20
	}
	offset := (query.Page - 1) * query.Limit
	requests, total, err := c.service.GetPendingRequests(ctx.Context(), userID, query.Limit, offset)
	if err != nil {
		return err
	}
	hasMore := total > (query.Page * query.Limit)
	return ctx.JSON(httpx.OK(PendingRequestsResponse{
		Items:    requests,
		Total:    total,
		Page:     query.Page,
		PageSize: query.Limit,
		HasMore:  hasMore,
	}, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (c *Controller) BlockUser(ctx *fiber.Ctx) error {
	userID := middleware.ClaimsFromContext(ctx).UserID
	req, err := httpx.BindBody[BlockUserRequest](ctx, c.validate)
	if err != nil {
		return err
	}
	if err := c.service.BlockUser(ctx.Context(), userID, req.UserID); err != nil {
		return err
	}
	return ctx.Status(fiber.StatusNoContent).Send(nil)
}

func (c *Controller) UnblockUser(ctx *fiber.Ctx) error {
	userID := middleware.ClaimsFromContext(ctx).UserID
	blockedUserID, err := httpx.UUIDParam(ctx, "userId")
	if err != nil {
		return err
	}
	if err := c.service.UnblockUser(ctx.Context(), userID, blockedUserID); err != nil {
		return err
	}
	return ctx.Status(fiber.StatusNoContent).Send(nil)
}

func (c *Controller) SetNotificationPreference(ctx *fiber.Ctx) error {
	userID := middleware.ClaimsFromContext(ctx).UserID
	creatorID, err := httpx.UUIDParam(ctx, "creatorId")
	if err != nil {
		return err
	}
	req, err := httpx.BindBody[UpdateSubscriptionNotificationPreferencesRequest](ctx, c.validate)
	if err != nil {
		return err
	}
	if err := c.service.SetNotificationPreference(ctx.Context(), userID, creatorID, req); err != nil {
		return err
	}
	return ctx.Status(fiber.StatusNoContent).Send(nil)
}

func (c *Controller) GetNotificationPreference(ctx *fiber.Ctx) error {
	userID := middleware.ClaimsFromContext(ctx).UserID
	creatorID, err := httpx.UUIDParam(ctx, "creatorId")
	if err != nil {
		return err
	}
	pref, err := c.service.GetNotificationPreference(ctx.Context(), userID, creatorID)
	if err != nil {
		return err
	}
	return ctx.JSON(httpx.OK(pref, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (c *Controller) GetSubscriptionStats(ctx *fiber.Ctx) error {
	userID := ctx.Params("userId")
	if userID == "" {
		userID = middleware.ClaimsFromContext(ctx).UserID
	} else if _, err := httpx.UUIDParam(ctx, "userId"); err != nil {
		return err
	}
	stats, err := c.service.GetSubscriptionStats(ctx.Context(), userID)
	if err != nil {
		return err
	}
	return ctx.JSON(httpx.OK(stats, ctx.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (c *Controller) RegisterRoutes(router fiber.Router, requireAuth fiber.Handler) {
	group := router.Group("/subscriptions", requireAuth)

	group.Get("/following", c.GetSubscriptions)
	group.Post("/requests", c.RequestSubscription)
	group.Get("/requests/pending", c.GetPendingRequests)
	group.Post("/requests/:requestId/approve", c.ApproveSubscriptionRequest)
	group.Post("/requests/:requestId/reject", c.RejectSubscriptionRequest)
	group.Post("/block", c.BlockUser)

	group.Post("/:creatorId", c.Subscribe)
	group.Delete("/:creatorId", c.Unsubscribe)
	group.Patch("/:creatorId/type", c.ChangeSubscriptionType)
	group.Get("/:creatorId/status", c.IsSubscribed)

	group.Get("/:userId/subscribers", c.GetSubscribers)
	group.Get("/:userId/stats", c.GetSubscriptionStats)

	group.Delete("/block/:userId", c.UnblockUser)

	group.Get("/:creatorId/notifications", c.GetNotificationPreference)
	group.Put("/:creatorId/notifications", c.SetNotificationPreference)
}
