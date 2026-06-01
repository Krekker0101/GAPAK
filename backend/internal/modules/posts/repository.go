package posts

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

type MediaAttachmentSummary struct {
	ID       string
	Kind     enums.MediaKind
	MimeType string
	Status   enums.MediaStatus
	Purpose  enums.UploadPurpose
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, userID string, req CreatePostRequest) (*model.Post, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	postID := uuid.NewString()
	const query = `
		INSERT INTO posts (id, author_id, content_type, body, privacy, expires_at, one_time_view_limit, published_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		RETURNING id, author_id, content_type, body, privacy, like_count, expires_at, one_time_view_limit, published_at, edited_at, deleted_at, created_at, updated_at`

	post, err := scanPost(tx.QueryRow(ctx, query, postID, userID, req.ContentType, req.Body, req.Privacy, req.ExpiresAt, req.OneTimeViewLimit))
	if err != nil {
		return nil, err
	}

	if err := r.replaceAudience(ctx, tx, postID, req.AudienceUserIDs, req.OneTimeViewLimit, req.ExpiresAt); err != nil {
		return nil, err
	}
	if err := r.replaceMedia(ctx, tx, postID, req.MediaFileIDs); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return post, nil
}

func (r *Repository) Update(ctx context.Context, userID, postID string, req UpdatePostRequest) (*model.Post, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	const query = `
		UPDATE posts
		SET content_type = $3,
		    body = $4,
		    privacy = $5,
		    expires_at = $6,
		    one_time_view_limit = $7,
		    edited_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL
		RETURNING id, author_id, content_type, body, privacy, like_count, expires_at, one_time_view_limit, published_at, edited_at, deleted_at, created_at, updated_at`
	post, err := scanPost(tx.QueryRow(ctx, query, postID, userID, contentTypeValue(req.ContentType), bodyValue(req.Body), privacyValue(req.Privacy), req.ExpiresAt, req.OneTimeViewLimit))
	if err != nil {
		return nil, err
	}

	if err := r.replaceAudience(ctx, tx, postID, req.AudienceUserIDs, post.OneTimeViewLimit, post.ExpiresAt); err != nil {
		return nil, err
	}
	if err := r.replaceMedia(ctx, tx, postID, req.MediaFileIDs); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return post, nil
}

func (r *Repository) GetOwnedPost(ctx context.Context, userID, postID string) (*model.Post, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	const query = `
		SELECT id, author_id, content_type, body, privacy, like_count, expires_at, one_time_view_limit,
		       published_at, edited_at, deleted_at, created_at, updated_at
		FROM posts
		WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL
		LIMIT 1`
	post, err := scanPost(tx.QueryRow(ctx, query, postID, userID))
	if err != nil {
		return nil, err
	}
	return post, nil
}

