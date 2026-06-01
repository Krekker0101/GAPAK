package admin

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Repository struct {
	db *pgxpool.Pool
}

type ListUsersParams struct {
	Search string
	Role   string
	Status string
	Limit  int
	Offset int
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Overview(ctx context.Context) (OverviewResponse, error) {
	var response OverviewResponse
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`).Scan(&response.TotalUsers); err != nil {
		return OverviewResponse{}, err
	}
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT user_id)
		FROM user_presence_connections
		WHERE disconnected_at IS NULL
		  AND state IN ('ACTIVE', 'IDLE')
		  AND last_heartbeat_at >= NOW() - INTERVAL '2 minutes'
	`).Scan(&response.ActiveUsers); err != nil {
		return OverviewResponse{}, err
	}
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM device_sessions
		WHERE revoked_at IS NULL
		  AND expires_at > NOW()
	`).Scan(&response.ActiveSessions); err != nil {
		return OverviewResponse{}, err
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '7 days'`).Scan(&response.NewUsers7d); err != nil {
		return OverviewResponse{}, err
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role = 'ADMIN'`).Scan(&response.Admins); err != nil {
		return OverviewResponse{}, err
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL`).Scan(&response.Posts); err != nil {
		return OverviewResponse{}, err
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM trust_rooms WHERE deleted_at IS NULL`).Scan(&response.TrustRooms); err != nil {
		return OverviewResponse{}, err
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM audit_events WHERE created_at >= NOW() - INTERVAL '24 hours'`).Scan(&response.SecurityEvents24); err != nil {
		return OverviewResponse{}, err
	}

	trend, err := r.SignupTrend(ctx)
	if err != nil {
		return OverviewResponse{}, err
	}
	response.SignupTrend = trend

	if err := r.db.QueryRow(ctx, `SELECT NOW()`).Scan(&response.GeneratedAt); err != nil {
		return OverviewResponse{}, err
	}

	return response, nil
}

func (r *Repository) SignupTrend(ctx context.Context) ([]TrendPoint, error) {
	rows, err := r.db.Query(ctx, `
		SELECT to_char(day::date, 'YYYY-MM-DD') AS day,
		       COUNT(u.id) AS total
		FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') day
		LEFT JOIN users u
		  ON u.created_at::date = day::date
		 AND u.deleted_at IS NULL
		GROUP BY day
		ORDER BY day ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := make([]TrendPoint, 0, 7)
	for rows.Next() {
		var point TrendPoint
		if err := rows.Scan(&point.Date, &point.Count); err != nil {
			return nil, err
		}
		points = append(points, point)
	}
	return points, rows.Err()
}

func (r *Repository) ListUsers(ctx context.Context, params ListUsersParams) (ListUsersResponse, error) {
	where, args := userFilters(params)
	countQuery := `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL` + where

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return ListUsersResponse{}, err
	}

	argsWithPaging := append(append([]any{}, args...), params.Limit, params.Offset)
	query := `
		SELECT id, email, username, display_name, role, account_status, is_anonymous,
		       two_factor_enabled, last_seen_at, created_at, updated_at
		FROM users
		WHERE deleted_at IS NULL` + where + `
		ORDER BY created_at DESC
		LIMIT $` + fmt.Sprint(len(args)+1) + ` OFFSET $` + fmt.Sprint(len(args)+2)

	rows, err := r.db.Query(ctx, query, argsWithPaging...)
	if err != nil {
		return ListUsersResponse{}, err
	}
	defer rows.Close()

	users := make([]AdminUserResponse, 0, params.Limit)
	for rows.Next() {
		item, err := scanAdminUser(rows)
		if err != nil {
			return ListUsersResponse{}, err
		}
		users = append(users, item)
	}
	if err := rows.Err(); err != nil {
		return ListUsersResponse{}, err
	}

	return ListUsersResponse{
		Users:  users,
		Total:  total,
		Limit:  params.Limit,
		Offset: params.Offset,
	}, nil
}

func (r *Repository) FindUser(ctx context.Context, userID string) (AdminUserResponse, error) {
	const query = `
		SELECT id, email, username, display_name, role, account_status, is_anonymous,
		       two_factor_enabled, last_seen_at, created_at, updated_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
		LIMIT 1`
	return scanAdminUser(r.db.QueryRow(ctx, query, userID))
}

func (r *Repository) CountAdmins(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role = 'ADMIN' AND account_status = 'ACTIVE'`).Scan(&count)
	return count, err
}

