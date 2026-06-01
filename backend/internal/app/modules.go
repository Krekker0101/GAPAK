package app

import (
	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/modules/admin"
	authmodule "github.com/gapak/backend/internal/modules/auth"
	"github.com/gapak/backend/internal/modules/battles"
	"github.com/gapak/backend/internal/modules/chats"
	"github.com/gapak/backend/internal/modules/friends"
	"github.com/gapak/backend/internal/modules/live"
	"github.com/gapak/backend/internal/modules/media"
	"github.com/gapak/backend/internal/modules/moderation"
	"github.com/gapak/backend/internal/modules/posts"
	"github.com/gapak/backend/internal/modules/presence"
	"github.com/gapak/backend/internal/modules/security"
	"github.com/gapak/backend/internal/modules/sessions"
	"github.com/gapak/backend/internal/modules/stories"
	"github.com/gapak/backend/internal/modules/subscriptions"
	"github.com/gapak/backend/internal/modules/trustrooms"
	"github.com/gapak/backend/internal/modules/users"
	"github.com/gapak/backend/internal/platform/middleware"
)

func registerModules(app *fiber.App, deps Dependencies) {
	api := app.Group("/api/v1")

	requireAuth := middleware.RequireAuth(deps.JWT)
	authLimiter := middleware.RateLimiter{
		Redis:  deps.Redis,
		Prefix: "rl:auth",
		Max:    deps.Config.RateLimit.AuthMax,
		Window: deps.Config.RateLimit.AuthWindow,
		KeyFn:  deps.Privacy.RateLimitKey,
	}.Handler()
	passwordLimiter := middleware.RateLimiter{
		Redis:  deps.Redis,
		Prefix: "rl:password",
		Max:    deps.Config.RateLimit.PasswordMax,
		Window: deps.Config.RateLimit.PasswordWindow,
		KeyFn:  deps.Privacy.RateLimitKey,
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
		),
		deps.Validate,
		deps.Config.Security,
		deps.Privacy,
	)
	authController.RegisterRoutes(api, requireAuth, authLimiter, passwordLimiter)

	users.NewController(users.NewService(users.NewRepository(deps.DB), media.NewRepository(deps.DB), deps.Privacy), deps.Validate).
		RegisterRoutes(api, requireAuth)
	presence.NewController(presence.NewService(presence.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	sessions.NewController(sessions.NewService(sessions.NewRepository(deps.DB), deps.Privacy)).
		RegisterRoutes(api, requireAuth)
	security.NewController(security.NewService(security.NewRepository(deps.DB), deps.Privacy), deps.Validate).
		RegisterRoutes(api, requireAuth)
	friends.NewController(friends.NewService(friends.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	subscriptions.NewController(subscriptions.NewService(subscriptions.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	posts.NewController(posts.NewService(posts.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	stories.NewController(stories.NewService(stories.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	chats.NewController(chats.NewService(chats.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	trustrooms.NewController(trustrooms.NewService(trustrooms.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	media.NewController(media.NewService(media.NewRepository(deps.DB), deps.Storage, deps.Queue, deps.Config), deps.Validate).
		RegisterRoutes(api, requireAuth)
	live.NewController(live.NewService(live.NewRepository(deps.DB, deps.Config.Queue.LiveEventChannel), deps.Config.Queue.LiveEventChannel), deps.Validate).
		RegisterRoutes(api, requireAuth)
	battles.NewController(battles.NewService(battles.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth)
	moderation.NewController(moderation.NewService(moderation.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth, requireModerationRead, requireModerationWrite)
	admin.NewController(admin.NewService(admin.NewRepository(deps.DB)), deps.Validate).
		RegisterRoutes(api, requireAuth, requireAdminDashboard, requireAdminUsersRead, requireAdminUsersWrite, requireAdminContentRead, requireAdminContentWrite)
}
