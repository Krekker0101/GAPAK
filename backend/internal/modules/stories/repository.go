package stories

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, authorID string, req CreateStoryRequest) (*model.Story, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	storyID := uuid.NewString()
	expiresAt := time.Now().UTC().Add(24 * time.Hour)
	if req.ExpiresAt != nil {
		expiresAt = req.ExpiresAt.UTC()
	}
	const query = `
		INSERT INTO stories (
			id, author_id, media_file_id, trust_room_id, caption, privacy, status, allow_replies,
			allow_reactions, highlight_title, expires_at, published_at, updated_at
		)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, 'ACTIVE', $7, $8, NULLIF($9, ''), $10, NOW(), NOW())
		RETURNING id, author_id, media_file_id, video_asset_id, trust_room_id, caption, privacy, status,
		          allow_replies, allow_reactions, highlight_title, expires_at, published_at, deleted_at,
		          created_at, updated_at`
	story, err := scanStory(tx.QueryRow(ctx, query,
		storyID,
		authorID,
		req.MediaFileID,
		req.TrustRoomID,
		stringPtrValue(req.Caption),
		req.Privacy,
		req.AllowReplies,
		req.AllowReactions,
		stringPtrValue(req.HighlightTitle),
		expiresAt,
	))
	if err != nil {
		return nil, err
	}

	if err := r.replaceAudience(ctx, tx, story.ID, req.CustomAudienceUserIDs, story.Privacy, story.ExpiresAt); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return story, nil
}

func (r *Repository) Feed(ctx context.Context, viewerID string, page, limit int) ([]model.Story, error) {
	offset := (page - 1) * limit
	const query = `
		SELECT s.id, s.author_id, s.media_file_id, s.video_asset_id, s.trust_room_id, s.caption, s.privacy, s.status,
		       s.allow_replies, s.allow_reactions, s.highlight_title, s.expires_at, s.published_at, s.deleted_at,
		       s.created_at, s.updated_at
		FROM stories s
		WHERE s.deleted_at IS NULL
		  AND s.expires_at > NOW()
		  AND (
		    s.author_id = $1
		    OR s.privacy = 'PUBLIC'
		    OR (s.privacy = 'FRIENDS' AND EXISTS (
		          SELECT 1 FROM friend_connections fc
		          WHERE fc.deleted_at IS NULL AND fc.status = 'ACCEPTED'
		            AND ((fc.requester_id = s.author_id AND fc.addressee_id = $1) OR (fc.addressee_id = s.author_id AND fc.requester_id = $1))
		        ))
		    OR (s.privacy = 'TRUSTED_CIRCLE' AND EXISTS (
		          SELECT 1 FROM trusted_circle_memberships tcm
		          WHERE tcm.owner_id = s.author_id AND tcm.member_id = $1
		        ))
		    OR (s.privacy IN ('PRIVATE', 'ONE_TIME', 'TIMED') AND EXISTS (
		          SELECT 1 FROM story_audience_grants sag
		          WHERE sag.story_id = s.id
		            AND sag.subject_user_id = $1
		            AND (sag.expires_at IS NULL OR sag.expires_at > NOW())
		            AND (sag.max_views IS NULL OR sag.used_views < sag.max_views)
		        ))
		  )
		ORDER BY s.published_at DESC
		LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, query, viewerID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.Story, 0)
	for rows.Next() {
		item, err := scanStory(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) GetVisible(ctx context.Context, viewerID, storyID string) (*model.Story, error) {
	const query = `
		SELECT s.id, s.author_id, s.media_file_id, s.video_asset_id, s.trust_room_id, s.caption, s.privacy, s.status,
		       s.allow_replies, s.allow_reactions, s.highlight_title, s.expires_at, s.published_at, s.deleted_at,
		       s.created_at, s.updated_at
		FROM stories s
		WHERE s.id = $2
		  AND s.deleted_at IS NULL
		  AND s.expires_at > NOW()
		  AND (
		    s.author_id = $1
		    OR s.privacy = 'PUBLIC'
		    OR (s.privacy = 'FRIENDS' AND EXISTS (
		          SELECT 1 FROM friend_connections fc
		          WHERE fc.deleted_at IS NULL AND fc.status = 'ACCEPTED'
		            AND ((fc.requester_id = s.author_id AND fc.addressee_id = $1) OR (fc.addressee_id = s.author_id AND fc.requester_id = $1))
		        ))
		    OR (s.privacy = 'TRUSTED_CIRCLE' AND EXISTS (
		          SELECT 1 FROM trusted_circle_memberships tcm
		          WHERE tcm.owner_id = s.author_id AND tcm.member_id = $1
		        ))
		    OR (s.privacy IN ('PRIVATE', 'ONE_TIME', 'TIMED') AND EXISTS (
		          SELECT 1 FROM story_audience_grants sag
		          WHERE sag.story_id = s.id
		            AND sag.subject_user_id = $1
		            AND (sag.expires_at IS NULL OR sag.expires_at > NOW())
		            AND (sag.max_views IS NULL OR sag.used_views < sag.max_views)
		        ))
		  )
		LIMIT 1`
	story, err := scanStory(r.db.QueryRow(ctx, query, viewerID, storyID))
	if err != nil {
		return nil, err
	}
	if story.Privacy == enums.PostPrivacyOneTime && viewerID != story.AuthorID {
		_, _ = r.db.Exec(ctx, `UPDATE story_audience_grants SET used_views = used_views + 1 WHERE story_id = $1 AND subject_user_id = $2`, storyID, viewerID)
	}
	return story, nil
}

func (r *Repository) AudienceUserIDs(ctx context.Context, storyID string) ([]string, error) {
	rows, err := r.db.Query(ctx, `SELECT subject_user_id FROM story_audience_grants WHERE story_id = $1 ORDER BY created_at ASC`, storyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]string, 0)
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		items = append(items, userID)
	}
	return items, rows.Err()
}

func (r *Repository) EnsureOwnedMedia(ctx context.Context, ownerID, mediaID string) error {
	var exists bool
	if err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM media_files
			WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
		)
	`, mediaID, ownerID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return apperrors.New(403, "stories.media_not_owned", "Story media must belong to the current user")
	}
	return nil
}