func (r *Repository) UpdateUser(ctx context.Context, userID string, req UpdateUserRequest) (AdminUserResponse, error) {
	fields := []string{}
	args := []any{userID}

	if req.DisplayName != nil {
		fields = append(fields, fmt.Sprintf("display_name = $%d", len(args)+1))
		args = append(args, strings.TrimSpace(*req.DisplayName))
	}
	if req.Role != nil {
		fields = append(fields, fmt.Sprintf(`role = $%d::"UserRole"`, len(args)+1))
		args = append(args, strings.TrimSpace(*req.Role))
	}
	if req.AccountStatus != nil {
		fields = append(fields, fmt.Sprintf(`account_status = $%d::"AccountStatus"`, len(args)+1))
		args = append(args, strings.TrimSpace(*req.AccountStatus))
	}
	if len(fields) == 0 {
		return r.FindUser(ctx, userID)
	}

	query := `
		UPDATE users
		SET ` + strings.Join(fields, ", ") + `, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING id, email, username, display_name, role, account_status, is_anonymous,
		          two_factor_enabled, last_seen_at, created_at, updated_at`

	return scanAdminUser(r.db.QueryRow(ctx, query, args...))
}

func (r *Repository) ListPages(ctx context.Context, locale string) ([]PageSummaryResponse, error) {
	query := `
		SELECT id, slug, locale, title, status, version, updated_by, published_at, created_at, updated_at
		FROM site_pages`
	args := []any{}
	if strings.TrimSpace(locale) != "" {
		args = append(args, locale)
		query += ` WHERE locale = $1`
	}
	query += ` ORDER BY updated_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pages := make([]PageSummaryResponse, 0)
	for rows.Next() {
		page, err := scanPageSummary(rows)
		if err != nil {
			return nil, err
		}
		pages = append(pages, page)
	}
	return pages, rows.Err()
}

func (r *Repository) GetPage(ctx context.Context, slug, locale string) (PageResponse, error) {
	const query = `
		SELECT id, slug, locale, title, status, content_json, version, updated_by, published_at, created_at, updated_at
		FROM site_pages
		WHERE slug = $1 AND locale = $2
		LIMIT 1`
	return scanPage(r.db.QueryRow(ctx, query, slug, locale))
}

func (r *Repository) EnsurePage(ctx context.Context, slug, locale, actorUserID string) (PageResponse, error) {
	page, err := r.GetPage(ctx, slug, locale)
	if err == nil {
		return page, nil
	}
	if !errors.Is(err, apperrors.ErrNotFound) {
		return PageResponse{}, err
	}

	content := PageContent{Blocks: defaultBlocks(slug, locale)}
	rawContent, _ := json.Marshal(content)
	pageID := uuid.NewString()
	const query = `
		INSERT INTO site_pages (id, slug, locale, title, status, content_json, updated_by, updated_at)
		VALUES ($1, $2, $3, $4, 'DRAFT', $5::jsonb, $6, NOW())
		RETURNING id, slug, locale, title, status, content_json, version, updated_by, published_at, created_at, updated_at`
	return scanPage(r.db.QueryRow(ctx, query, pageID, slug, locale, defaultPageTitle(slug), rawContent, actorUserID))
}

func (r *Repository) UpdatePage(ctx context.Context, slug, locale, actorUserID string, req UpdatePageRequest, content PageContent) (PageResponse, error) {
	rawContent, _ := json.Marshal(content)

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return PageResponse{}, err
	}
	defer tx.Rollback(ctx)

	const updateQuery = `
		UPDATE site_pages
		SET title = $3,
		    status = $4,
		    content_json = $5::jsonb,
		    version = version + 1,
		    updated_by = $6,
		    published_at = CASE WHEN $4 = 'PUBLISHED' THEN NOW() ELSE published_at END,
		    updated_at = NOW()
		WHERE slug = $1 AND locale = $2
		RETURNING id, slug, locale, title, status, content_json, version, updated_by, published_at, created_at, updated_at`
	page, err := scanPage(tx.QueryRow(ctx, updateQuery, slug, locale, req.Title, req.Status, rawContent, actorUserID))
	if err != nil {
		return PageResponse{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO site_page_revisions (id, page_id, version, content_json, edited_by)
		VALUES ($1, $2, $3, $4::jsonb, $5)
	`, uuid.NewString(), page.ID, page.Version, rawContent, actorUserID); err != nil {
		return PageResponse{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return PageResponse{}, err
	}
	return page, nil
}

