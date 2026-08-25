package app

import (
	"context"
	"encoding/json"
	"strings"
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
	pushmodule "github.com/gapak/backend/internal/modules/push"
	"github.com/gapak/backend/internal/modules/security"
	"github.com/gapak/backend/internal/modules/sessions"
	"github.com/gapak/backend/internal/modules/stories"
	"github.com/gapak/backend/internal/modules/subscriptions"
	syncmodule "github.com/gapak/backend/internal/modules/sync"
	"github.com/gapak/backend/internal/modules/trustrooms"
	"github.com/gapak/backend/internal/modules/users"
	authplatform "github.com/gapak/backend/internal/platform/auth"
	"github.com/gapak/backend/internal/platform/concurrency"
	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/middleware"
	"github.com/gapak/backend/internal/services/websocket"
)

func registerModules(ctx context.Context, app *fiber.App, deps Dependencies) *websocket.Service {
	api := app.Group("/api/v1")
	concurrencyStore := concurrency.NewStore(deps.DB, deps.Config.Security.JWTAccessSecret)
	app.Use(func(c *fiber.Ctx) error { concurrency.WithStore(c, concurrencyStore); return c.Next() })

	requireAuth := middleware.RequireAuthWithSessionStore(deps.JWT, deps.DB)
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
		deps.CSRF,
		deps.JWT,
		deps.Config.OAuth.FrontendRedirectURL,
		deps.Config.App.CORSOrigins...,
	)
	authController.RegisterRoutes(api, requireAuth, authLimiter, passwordLimiter)

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
	notifications.NewController(notifications.NewService(notifications.NewRepository(deps.DB)), deps.Validate).RegisterRoutes(api, requireAuth)
	syncmodule.NewController(syncmodule.NewService(syncmodule.NewRepository(deps.DB), syncmodule.NewCursorCodec(deps.Config.Security.JWTAccessSecret)), deps.Validate).RegisterRoutes(api, requireAuth)
	pushmodule.NewController(pushmodule.NewService(pushmodule.NewRepository(deps.DB, deps.Encryptor)), deps.Validate).RegisterRoutes(api, requireAuth)
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
	chatsService.StartCleanup(ctx, time.Minute)
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
	app.Get("/ws", websocketAuth(deps), fws.New(wsService.HandleConnection))
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

func websocketAuth(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if origin := strings.TrimRight(strings.TrimSpace(c.Get("Origin")), "/"); origin != "" && !isAllowedOrigin(origin, deps.Config.App.CORSOrigins) {
			return fiber.NewError(fiber.StatusForbidden, "WebSocket origin is not allowed")
		}

		token := strings.TrimSpace(c.Cookies(authplatform.AccessCookieName))
		if token == "" {
			token = bearerToken(c.Get(fiber.HeaderAuthorization))
		}
		if token == "" {
			// Fall through to the existing first-frame auth for non-browser clients.
			return c.Next()
		}
		claims, err := deps.JWT.VerifyAccessToken(c.UserContext(), token)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "Invalid access token")
		}
		c.Locals("userId", claims.UserID)
		c.Locals("sessionId", claims.SessionID)
		return c.Next()
	}
}

func isAllowedOrigin(origin string, allowed []string) bool {
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	for _, candidate := range allowed {
		if strings.EqualFold(origin, strings.TrimRight(strings.TrimSpace(candidate), "/")) {
			return true
		}
	}
	return false
}

func bearerToken(rawHeader string) string {
	parts := strings.Fields(rawHeader)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
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

func (a *wsChatAdapter) ValidateSession(ctx context.Context, userID, sessionID string) error {
	var ok int
	if err := a.svc.ValidateSession(ctx, userID, sessionID); err != nil {
		return err
	}
	_ = ok
	return nil
}

func (a *wsChatAdapter) ValidateDevice(ctx context.Context, userID, deviceID string) error {
	devices, err := a.svc.ListTrustedDevices(ctx, userID)
	if err != nil {
		return err
	}
	for _, device := range devices {
		if device.ID == deviceID && device.RevokedAt == nil && device.TrustStatus == "TRUSTED" {
			return nil
		}
	}
	return apperrors.ErrForbidden
}
