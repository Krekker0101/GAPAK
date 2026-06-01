package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/gapak/backend/internal/config"
	authplatform "github.com/gapak/backend/internal/platform/auth"
	"github.com/gapak/backend/internal/platform/database"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	cfg, err := config.Load()
	if err != nil {
		exitf("load config: %v", err)
	}

	admin, err := readAdminEnv()
	if err != nil {
		exitf("%v", err)
	}

	db, err := database.NewPostgres(ctx, cfg.Database)
	if err != nil {
		exitf("connect postgres: %v", err)
	}
	defer db.Close()

	passwordHash, err := authplatform.NewPasswordManager(cfg.Security.PasswordPepper).Hash(admin.Password)
	if err != nil {
		exitf("hash password: %v", err)
	}

	userID := uuid.NewString()
	const upsertUser = `
		INSERT INTO users (id, email, username, display_name, password_hash, role, account_status, is_anonymous, updated_at)
		VALUES ($1, NULLIF($2, ''), $3, $4, $5, 'ADMIN', 'ACTIVE', false, NOW())
		ON CONFLICT (username)
		DO UPDATE SET
			email = EXCLUDED.email,
			display_name = EXCLUDED.display_name,
			password_hash = EXCLUDED.password_hash,
			role = 'ADMIN',
			account_status = 'ACTIVE',
			is_anonymous = false,
			updated_at = NOW()
		RETURNING id`
	if err := db.QueryRow(ctx, upsertUser, userID, admin.Email, admin.Username, admin.DisplayName, passwordHash).Scan(&userID); err != nil {
		exitf("upsert admin user: %v", err)
	}

	const upsertPrivacy = `
		INSERT INTO user_privacy_settings (
			user_id, profile_visibility, last_seen_visibility, allow_friend_requests, allow_trusted_invites,
			searchable_by_email, searchable_by_username, post_default_privacy, show_online_status, updated_at
		)
		VALUES ($1, 'PRIVATE', 'NOBODY', false, false, false, false, 'PRIVATE', false, NOW())
		ON CONFLICT (user_id)
		DO UPDATE SET
			profile_visibility = 'PRIVATE',
			last_seen_visibility = 'NOBODY',
			allow_friend_requests = false,
			allow_trusted_invites = false,
			searchable_by_email = false,
			searchable_by_username = false,
			post_default_privacy = 'PRIVATE',
			show_online_status = false,
			updated_at = NOW()`
	if _, err := db.Exec(ctx, upsertPrivacy, userID); err != nil {
		exitf("upsert admin privacy: %v", err)
	}

	fmt.Printf("admin account ready: username=%s id=%s\n", admin.Username, userID)
}

type adminEnv struct {
	Email       string
	Username    string
	DisplayName string
	Password    string
}

func readAdminEnv() (adminEnv, error) {
	admin := adminEnv{
		Email:       strings.TrimSpace(os.Getenv("ADMIN_EMAIL")),
		Username:    strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_USERNAME"))),
		DisplayName: strings.TrimSpace(os.Getenv("ADMIN_DISPLAY_NAME")),
		Password:    strings.TrimSpace(os.Getenv("ADMIN_PASSWORD")),
	}

	if admin.Username == "" {
		return adminEnv{}, fmt.Errorf("ADMIN_USERNAME is required")
	}
	if admin.DisplayName == "" {
		admin.DisplayName = "Gapak Administrator"
	}
	if len(admin.Password) < 12 {
		return adminEnv{}, fmt.Errorf("ADMIN_PASSWORD must be at least 12 characters")
	}
	if len(admin.Username) < 3 || len(admin.Username) > 32 {
		return adminEnv{}, fmt.Errorf("ADMIN_USERNAME must be 3-32 characters")
	}
	for _, char := range admin.Username {
		if (char < 'a' || char > 'z') && (char < '0' || char > '9') {
			return adminEnv{}, fmt.Errorf("ADMIN_USERNAME may contain only lowercase letters and digits")
		}
	}

	return admin, nil
}

func exitf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