func (r *Repository) Delete(ctx context.Context, userID, postID string) error {
	const query = `UPDATE posts SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`
	tag, err := r.db.Exec(ctx, query, postID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	return nil
}

func (r *Repository) GetVisiblePost(ctx context.Context, viewerID, postID string) (*model.Post, error) {
	const query = `
		SELECT p.id, p.author_id, p.content_type, p.body, p.privacy, p.like_count, p.expires_at, p.one_time_view_limit,
		       p.published_at, p.edited_at, p.deleted_at, p.created_at, p.updated_at
		FROM posts p
		WHERE p.id = $2
		  AND p.deleted_at IS NULL
		  AND (p.expires_at IS NULL OR p.expires_at > NOW())
		  AND (
		    p.author_id = $1
		    OR p.privacy = 'PUBLIC'
		    OR (p.privacy = 'FRIENDS' AND EXISTS (
		          SELECT 1 FROM friend_connections fc
		          WHERE fc.deleted_at IS NULL AND fc.status = 'ACCEPTED'
		            AND ((fc.requester_id = p.author_id AND fc.addressee_id = $1) OR (fc.addressee_id = p.author_id AND fc.requester_id = $1))
		        ))
		    OR (p.privacy = 'TRUSTED_CIRCLE' AND EXISTS (
		          SELECT 1 FROM trusted_circle_memberships tcm
		          WHERE tcm.owner_id = p.author_id AND tcm.member_id = $1
		        ))
		    OR (p.privacy IN ('PRIVATE', 'ONE_TIME', 'TIMED') AND EXISTS (
		          SELECT 1 FROM post_audience_grants pag
		          WHERE pag.post_id = p.id
		            AND pag.subject_user_id = $1
		            AND (pag.expires_at IS NULL OR pag.expires_at > NOW())
		            AND (pag.max_views IS NULL OR pag.used_views < pag.max_views)
		        ))
		  )
		LIMIT 1`
	post, err := scanPost(r.db.QueryRow(ctx, query, viewerID, postID))
	if err != nil {
		return nil, err
	}
	if post.Privacy == enums.PostPrivacyOneTime && viewerID != post.AuthorID {
		_, _ = r.db.Exec(ctx, `UPDATE post_audience_grants SET used_views = used_views + 1 WHERE post_id = $1 AND subject_user_id = $2`, postID, viewerID)
	}
	return post, nil
}

func (r *Repository) Feed(ctx context.Context, viewerID string, page, limit int, contentType string) ([]model.Post, error) {
	offset := (page - 1) * limit
	query := `
		SELECT p.id, p.author_id, p.content_type, p.body, p.privacy, p.like_count, p.expires_at, p.one_time_view_limit,
		       p.published_at, p.edited_at, p.deleted_at, p.created_at, p.updated_at
		FROM posts p
		WHERE p.deleted_at IS NULL
		  AND (p.expires_at IS NULL OR p.expires_at > NOW())
		  AND ($4 = '' OR p.content_type = $4)
		  AND (
		    p.author_id = $1
		    OR p.privacy = 'PUBLIC'
		    OR (p.privacy = 'FRIENDS' AND EXISTS (
		          SELECT 1 FROM friend_connections fc
		          WHERE fc.deleted_at IS NULL AND fc.status = 'ACCEPTED'
		            AND ((fc.requester_id = p.author_id AND fc.addressee_id = $1) OR (fc.addressee_id = p.author_id AND fc.requester_id = $1))
		        ))
		    OR (p.privacy = 'TRUSTED_CIRCLE' AND EXISTS (
		          SELECT 1 FROM trusted_circle_memberships tcm
		          WHERE tcm.owner_id = p.author_id AND tcm.member_id = $1
		        ))
		    OR (p.privacy IN ('PRIVATE', 'ONE_TIME', 'TIMED') AND EXISTS (
		          SELECT 1 FROM post_audience_grants pag
		          WHERE pag.post_id = p.id
		            AND pag.subject_user_id = $1
		            AND (pag.expires_at IS NULL OR pag.expires_at > NOW())
		            AND (pag.max_views IS NULL OR pag.used_views < pag.max_views)
		        ))
		  )
		ORDER BY p.published_at DESC
		LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, query, viewerID, limit, offset, contentType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.Post, 0)
	for rows.Next() {
		post, err := scanPost(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *post)
	}
	return items, rows.Err()
}

func (r *Repository) AudienceUserIDs(ctx context.Context, postID string) ([]string, error) {
	rows, err := r.db.Query(ctx, `SELECT subject_user_id FROM post_audience_grants WHERE post_id = $1 ORDER BY created_at ASC`, postID)
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

func (r *Repository) MediaFileIDs(ctx context.Context, postID string) ([]string, error) {
	rows, err := r.db.Query(ctx, `SELECT media_file_id FROM post_media_attachments WHERE post_id = $1 ORDER BY created_at ASC`, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]string, 0)
	for rows.Next() {
		var mediaID string
		if err := rows.Scan(&mediaID); err != nil {
			return nil, err
		}
		items = append(items, mediaID)
	}
	return items, rows.Err()
}

func (r *Repository) MediaAttachmentSummaries(ctx context.Context, ownerID string, mediaIDs []string) ([]MediaAttachmentSummary, error) {
	if len(mediaIDs) == 0 {
		return nil, nil
	}
	items := make([]MediaAttachmentSummary, 0, len(mediaIDs))
	for _, mediaID := range mediaIDs {
		const query = `
			SELECT m.id, COALESCE(m.kind, 'DOCUMENT') AS kind, m.mime_type, m.status, us.purpose
			FROM media_files m
			JOIN upload_sessions us ON us.media_file_id = m.id AND us.owner_id = $2 AND us.status = 'COMPLETED'
			WHERE m.id = $1
			  AND m.owner_id = $2
			  AND m.deleted_at IS NULL
			ORDER BY us.completed_at DESC NULLS LAST
			LIMIT 1`
		var item MediaAttachmentSummary
		var kind, status, purpose string
		if err := r.db.QueryRow(ctx, query, mediaID, ownerID).Scan(&item.ID, &kind, &item.MimeType, &status, &purpose); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, apperrors.New(400, "posts.media_not_ready", "Media must be a completed upload owned by the current user")
			}
			return nil, err
		}
		item.Kind = enums.MediaKind(kind)
		item.Status = enums.MediaStatus(status)
		item.Purpose = enums.UploadPurpose(purpose)
		items = append(items, item)
	}
	return items, nil
}

func (r *Repository) EnsureOwnedMedia(ctx context.Context, ownerID string, mediaIDs []string) error {
	for _, mediaID := range mediaIDs {
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
			return apperrors.New(403, "posts.media_not_owned", "One or more media files do not belong to the current user")
		}
	}
	return nil
}

func (r *Repository) replaceAudience(ctx context.Context, tx pgx.Tx, postID string, audience []string, oneTimeLimit *int, expiresAt *time.Time) error {
	if _, err := tx.Exec(ctx, `DELETE FROM post_audience_grants WHERE post_id = $1`, postID); err != nil {
		return err
	}
	for _, userID := range audience {
		if _, err := tx.Exec(ctx, `
			INSERT INTO post_audience_grants (id, post_id, subject_user_id, max_views, expires_at)
			VALUES ($1, $2, $3, $4, $5)
		`, uuid.NewString(), postID, userID, oneTimeLimit, expiresAt); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) replaceMedia(ctx context.Context, tx pgx.Tx, postID string, mediaIDs []string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM post_media_attachments WHERE post_id = $1`, postID); err != nil {
		return err
	}
	for _, mediaID := range mediaIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO post_media_attachments (id, post_id, media_file_id)
			VALUES ($1, $2, $3)
		`, uuid.NewString(), postID, mediaID); err != nil {
			return err
		}
	}
	return nil
}

func scanPost(row interface {
	Scan(dest ...any) error
}) (*model.Post, error) {
	var post model.Post
	var privacy string
	var contentType string
	if err := row.Scan(
		&post.ID,
		&post.AuthorID,
		&contentType,
		&post.Body,
		&privacy,
		&post.LikeCount,
		&post.ExpiresAt,
		&post.OneTimeViewLimit,
		&post.PublishedAt,
		&post.EditedAt,
		&post.DeletedAt,
		&post.CreatedAt,
		&post.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	post.ContentType = enums.PostContentType(contentType)
	post.Privacy = enums.PostPrivacy(privacy)
	return &post, nil
}

func contentTypeValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func bodyValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func privacyValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (r *Repository) LikePost(ctx context.Context, userID, postID string) error {
	const query = `INSERT INTO post_likes (id, post_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`
	_, err := r.db.Exec(ctx, query, uuid.NewString(), postID, userID)
	return err
}

func (r *Repository) UnlikePost(ctx context.Context, userID, postID string) error {
	const query = `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`
	_, err := r.db.Exec(ctx, query, postID, userID)
	return err
}

func (r *Repository) IsPostLiked(ctx context.Context, userID, postID string) (bool, error) {
	var exists bool
	const query = `SELECT EXISTS(SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2)`
	if err := r.db.QueryRow(ctx, query, postID, userID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (r *Repository) GetPostLikes(ctx context.Context, postID string, page, limit int) ([]LikesListResponse, error) {
	offset := (page - 1) * limit
	const query = `
		SELECT u.id, u.username
		FROM post_likes pl
		JOIN users u ON u.id = pl.user_id
		WHERE pl.post_id = $1
		ORDER BY pl.created_at DESC
		LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, query, postID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]LikesListResponse, 0)
	for rows.Next() {
		var item LikesListResponse
		if err := rows.Scan(&item.UserID, &item.Username); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) GetCommentCount(ctx context.Context, postID string) (int, error) {
	var count int
	const query = `SELECT COALESCE(COUNT(*), 0) FROM comments WHERE post_id = $1 AND deleted_at IS NULL`
	if err := r.db.QueryRow(ctx, query, postID).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *Repository) GetComments(ctx context.Context, postID string, page, limit int, sortBy string) ([]model.Comment, error) {
	offset := (page - 1) * limit
	order := "DESC"
	if sortBy == "top" {
		order = "CASE WHEN c.like_count > 0 THEN 0 ELSE 1 END ASC, c.like_count DESC, c.created_at DESC"
	} else {
		order = "c.created_at DESC"
	}

	query := `
		SELECT c.id, c.post_id, c.author_id, c.parent_comment_id, c.content, c.like_count, c.reply_count, c.created_at, c.updated_at, c.deleted_at
		FROM comments c
		WHERE c.post_id = $1 AND c.parent_comment_id IS NULL AND c.deleted_at IS NULL
		ORDER BY ` + order + `
		LIMIT $2 OFFSET $3`

	rows, err := r.db.Query(ctx, query, postID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.Comment, 0)
	for rows.Next() {
		comment, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *comment)
	}
	return items, rows.Err()
}

