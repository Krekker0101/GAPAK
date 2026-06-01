package subscriptions

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// CreateSubscription создает подписку
func (r *Repository) CreateSubscription(ctx context.Context, subscription *model.Subscription) error {
	query := `
		INSERT INTO subscriptions (
			id, subscriber_id, creator_id, status, subscription_type, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		)
	`

	_, err := r.db.Exec(ctx, query,
		subscription.ID,
		subscription.SubscriberID,
		subscription.CreatorID,
		subscription.Status,
		subscription.SubscriptionType,
	)

	return err
}

// GetSubscription получить подписку по ID
func (r *Repository) GetSubscription(ctx context.Context, subscriptionID string) (*model.Subscription, error) {
	query := `
		SELECT 
			id, subscriber_id, creator_id, status, subscription_type, 
			subscribed_at, created_at, updated_at
		FROM subscriptions
		WHERE id = $1
	`

	row := r.db.QueryRow(ctx, query, subscriptionID)

	var sub model.Subscription
	err := row.Scan(
		&sub.ID,
		&sub.SubscriberID,
		&sub.CreatorID,
		&sub.Status,
		&sub.SubscriptionType,
		&sub.SubscribedAt,
		&sub.CreatedAt,
		&sub.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &sub, nil
}

// GetSubscriptionByUsers получить подписку между двумя пользователями
func (r *Repository) GetSubscriptionByUsers(ctx context.Context, subscriberID, creatorID string) (*model.Subscription, error) {
	query := `
		SELECT 
			id, subscriber_id, creator_id, status, subscription_type, 
			subscribed_at, created_at, updated_at
		FROM subscriptions
		WHERE subscriber_id = $1 AND creator_id = $2
	`

	row := r.db.QueryRow(ctx, query, subscriberID, creatorID)

	var sub model.Subscription
	err := row.Scan(
		&sub.ID,
		&sub.SubscriberID,
		&sub.CreatorID,
		&sub.Status,
		&sub.SubscriptionType,
		&sub.SubscribedAt,
		&sub.CreatedAt,
		&sub.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &sub, nil
}

// UpdateSubscriptionType изменить тип подписки
func (r *Repository) UpdateSubscriptionType(ctx context.Context, subscriptionID string, subType enums.SubscriptionType) error {
	query := `
		UPDATE subscriptions
		SET subscription_type = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	_, err := r.db.Exec(ctx, query, subType, subscriptionID)
	return err
}

// DeleteSubscription удалить подписку
func (r *Repository) DeleteSubscription(ctx context.Context, subscriptionID string) error {
	query := `
		DELETE FROM subscriptions
		WHERE id = $1
	`

	_, err := r.db.Exec(ctx, query, subscriptionID)
	return err
}

// GetSubscribers получить подписчиков пользователя (followers)
func (r *Repository) GetSubscribers(ctx context.Context, userID string, limit, offset int) ([]model.Subscription, int, error) {
	countQuery := `
		SELECT COUNT(*) FROM subscriptions
		WHERE creator_id = $1 AND status = $2
	`

	var total int
	err := r.db.QueryRow(ctx, countQuery, userID, enums.SubscriptionStatusActive).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT 
			id, subscriber_id, creator_id, status, subscription_type, 
			subscribed_at, created_at, updated_at
		FROM subscriptions
		WHERE creator_id = $1 AND status = $2
		ORDER BY subscribed_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := r.db.Query(ctx, query, userID, enums.SubscriptionStatusActive, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var subscriptions []model.Subscription
	for rows.Next() {
		var sub model.Subscription
		err := rows.Scan(
			&sub.ID,
			&sub.SubscriberID,
			&sub.CreatorID,
			&sub.Status,
			&sub.SubscriptionType,
			&sub.SubscribedAt,
			&sub.CreatedAt,
			&sub.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		subscriptions = append(subscriptions, sub)
	}

	return subscriptions, total, rows.Err()
}

// GetSubscriptions получить авторов на которых подписан пользователь
func (r *Repository) GetSubscriptions(ctx context.Context, subscriberID string, limit, offset int) ([]model.Subscription, int, error) {
	countQuery := `
		SELECT COUNT(*) FROM subscriptions
		WHERE subscriber_id = $1 AND status = $2
	`

	var total int
	err := r.db.QueryRow(ctx, countQuery, subscriberID, enums.SubscriptionStatusActive).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT 
			id, subscriber_id, creator_id, status, subscription_type, 
			subscribed_at, created_at, updated_at
		FROM subscriptions
		WHERE subscriber_id = $1 AND status = $2
		ORDER BY subscribed_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := r.db.Query(ctx, query, subscriberID, enums.SubscriptionStatusActive, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var subscriptions []model.Subscription
	for rows.Next() {
		var sub model.Subscription
		err := rows.Scan(
			&sub.ID,
			&sub.SubscriberID,
			&sub.CreatorID,
			&sub.Status,
			&sub.SubscriptionType,
			&sub.SubscribedAt,
			&sub.CreatedAt,
			&sub.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		subscriptions = append(subscriptions, sub)
	}

	return subscriptions, total, rows.Err()
}

// IsSubscribed проверить подписан ли пользователь
func (r *Repository) IsSubscribed(ctx context.Context, subscriberID, creatorID string) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM subscriptions
			WHERE subscriber_id = $1 AND creator_id = $2 AND status = $3
		)
	`

	var exists bool
	err := r.db.QueryRow(ctx, query, subscriberID, creatorID, enums.SubscriptionStatusActive).Scan(&exists)
	return exists, err
}

// CreateSubscriptionRequest создать запрос на подписку
func (r *Repository) CreateSubscriptionRequest(ctx context.Context, req *model.SubscriptionRequest) error {
	query := `
		INSERT INTO subscription_requests (
			id, subscriber_id, creator_id, status, message, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		)
	`

	_, err := r.db.Exec(ctx, query,
		req.ID,
		req.SubscriberID,
		req.CreatorID,
		req.Status,
		req.Message,
	)

	return err
}

// GetSubscriptionRequest получить запрос на подписку
func (r *Repository) GetSubscriptionRequest(ctx context.Context, requestID string) (*model.SubscriptionRequest, error) {
	query := `
		SELECT 
			id, subscriber_id, creator_id, status, message, requested_at, responded_at, created_at, updated_at
		FROM subscription_requests
		WHERE id = $1
	`

	row := r.db.QueryRow(ctx, query, requestID)

	var req model.SubscriptionRequest
	err := row.Scan(
		&req.ID,
		&req.SubscriberID,
		&req.CreatorID,
		&req.Status,
		&req.Message,
		&req.RequestedAt,
		&req.RespondedAt,
		&req.CreatedAt,
		&req.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &req, nil
}

// GetPendingSubscriptionRequests получить ожидающие запросы для пользователя
func (r *Repository) GetPendingSubscriptionRequests(ctx context.Context, creatorID string, limit, offset int) ([]model.SubscriptionRequest, int, error) {
	countQuery := `
		SELECT COUNT(*) FROM subscription_requests
		WHERE creator_id = $1 AND status = $2
	`

	var total int
	err := r.db.QueryRow(ctx, countQuery, creatorID, enums.SubscriptionStatusPending).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT 
			id, subscriber_id, creator_id, status, message, requested_at, responded_at, created_at, updated_at
		FROM subscription_requests
		WHERE creator_id = $1 AND status = $2
		ORDER BY requested_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := r.db.Query(ctx, query, creatorID, enums.SubscriptionStatusPending, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var requests []model.SubscriptionRequest
	for rows.Next() {
		var req model.SubscriptionRequest
		err := rows.Scan(
			&req.ID,
			&req.SubscriberID,
			&req.CreatorID,
			&req.Status,
			&req.Message,
			&req.RequestedAt,
			&req.RespondedAt,
			&req.CreatedAt,
			&req.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		requests = append(requests, req)
	}

	return requests, total, rows.Err()
}

// RespondSubscriptionRequest ответить на запрос подписки
func (r *Repository) RespondSubscriptionRequest(ctx context.Context, requestID string, accept bool) error {
	status := enums.SubscriptionStatusBlocked
	if accept {
		status = enums.SubscriptionStatusActive
	}

	query := `
		UPDATE subscription_requests
		SET status = $1, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	_, err := r.db.Exec(ctx, query, status, requestID)
	return err
}

// DeleteSubscriptionRequest удалить запрос на подписку
func (r *Repository) DeleteSubscriptionRequest(ctx context.Context, requestID string) error {
	query := `
		DELETE FROM subscription_requests
		WHERE id = $1
	`

	_, err := r.db.Exec(ctx, query, requestID)
	return err
}

// BlockUser добавить пользователя в blocklist
func (r *Repository) BlockUser(ctx context.Context, userID, blockedUserID string) error {
	query := `
		INSERT INTO subscription_blocklist (id, user_id, blocked_user_id, created_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
		ON CONFLICT DO NOTHING
	`

	_, err := r.db.Exec(ctx, query, uuid.NewString(), userID, blockedUserID)
	return err
}

// UnblockUser удалить пользователя из blocklist
func (r *Repository) UnblockUser(ctx context.Context, userID, blockedUserID string) error {
	query := `
		DELETE FROM subscription_blocklist
		WHERE user_id = $1 AND blocked_user_id = $2
	`

	_, err := r.db.Exec(ctx, query, userID, blockedUserID)
	return err
}

// IsBlocked проверить заблокирован ли пользователь
func (r *Repository) IsBlocked(ctx context.Context, userID, potentialBlockerID string) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM subscription_blocklist
			WHERE user_id = $1 AND blocked_user_id = $2
		)
	`

	var exists bool
	err := r.db.QueryRow(ctx, query, potentialBlockerID, userID).Scan(&exists)
	return exists, err
}

// SetNotificationPreference установить настройки уведомлений
func (r *Repository) SetNotificationPreference(ctx context.Context, pref *model.SubscriptionNotificationPreferences) error {
	query := `
		INSERT INTO subscription_notification_preferences (
			subscriber_id, creator_id, notify_on_post, notify_on_story, 
			notify_on_live, notify_on_clip, mute_until, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		)
		ON CONFLICT (subscriber_id, creator_id) DO UPDATE SET
			notify_on_post = $3,
			notify_on_story = $4,
			notify_on_live = $5,
			notify_on_clip = $6,
			mute_until = $7,
			updated_at = CURRENT_TIMESTAMP
	`

	_, err := r.db.Exec(ctx, query,
		pref.SubscriberID,
		pref.CreatorID,
		pref.NotifyOnPost,
		pref.NotifyOnStory,
		pref.NotifyOnLive,
		pref.NotifyOnClip,
		pref.MuteUntil,
	)

	return err
}

// GetNotificationPreference получить настройки уведомлений
func (r *Repository) GetNotificationPreference(ctx context.Context, subscriberID, creatorID string) (*model.SubscriptionNotificationPreferences, error) {
	query := `
		SELECT 
			subscriber_id, creator_id, notify_on_post, notify_on_story, 
			notify_on_live, notify_on_clip, mute_until, created_at, updated_at
		FROM subscription_notification_preferences
		WHERE subscriber_id = $1 AND creator_id = $2
	`

	row := r.db.QueryRow(ctx, query, subscriberID, creatorID)

	var pref model.SubscriptionNotificationPreferences
	err := row.Scan(
		&pref.SubscriberID,
		&pref.CreatorID,
		&pref.NotifyOnPost,
		&pref.NotifyOnStory,
		&pref.NotifyOnLive,
		&pref.NotifyOnClip,
		&pref.MuteUntil,
		&pref.CreatedAt,
		&pref.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &pref, nil
}

// GetSubscriptionStats получить статистику подписок
func (r *Repository) GetSubscriptionStats(ctx context.Context, userID string) (followers, following, pendingRequests int, err error) {
	query := `
		SELECT
			(SELECT COUNT(*) FROM subscriptions WHERE creator_id = $1 AND status = 'ACTIVE') as followers,
			(SELECT COUNT(*) FROM subscriptions WHERE subscriber_id = $1 AND status = 'ACTIVE') as following,
			(SELECT COUNT(*) FROM subscription_requests WHERE creator_id = $1 AND status = 'PENDING') as pending
	`

	row := r.db.QueryRow(ctx, query, userID)
	err = row.Scan(&followers, &following, &pendingRequests)
	return
}

// GetAccountSettings получить настройки аккаунта
func (r *Repository) GetAccountSettings(ctx context.Context, userID string) (*model.UserAccountSettings, error) {
	query := `
		SELECT 
			user_id, account_type, bio, header_image_file_id, theme,
			allow_close_friends, show_story_ring, allow_followers_see_follower_count,
			channel_category, channel_description, channel_verification_status,
			channel_featured_post_id, disable_comments, disable_sharing,
			allow_downloads, monetization_enabled, created_at, updated_at
		FROM user_account_settings
		WHERE user_id = $1
	`

	row := r.db.QueryRow(ctx, query, userID)

	var settings model.UserAccountSettings
	err := row.Scan(
		&settings.UserID,
		&settings.AccountType,
		&settings.Bio,
		&settings.HeaderImageFileID,
		&settings.Theme,
		&settings.AllowCloseFriends,
		&settings.ShowStoryRing,
		&settings.AllowFollowersSeeFollowerCount,
		&settings.ChannelCategory,
		&settings.ChannelDescription,
		&settings.ChannelVerificationStatus,
		&settings.ChannelFeaturedPostID,
		&settings.DisableComments,
		&settings.DisableSharing,
		&settings.AllowDownloads,
		&settings.MonetizationEnabled,
		&settings.CreatedAt,
		&settings.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &settings, nil
}

// UpdateAccountSettings обновить настройки аккаунта
func (r *Repository) UpdateAccountSettings(ctx context.Context, settings *model.UserAccountSettings) error {
	query := `
		UPDATE user_account_settings
		SET 
			account_type = $1,
			bio = $2,
			header_image_file_id = $3,
			theme = $4,
			allow_close_friends = $5,
			show_story_ring = $6,
			allow_followers_see_follower_count = $7,
			channel_category = $8,
			channel_description = $9,
			channel_verification_status = $10,
			channel_featured_post_id = $11,
			disable_comments = $12,
			disable_sharing = $13,
			allow_downloads = $14,
			monetization_enabled = $15,
			updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $16
	`

	_, err := r.db.Exec(ctx, query,
		settings.AccountType,
		settings.Bio,
		settings.HeaderImageFileID,
		settings.Theme,
		settings.AllowCloseFriends,
		settings.ShowStoryRing,
		settings.AllowFollowersSeeFollowerCount,
		settings.ChannelCategory,
		settings.ChannelDescription,
		settings.ChannelVerificationStatus,
		settings.ChannelFeaturedPostID,
		settings.DisableComments,
		settings.DisableSharing,
		settings.AllowDownloads,
		settings.MonetizationEnabled,
		settings.UserID,
	)

	return err
}

// CreateAccountSettings создать настройки аккаунта при регистрации
func (r *Repository) CreateAccountSettings(ctx context.Context, settings *model.UserAccountSettings) error {
	query := `
		INSERT INTO user_account_settings (
			user_id, account_type, theme, allow_close_friends, show_story_ring,
			allow_followers_see_follower_count, disable_comments, allow_downloads,
			created_at, updated_at
		) VALUES (
			$1, $2, 'light', true, true, true, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		)
	`

	_, err := r.db.Exec(ctx, query,
		settings.UserID,
		settings.AccountType,
	)

	return err
}