func (r *Repository) ViewerCount(ctx context.Context, storyID string) (int, error) {
	var count int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM story_viewers WHERE story_id = $1`, storyID).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *Repository) MarkViewed(ctx context.Context, storyID, viewerID string) error {
	const query = `
		INSERT INTO story_viewers (story_id, viewer_user_id, viewed_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (story_id, viewer_user_id)
		DO UPDATE SET viewed_at = NOW()`
	_, err := r.db.Exec(ctx, query, storyID, viewerID)
	return err
}

func (r *Repository) React(ctx context.Context, storyID, viewerID string, reaction enums.StoryReactionType) error {
	const query = `
		INSERT INTO story_viewers (story_id, viewer_user_id, reaction_type, viewed_at, reacted_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (story_id, viewer_user_id)
		DO UPDATE SET reaction_type = EXCLUDED.reaction_type, reacted_at = NOW(), viewed_at = NOW()`
	_, err := r.db.Exec(ctx, query, storyID, viewerID, string(reaction))
	return err
}

func (r *Repository) Highlight(ctx context.Context, authorID, storyID, title string) error {
	const query = `
		UPDATE stories
		SET status = 'HIGHLIGHTED', highlight_title = $3, updated_at = NOW()
		WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`
	tag, err := r.db.Exec(ctx, query, storyID, authorID, title)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	return nil
}

func (r *Repository) ListViewers(ctx context.Context, authorID, storyID string) ([]model.StoryViewer, error) {
	const query = `
		SELECT sv.story_id, sv.viewer_user_id, sv.reaction_type, sv.viewed_at, sv.reacted_at
		FROM story_viewers sv
		JOIN stories s ON s.id = sv.story_id
		WHERE sv.story_id = $1 AND s.author_id = $2
		ORDER BY sv.viewed_at DESC`
	rows, err := r.db.Query(ctx, query, storyID, authorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.StoryViewer, 0)
	for rows.Next() {
		var item model.StoryViewer
		var reaction *string
		if err := rows.Scan(&item.StoryID, &item.ViewerUserID, &reaction, &item.ViewedAt, &item.ReactedAt); err != nil {
			return nil, err
		}
		if reaction != nil {
			value := enums.StoryReactionType(*reaction)
			item.ReactionType = &value
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) replaceAudience(ctx context.Context, tx pgx.Tx, storyID string, audience []string, privacy enums.PostPrivacy, expiresAt time.Time) error {
	if _, err := tx.Exec(ctx, `DELETE FROM story_audience_grants WHERE story_id = $1`, storyID); err != nil {
		return err
	}
	if privacy != enums.PostPrivacyPrivate && privacy != enums.PostPrivacyOneTime && privacy != enums.PostPrivacyTimed {
		return nil
	}
	var maxViews *int
	if privacy == enums.PostPrivacyOneTime {
		value := 1
		maxViews = &value
	}
	for _, userID := range audience {
		if _, err := tx.Exec(ctx, `
			INSERT INTO story_audience_grants (id, story_id, subject_user_id, max_views, used_views, expires_at)
			VALUES ($1, $2, $3, $4, 0, $5)
		`, uuid.NewString(), storyID, userID, maxViews, expiresAt); err != nil {
			return err
		}
	}
	return nil
}

func scanStory(row interface{ Scan(dest ...any) error }) (*model.Story, error) {
	var item model.Story
	var privacy string
	var status string
	if err := row.Scan(
		&item.ID,
		&item.AuthorID,
		&item.MediaFileID,
		&item.VideoAssetID,
		&item.TrustRoomID,
		&item.Caption,
		&privacy,
		&status,
		&item.AllowReplies,
		&item.AllowReactions,
		&item.HighlightTitle,
		&item.ExpiresAt,
		&item.PublishedAt,
		&item.DeletedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	item.Privacy = enums.PostPrivacy(privacy)
	item.Status = enums.StoryStatus(status)
	return &item, nil
}

func stringPtrValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
