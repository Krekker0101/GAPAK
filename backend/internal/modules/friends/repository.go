package friends

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/domain/enums"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Repository struct {
	db *pgxpool.Pool
}

type ConnectionRecord struct {
	ID               string
	RequesterID      string
	AddresseeID      string
	Status           string
	AcceptedAt       *time.Time
	TrustedByCurrent bool
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateRequest(ctx context.Context, requesterID, addresseeID string) error {
	const existingQuery = `
		SELECT 1
		FROM friend_connections
		WHERE deleted_at IS NULL
		  AND (
		    (requester_id = $1 AND addressee_id = $2)
		    OR (requester_id = $2 AND addressee_id = $1)
		  )
		LIMIT 1`
	var existing int
	if err := r.db.QueryRow(ctx, existingQuery, requesterID, addresseeID).Scan(&existing); err == nil {
		return apperrors.ErrConflict
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	const query = `
		INSERT INTO friend_connections (id, requester_id, addressee_id, status, updated_at)
		VALUES ($1, $2, $3, $4, NOW())`
	_, err := r.db.Exec(ctx, query, uuid.NewString(), requesterID, addresseeID, string(enums.ConnectionPending))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return apperrors.ErrConflict
		}
		return err
	}
	return nil
}

func (r *Repository) Accept(ctx context.Context, currentUserID, connectionID string) error {
	const query = `
		UPDATE friend_connections
		SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND addressee_id = $2 AND status = 'PENDING' AND deleted_at IS NULL`
	tag, err := r.db.Exec(ctx, query, connectionID, currentUserID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	return nil
}

func (r *Repository) Remove(ctx context.Context, currentUserID, connectionID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	const findQuery = `
		SELECT requester_id, addressee_id
		FROM friend_connections
		WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2) AND deleted_at IS NULL
		LIMIT 1`
	var requesterID, addresseeID string
	if err := tx.QueryRow(ctx, findQuery, connectionID, currentUserID).Scan(&requesterID, &addresseeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperrors.ErrNotFound
		}
		return err
	}

	const query = `
		UPDATE friend_connections
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2) AND deleted_at IS NULL`
	tag, err := tx.Exec(ctx, query, connectionID, currentUserID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM trusted_circle_memberships
		WHERE (owner_id = $1 AND member_id = $2)
		   OR (owner_id = $2 AND member_id = $1)
	`, requesterID, addresseeID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *Repository) SetTrusted(ctx context.Context, currentUserID, connectionID string, enabled bool) error {
	const query = `
		SELECT requester_id, addressee_id
		FROM friend_connections
		WHERE id = $1 AND status = 'ACCEPTED' AND deleted_at IS NULL AND (requester_id = $2 OR addressee_id = $2)
		LIMIT 1`
	var requesterID, addresseeID string
	if err := r.db.QueryRow(ctx, query, connectionID, currentUserID).Scan(&requesterID, &addresseeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperrors.ErrNotFound
		}
		return err
	}
	memberID := requesterID
	if requesterID == currentUserID {
		memberID = addresseeID
	}

	if enabled {
		_, err := r.db.Exec(ctx, `
			INSERT INTO trusted_circle_memberships (id, owner_id, member_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (owner_id, member_id) DO NOTHING
		`, uuid.NewString(), currentUserID, memberID)
		return err
	}

	_, err := r.db.Exec(ctx, `DELETE FROM trusted_circle_memberships WHERE owner_id = $1 AND member_id = $2`, currentUserID, memberID)
	return err
}

func (r *Repository) List(ctx context.Context, currentUserID string) ([]ConnectionRecord, error) {
	const query = `
		SELECT fc.id, fc.requester_id, fc.addressee_id, fc.status, fc.accepted_at,
		       EXISTS (
		         SELECT 1
		         FROM trusted_circle_memberships tcm
		         WHERE tcm.owner_id = $1
		           AND tcm.member_id = CASE WHEN fc.requester_id = $1 THEN fc.addressee_id ELSE fc.requester_id END
		       ) AS trusted_by_current,
		       fc.created_at, fc.updated_at
		FROM friend_connections fc
		WHERE (fc.requester_id = $1 OR fc.addressee_id = $1) AND fc.deleted_at IS NULL
		ORDER BY fc.updated_at DESC`
	rows, err := r.db.Query(ctx, query, currentUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ConnectionRecord, 0)
	for rows.Next() {
		var item ConnectionRecord
		if err := rows.Scan(
			&item.ID,
			&item.RequesterID,
			&item.AddresseeID,
			&item.Status,
			&item.AcceptedAt,
			&item.TrustedByCurrent,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