func (r *Repository) CreateComment(ctx context.Context, userID, postID string, req CreateCommentRequest) (*model.Comment, error) {
	commentID := uuid.NewString()
	const query = `
		INSERT INTO comments (id, post_id, author_id, parent_comment_id, content, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING id, post_id, author_id, parent_comment_id, content, like_count, reply_count, created_at, updated_at, deleted_at`

	comment, err := scanComment(r.db.QueryRow(ctx, query, commentID, postID, userID, req.ParentCommentID, req.Content))
	if err != nil {
		return nil, err
	}
	return comment, nil
}

func (r *Repository) UpdateComment(ctx context.Context, userID, commentID string, req UpdateCommentRequest) (*model.Comment, error) {
	const query = `
		UPDATE comments
		SET content = $3, updated_at = NOW()
		WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL
		RETURNING id, post_id, author_id, parent_comment_id, content, like_count, reply_count, created_at, updated_at, deleted_at`

	comment, err := scanComment(r.db.QueryRow(ctx, query, commentID, userID, req.Content))
	if err != nil {
		return nil, err
	}
	return comment, nil
}

func (r *Repository) DeleteComment(ctx context.Context, userID, commentID string) error {
	const query = `UPDATE comments SET deleted_at = NOW() WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`
	tag, err := r.db.Exec(ctx, query, commentID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	return nil
}

func (r *Repository) LikeComment(ctx context.Context, userID, commentID string) error {
	const query = `INSERT INTO comment_likes (id, comment_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`
	_, err := r.db.Exec(ctx, query, uuid.NewString(), commentID, userID)
	return err
}

func (r *Repository) UnlikeComment(ctx context.Context, userID, commentID string) error {
	const query = `DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`
	_, err := r.db.Exec(ctx, query, commentID, userID)
	return err
}

func (r *Repository) IsCommentLiked(ctx context.Context, userID, commentID string) (bool, error) {
	var exists bool
	const query = `SELECT EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2)`
	if err := r.db.QueryRow(ctx, query, commentID, userID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func scanComment(row interface {
	Scan(dest ...any) error
}) (*model.Comment, error) {
	var comment model.Comment
	if err := row.Scan(
		&comment.ID,
		&comment.PostID,
		&comment.AuthorID,
		&comment.ParentCommentID,
		&comment.Content,
		&comment.LikeCount,
		&comment.ReplyCount,
		&comment.CreatedAt,
		&comment.UpdatedAt,
		&comment.DeletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &comment, nil
}