func userFilters(params ListUsersParams) (string, []any) {
	clauses := []string{}
	args := []any{}

	if params.Search != "" {
		args = append(args, "%"+strings.ToLower(params.Search)+"%")
		clauses = append(clauses, fmt.Sprintf("(LOWER(username) LIKE $%d OR LOWER(display_name) LIKE $%d OR LOWER(COALESCE(email, '')) LIKE $%d)", len(args), len(args), len(args)))
	}
	if params.Role != "" {
		args = append(args, params.Role)
		clauses = append(clauses, fmt.Sprintf(`role = $%d::"UserRole"`, len(args)))
	}
	if params.Status != "" {
		args = append(args, params.Status)
		clauses = append(clauses, fmt.Sprintf(`account_status = $%d::"AccountStatus"`, len(args)))
	}
	if len(clauses) == 0 {
		return "", args
	}
	return " AND " + strings.Join(clauses, " AND "), args
}

func scanAdminUser(row interface {
	Scan(dest ...any) error
}) (AdminUserResponse, error) {
	var item AdminUserResponse
	var email sql.NullString
	if err := row.Scan(
		&item.ID,
		&email,
		&item.Username,
		&item.DisplayName,
		&item.Role,
		&item.AccountStatus,
		&item.IsAnonymous,
		&item.TwoFactorEnabled,
		&item.LastSeenAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AdminUserResponse{}, apperrors.ErrNotFound
		}
		return AdminUserResponse{}, err
	}
	if email.Valid {
		item.Email = &email.String
	}
	return item, nil
}

func scanPageSummary(row interface {
	Scan(dest ...any) error
}) (PageSummaryResponse, error) {
	var page PageSummaryResponse
	if err := row.Scan(
		&page.ID,
		&page.Slug,
		&page.Locale,
		&page.Title,
		&page.Status,
		&page.Version,
		&page.UpdatedBy,
		&page.PublishedAt,
		&page.CreatedAt,
		&page.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PageSummaryResponse{}, apperrors.ErrNotFound
		}
		return PageSummaryResponse{}, err
	}
	return page, nil
}

func scanPage(row interface {
	Scan(dest ...any) error
}) (PageResponse, error) {
	var page PageResponse
	var rawContent []byte
	if err := row.Scan(
		&page.ID,
		&page.Slug,
		&page.Locale,
		&page.Title,
		&page.Status,
		&rawContent,
		&page.Version,
		&page.UpdatedBy,
		&page.PublishedAt,
		&page.CreatedAt,
		&page.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PageResponse{}, apperrors.ErrNotFound
		}
		return PageResponse{}, err
	}
	if err := json.Unmarshal(rawContent, &page.Content); err != nil {
		return PageResponse{}, apperrors.Wrap(err, 500, "admin.content_invalid", "Stored page content is invalid")
	}
	if page.Content.Blocks == nil {
		page.Content.Blocks = []ContentBlock{}
	}
	return page, nil
}
