package subscriptions

import (
	"time"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/platform/logger"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Controller struct {
	service  *Service
	validate *validator.Validate
}

func NewController(service *Service, validate *validator.Validate) *Controller {
	return &Controller{
		service:  service,
		validate: validate,
	}
}

// Subscribe подписать на пользователя
// POST /api/v1/subscriptions/:creatorId
func (c *Controller) Subscribe(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(string)
	creatorID := ctx.Params("creatorId")

	if creatorID == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "creatorId is required",
		})
	}

	if _, err := uuid.Parse(creatorID); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid creatorId format",
		})
	}

	sub, err := c.service.Subscribe(ctx.Context(), userID, creatorID)
	if err != nil {
		logger.Error().Err(err).Str("userID", userID).Str("creatorID", creatorID).Msg("failed to subscribe")
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return ctx.Status(fiber.StatusCreated).JSON(sub)
}

// Unsubscribe отписать от пользователя
// DELETE /api/v1/subscriptions/:creatorId
func (c *Controller) Unsubscribe(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(string)
	creatorID := ctx.Params("creatorId")

	if creatorID == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "creatorId is required",
		})
	}

	err := c.service.Unsubscribe(ctx.Context(), userID, creatorID)
	if err != nil {
		logger.Error().Err(err).Str("userID", userID).Str("creatorID", creatorID).Msg("failed to unsubscribe")
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return ctx.Status(fiber.StatusNoContent).Send(nil)
}

// ChangeSubscriptionType изменить тип подписки (VISIBLE или SILENT)
// PATCH /api/v1/subscriptions/:creatorId/type
func (c *Controller) ChangeSubscriptionType(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(string)
	creatorID := ctx.Params("creatorId")

	var req UpdateSubscriptionTypeRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	if err := c.validate.Struct(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	subType := enums.SubscriptionType(req.SubscriptionType)
	sub, err := c.service.ChangeSubscriptionType(ctx.Context(), userID, creatorID, subType)
	if err != nil {
		logger.Error().Err(err).Msg("failed to change subscription type")
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return ctx.Status(fiber.StatusOK).JSON(sub)
}

// GetSubscribers получить подписчиков пользователя
// GET /api/v1/subscriptions/:userId/subscribers?page=1&limit=20
func (c *Controller) GetSubscribers(ctx *fiber.Ctx) error {
	userID := ctx.Params("userId")

	page := ctx.QueryInt("page", 1)
	limit := ctx.QueryInt("limit", 20)

	if page < 1 || limit < 1 || limit > 100 {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid pagination parameters",
		})
	}

	offset := (page - 1) * limit

	subscribers, total, err := c.service.GetSubscribers(ctx.Context(), userID, limit, offset)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get subscribers")
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal server error",
		})
	}

	hasMore := total > (page * limit)

	return ctx.Status(fiber.StatusOK).JSON(fiber.Map{
		"items":    subscribers,
		"total":    total,
		"page":     page,
		"pageSize": limit,
		"hasMore":  hasMore,
	})
}

// GetSubscriptions получить авторов на которых подписан пользователь
// GET /api/v1/subscriptions/following?page=1&limit=20
func (c *Controller) GetSubscriptions(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(string)

	page := ctx.QueryInt("page", 1)
	limit := ctx.QueryInt("limit", 20)

	if page < 1 || limit < 1 || limit > 100 {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid pagination parameters",
		})
	}

	offset := (page - 1) * limit

	creators, total, err := c.service.GetSubscriptions(ctx.Context(), userID, limit, offset)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get subscriptions")
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal server error",
		})
	}

	hasMore := total > (page * limit)

	return ctx.Status(fiber.StatusOK).JSON(fiber.Map{
		"items":    creators,
		"total":    total,
		"page":     page,
		"pageSize": limit,
		"hasMore":  hasMore,
	})
}

// IsSubscribed проверить подписан ли пользователь
// GET /api/v1/subscriptions/:creatorId/status
func (c *Controller) IsSubscribed(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(string)
	creatorID := ctx.Params("creatorId")

	isSubscribed, err := c.service.IsSubscribed(ctx.Context(), userID, creatorID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to check subscription status")
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal server error",
		})
	}

	return ctx.Status(fiber.StatusOK).JSON(fiber.Map{
		"isSubscribed": isSubscribed,
	})
}

// RequestSubscription создать запрос на подписку
// POST /api/v1/subscriptions/requests
func (c *Controller) RequestSubscription(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(string)

	var req CreateSubscriptionRequestRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	if err := c.validate.Struct(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	subReq, err := c.service.RequestSubscription(ctx.Context(), userID, req.CreatorID, req.Message)
	if err != nil {
		logger.Error().Err(err).Msg("failed to request subscription")
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return ctx.Status(fiber.StatusCreated).JSON(subReq)
}

// ApproveSubscriptionRequest одобрить запрос на подписку
// POST /api/v1/subscriptions/requests/:requestId/approve
func (c *Controller) ApproveSubscriptionRequest(ctx *fiber.Ctx) error {
	requestID := ctx.Params("requestId")

	sub, err := c.service.ApproveSubscriptionRequest(ctx.Context(), requestID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to approve subscription request")
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return ctx.Status(fiber.StatusOK).JSON(sub)
}

// RejectSubscriptionRequest отклонить запрос на подписку
// POST /api/v1/subscriptions/requests/:requestId/reject
func (c *Controller) RejectSubscriptionRequest(ctx *fiber.Ctx) error {
	requestID := ctx.Params("requestId")

	err := c.service.RejectSubscriptionRequest(ctx.Context(), requestID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to reject subscription request")
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return ctx.Status(fiber.StatusNoContent).Send(nil)
}

// GetPendingRequests получить ожидающие запросы на подписку
// GET /api/v1/subscriptions/requests/pending?page=1&limit=20
func (c *Controller) GetPendingRequests(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(string)

	page := ctx.QueryInt("page", 1)
	limit := ctx.QueryInt("limit", 20)

	if page < 1 || limit < 1 || limit > 100 {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid pagination parameters",
		})
	}

	offset := (page - 1) * limit

	requests, total, err := c.service.GetPendingRequests(ctx.Context(), userID, limit, offset)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get pending requests")
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal server error",
		})
	}

	hasMore := total > (page * limit)

	return ctx.Status(fiber.StatusOK).JSON(fiber.Map{
		"items":    requests,
		"total":    total,
		"page":     page,
		"pageSize": limit,
		"hasMore":  hasMore,
	})
}

