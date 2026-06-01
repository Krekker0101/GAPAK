package moderation

import (
	"context"
	"errors"

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

func (r *Repository) Create(ctx context.Context, reporterUserID string, req CreateReportRequest) (*model.ModerationReport, error) {
	const query = `
		INSERT INTO moderation_reports (id, reporter_user_id, target_type, target_id, reason, description, status, updated_at)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), 'OPEN', NOW())
		RETURNING id, reporter_user_id, target_type, target_id, reason, description, status, handled_by_user_id, resolution_note, created_at, updated_at`
	return scanReport(r.db.QueryRow(ctx, query, uuid.NewString(), reporterUserID, req.TargetType, req.TargetID, req.Reason, req.Description))
}

func (r *Repository) ListOwn(ctx context.Context, reporterUserID string) ([]model.ModerationReport, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, reporter_user_id, target_type, target_id, reason, description, status, handled_by_user_id, resolution_note, created_at, updated_at
		FROM moderation_reports
		WHERE reporter_user_id = $1
		ORDER BY created_at DESC
	`, reporterUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectReports(rows)
}

func (r *Repository) ListAll(ctx context.Context) ([]model.ModerationReport, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, reporter_user_id, target_type, target_id, reason, description, status, handled_by_user_id, resolution_note, created_at, updated_at
		FROM moderation_reports
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectReports(rows)
}

func (r *Repository) Resolve(ctx context.Context, reviewerUserID, reportID string, req ResolveReportRequest) (*model.ModerationReport, error) {
	const query = `
		UPDATE moderation_reports
		SET status = $3, handled_by_user_id = $2, resolution_note = NULLIF($4, ''), updated_at = NOW()
		WHERE id = $1
		RETURNING id, reporter_user_id, target_type, target_id, reason, description, status, handled_by_user_id, resolution_note, created_at, updated_at`
	return scanReport(r.db.QueryRow(ctx, query, reportID, reviewerUserID, req.Status, req.ResolutionNote))
}

func collectReports(rows pgx.Rows) ([]model.ModerationReport, error) {
	items := make([]model.ModerationReport, 0)
	for rows.Next() {
		report, err := scanReport(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *report)
	}
	return items, rows.Err()
}

func scanReport(row interface{ Scan(dest ...any) error }) (*model.ModerationReport, error) {
	var report model.ModerationReport
	var targetType, reason, status string
	if err := row.Scan(
		&report.ID,
		&report.ReporterUserID,
		&targetType,
		&report.TargetID,
		&reason,
		&report.Description,
		&status,
		&report.HandledByUserID,
		&report.ResolutionNote,
		&report.CreatedAt,
		&report.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	report.TargetType = enums.ModerationTargetType(targetType)
	report.Reason = enums.ModerationReason(reason)
	report.Status = enums.ModerationStatus(status)
	return &report, nil
}
