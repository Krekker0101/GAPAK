package app

import (
	"context"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	fws "github.com/gofiber/websocket/v2"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/modules/admin"
	authmodule "github.com/gapak/backend/internal/modules/auth"
	"github.com/gapak/backend/internal/modules/battles"
	"github.com/gapak/backend/internal/modules/chats"
	"github.com/gapak/backend/internal/modules/friends"
	"github.com/gapak/backend/internal/modules/live"
	"github.com/gapak/backend/internal/modules/media"
	"github.com/gapak/backend/internal/modules/moderation"
	"github.com/gapak/backend/internal/modules/notifications"
	"github.com/gapak/backend/internal/modules/posts"
	"github.com/gapak/backend/internal/modules/presence"
	"github.com/gapak/backend/internal/modules/security"
	"github.com/gapak/backend/internal/modules/sessions"
	"github.com/gapak/backend/internal/modules/stories"
	"github.com/gapak/backend/internal/modules/subscriptions"
	"github.com/gapak/backend/internal/modules/trustrooms"
	"github.com/gapak/backend/internal/modules/users"
	"github.com/gapak/backend/internal/platform/middleware"
	"github.com/gapak/backend/internal/services/websocket"
)

func registerModules(app *fiber.App, deps Dependencies) *websocket.Service {
	api := app.Group("/api/v1")

	requireAuth := middleware.RequireAuth(deps.JWT)
	authLimiter := middleware.RateLimiter{
		Redis:   deps.Redis,
		Prefix:  "rl:auth",
		Metrics: deps.Observability,
		Max:     deps.Config.RateLimit.AuthMax,
		Window:  deps.Config.RateLimit.AuthWindow,
		KeyFn:   deps.Privacy.RateLimitKey,
	}.Handler()
	passwordLimiter := middleware.RateLimiter{
		Redis:   deps.Redis,
		Prefix:  "rl:password",
		Metrics: deps.Observability,
		Max:     deps.Config.RateLimit.PasswordMax,
		Window:  deps.Config.RateLimit.PasswordWindow,
		KeyFn:   deps.Privacy.RateLimitKey,
	}.Handler()
	idempotency := middleware.Idempotency(deps.Redis)
	requireModerationRead := middleware.RequirePermissions(deps.RolePermissions, enums.PermissionAdminModerationRead)
	requireModerationWrite := middleware.RequirePermissions(deps.RolePermissions, enums.PermissionAdminModerationWrite)
	requireAdminDashboard := middleware.RequirePermissions(deps.RolePermissions, enums.PermissionAdminDashboardRead)
	requireAdminUsersRead := middleware.RequirePermissions(deps.RolePermissions, enums.PermissionAdminUsersRead)
	requireAdminUsersWrite := middleware.RequirePermissions(deps.RolePermissions, enums.PermissionAdminUsersWrite)
	requireAdminContentRead := middleware.RequirePermissions(deps.RolePermissions, enums.PermissionAdminContentRead)
	requireAdminContentWrite := middleware.RequirePermissions(deps.RolePermissions, enums.PermissionAdminContentWrite)

	authController := authmodule.NewController(
		authmodule.NewService(
			authmodule.NewRepository(deps.DB),
			deps.Passwords,
			deps.JWT,
			deps.TOTP,
			deps.Encryptor,
			deps.Privacy,
			deps.Config.OAuth,
		),
		deps.Validate,
		deps.Config.Security,
		deps.Privacy,
	)
	authController.RegisterRoutes(api, requireAuth, authLimiter, passwordLimiter, idempotency)

	users.NewController(users.NewService(users.NewRepository(deps.DB), media.NewRepository(deps.DB), deps.Privacy), deps.Validate).
		RegisterRoutes(api, requireAuth)

	presenceRepo := presence.NewRepository(deps.DB)
	presenceService := presence.NewService(presenceRepo)
	presence.NewController(presenceService, deps.Validate).
		RegisterRoutes(api, requireAuth)

	sessions.NewController(sessions.NewService(sessions.NewRepository(deps.DB), deps.Privacy)).
		RegisterRoutes(api, requireAuth)
	security.NewController(security.NewService(security.NewRepository(deps.DB), deps.Privacy), deps.Validate).
		RegisterRoutes(api, requireAuth)
	notifications.NewController(deps.DB).RegisterRoutes(api, requireAuth)
	friends.NewController(friends.NewService(friends.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	subscriptions.NewController(subscriptions.NewService(subscriptions.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	posts.NewController(posts.NewService(posts.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	stories.NewController(stories.NewService(stories.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	chatsRepo := chats.NewRepository(deps.DB)
	chatsService := chats.NewService(chatsRepo)
	chats.NewController(chatsService, deps.Validate).
		RegisterRoutes(api, requireAuth)

	wsService := websocket.NewService(
		deps.Redis,
		&wsChatAdapter{svc: chatsService},
		presenceService,
		deps.JWT,
		deps.Logger,
		deps.Observability,
	)
	app.Get("/ws", requireAuth, func(c *fiber.Ctx) error {
		claims := middleware.ClaimsFromContext(c)
		c.Locals("userId", claims.UserID)
		return c.Next()
	}, fws.New(wsService.HandleConnection))
	trustrooms.NewController(trustrooms.NewService(trustrooms.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	media.NewController(media.NewService(media.NewRepository(deps.DB), deps.Storage, deps.ObjectStore, deps.Queue, deps.Config), deps.Validate).
		RegisterRoutes(api, requireAuth)
	live.NewController(live.NewService(live.NewRepository(deps.DB, deps.Config.Queue.LiveEventChannel), deps.Config.Queue.LiveEventChannel), deps.Validate).
		RegisterRoutes(api, requireAuth)
	battles.NewController(battles.NewService(battles.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	moderation.NewController(moderation.NewService(moderation.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth, requireModerationRead, requireModerationWrite)
	admin.NewController(admin.NewService(admin.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth, requireAdminDashboard, requireAdminUsersRead, requireAdminUsersWrite, requireAdminContentRead, requireAdminContentWrite)

	return wsService
}

type wsChatAdapter struct {
	svc *chats.Service
}

func (a *wsChatAdapter) GetMessage(ctx context.Context, userID, id string) (interface{}, error) {
	return a.svc.GetMessage(ctx, id, userID)
}

func (a *wsChatAdapter) GetMessages(ctx context.Context, userID, chatID string, limit int, before *time.Time) ([]interface{}, error) {
	q := chats.ListMessagesQuery{Limit: limit}
	if before != nil {
		q.Cursor = before.Format(time.RFC3339Nano)
		q.Before = true
	}
	msgs, _, err := a.svc.GetMessages(ctx, chatID, userID, q)
	if err != nil {
		return nil, err
	}
	out := make([]interface{}, len(msgs))
	for i := range msgs {
		out[i] = msgs[i]
	}
	return out, nil
}

func (a *wsChatAdapter) GetMessagesAfterSequence(ctx context.Context, userID, chatID string, afterSequence int64, limit int) ([]interface{}, error) {
	msgs, err := a.svc.GetMessagesAfterSequence(ctx, chatID, userID, afterSequence, limit)
	if err != nil {
		return nil, err
	}
	out := make([]interface{}, len(msgs))
	for i := range msgs {
		out[i] = msgs[i]
	}
	return out, nil
}

func (a *wsChatAdapter) SendMessage(ctx context.Context, userID, chatID string, data map[string]interface{}) (interface{}, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	// WebSocket clients historically use snake_case field names while the HTTP
	// DTO uses camelCase. Normalize the wire aliases before decoding into the
	// existing, validated chat request type.
	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	aliases := map[string]string{
		"chat_id": "chatId", "client_message_id": "clientMessageId",
		"sender_device_id": "senderDeviceId", "sender_key_id": "senderKeyId",
		"encryption_protocol": "encryptionProtocol", "encryption_algorithm": "encryptionAlgorithm",
		"associated_data": "associatedData", "ratchet_counter": "ratchetCounter",
		"authentication_tag": "authenticationTag", "reply_to_message_id": "replyToMessageId",
		"forwarded_from_id": "forwardedFromId", "expires_in_seconds": "expiresInSeconds",
		"key_envelopes": "keyEnvelopes",
	}
	for from, to := range aliases {
		if value, ok := raw[from]; ok {
			raw[to] = value
		}
	}
	body, err = json.Marshal(raw)
	if err != nil {
		return nil, err
	}
	var req chats.SendMessageRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return nil, err
	}
	return a.svc.SendMessage(ctx, chatID, userID, req)
}

func (a *wsChatAdapter) MarkAsDelivered(ctx context.Context, userID, chatID, messageID string) (interface{}, error) {
	return a.svc.MarkAsDelivered(ctx, messageID, userID)
}

func (a *wsChatAdapter) MarkAsRead(ctx context.Context, userID, chatID, messageID string) (interface{}, error) {
	receipt, err := a.svc.MarkAsRead(ctx, chatID, userID, chats.MarkAsReadRequest{MessageID: messageID})
	if err != nil {
		return nil, err
	}
	return receipt, nil
}

func (a *wsChatAdapter) ListChatMemberIDs(ctx context.Context, userID, chatID string) ([]string, error) {
	return a.svc.ListChatMemberIDs(ctx, chatID, userID)
}

func (a *wsChatAdapter) AssertChatAccess(ctx context.Context, userID, chatID string) error {
	_, err := a.svc.GetChat(ctx, chatID, userID)
	return err
}