// BlockUser заблокировать пользователя
// POST /api/v1/subscriptions/block
func (c *Controller) BlockUser(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(string)

	var req BlockUserRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	if err := c.validate.Struct(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	err := c.service.BlockUser(ctx.Context(), userID, req.UserID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to block user")
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return ctx.Status(fiber.StatusNoContent).Send(nil)
}

// UnblockUser разблокировать пользователя
// DELETE /api/v1/subscriptions/block/:userId
func (c *Controller) UnblockUser(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(string)
	blockedUserID := ctx.Params("userId")

	err := c.service.UnblockUser(ctx.Context(), userID, blockedUserID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to unblock user")
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return ctx.Status(fiber.StatusNoContent).Send(nil)
}

// SetNotificationPreference установить настройки уведомлений
// PUT /api/v1/subscriptions/:creatorId/notifications
func (c *Controller) SetNotificationPreference(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(string)
	creatorID := ctx.Params("creatorId")

	var req UpdateSubscriptionNotificationPreferencesRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	notifyMap := map[string]bool{
		"post":  req.NotifyOnPost == nil || *req.NotifyOnPost,
		"story": req.NotifyOnStory == nil || *req.NotifyOnStory,
		"live":  req.NotifyOnLive == nil || *req.NotifyOnLive,
		"clip":  req.NotifyOnClip == nil || *req.NotifyOnClip,
	}

	var muteUntil *time.Time
	if req.MuteMinutes != nil && *req.MuteMinutes > 0 {
		t := time.Now().Add(time.Duration(*req.MuteMinutes) * time.Minute)
		muteUntil = &t
	}

	err := c.service.SetNotificationPreference(ctx.Context(), userID, creatorID, notifyMap, muteUntil)
	if err != nil {
		logger.Error().Err(err).Msg("failed to set notification preference")
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal server error",
		})
	}

	return ctx.Status(fiber.StatusNoContent).Send(nil)
}

// GetNotificationPreference получить настройки уведомлений
// GET /api/v1/subscriptions/:creatorId/notifications
func (c *Controller) GetNotificationPreference(ctx *fiber.Ctx) error {
	userID := ctx.Locals("userID").(string)
	creatorID := ctx.Params("creatorId")

	pref, err := c.service.GetNotificationPreference(ctx.Context(), userID, creatorID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get notification preference")
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal server error",
		})
	}

	return ctx.Status(fiber.StatusOK).JSON(pref)
}

// GetSubscriptionStats получить статистику подписок
// GET /api/v1/subscriptions/:userId/stats
func (c *Controller) GetSubscriptionStats(ctx *fiber.Ctx) error {
	userID := ctx.Params("userId")

	if userID == "" {
		userID = ctx.Locals("userID").(string)
	}

	stats, err := c.service.GetSubscriptionStats(ctx.Context(), userID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get subscription stats")
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal server error",
		})
	}

	return ctx.Status(fiber.StatusOK).JSON(stats)
}

// RegisterRoutes регистрирует маршруты subscriptions модуля
func (c *Controller) RegisterRoutes(router fiber.Router, requireAuth fiber.Handler) {
	group := router.Group("/subscriptions", requireAuth)

	// Основные операции подписки
	group.Post("/:creatorId", c.Subscribe)                    // Подписаться
	group.Delete("/:creatorId", c.Unsubscribe)                // Отписаться
	group.Patch("/:creatorId/type", c.ChangeSubscriptionType) // Изменить тип (VISIBLE/SILENT)
	group.Get("/:creatorId/status", c.IsSubscribed)           // Проверить подписку

	// Просмотр подписчиков и подписок
	group.Get("/:userId/subscribers", c.GetSubscribers) // Получить подписчиков пользователя
	group.Get("/following", c.GetSubscriptions)         // Получить авторов на которых подписан
	group.Get("/:userId/stats", c.GetSubscriptionStats) // Получить статистику

	// Запросы на подписку (для приватных аккаунтов)
	group.Post("/requests", c.RequestSubscription)                           // Создать запрос
	group.Get("/requests/pending", c.GetPendingRequests)                     // Получить ожидающие запросы
	group.Post("/requests/:requestId/approve", c.ApproveSubscriptionRequest) // Одобрить
	group.Post("/requests/:requestId/reject", c.RejectSubscriptionRequest)   // Отклонить

	// Блокировка
	group.Post("/block", c.BlockUser)             // Заблокировать пользователя
	group.Delete("/block/:userId", c.UnblockUser) // Разблокировать

	// Настройки уведомлений
	group.Get("/:creatorId/notifications", c.GetNotificationPreference) // Получить настройки
	group.Put("/:creatorId/notifications", c.SetNotificationPreference) // Установить настройки
}
