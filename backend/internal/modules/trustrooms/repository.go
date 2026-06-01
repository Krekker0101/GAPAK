package trustrooms

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

func (r *Repository) Create(ctx context.Context, ownerID string, req CreateTrustRoomRequest) (*model.TrustRoom, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	roomID := uuid.NewString()
	const roomQuery = `
		INSERT INTO trust_rooms (id, owner_id, name, description, visibility, access_mode, require_two_factor, min_account_age_days, message_retention_days, updated_at)
		VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7, $8, $9, NOW())
		RETURNING id, owner_id, name, description, visibility, access_mode, require_two_factor, min_account_age_days, message_retention_days, created_at, updated_at, deleted_at`
	room, err := scanRoom(tx.QueryRow(ctx, roomQuery, roomID, ownerID, req.Name, req.Description, req.Visibility, req.AccessMode, req.RequireTwoFactor, req.MinAccountAgeDays, req.MessageRetentionDays))
	if err != nil {
		return nil, err
	}

	const membershipQuery = `
		INSERT INTO trust_room_members (room_id, user_id, role, joined_at)
		VALUES ($1, $2, $3, NOW())`
	if _, err := tx.Exec(ctx, membershipQuery, roomID, ownerID, string(enums.TrustRoleOwner)); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return room, nil
}

func (r *Repository) ListByMember(ctx context.Context, userID string) ([]model.TrustRoom, error) {
	const query = `
		SELECT tr.id, tr.owner_id, tr.name, tr.description, tr.visibility, tr.access_mode, tr.require_two_factor,
		       tr.min_account_age_days, tr.message_retention_days, tr.created_at, tr.updated_at, tr.deleted_at
		FROM trust_rooms tr
		JOIN trust_room_members trm ON trm.room_id = tr.id AND trm.user_id = $1 AND trm.deleted_at IS NULL
		WHERE tr.deleted_at IS NULL
		ORDER BY tr.updated_at DESC`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.TrustRoom, 0)
	for rows.Next() {
		room, err := scanRoom(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *room)
	}
	return items, rows.Err()
}

func (r *Repository) AddMember(ctx context.Context, actorUserID, roomID string, req AddMemberRequest) error {
	const roleQuery = `
		SELECT role
		FROM trust_room_members
		WHERE room_id = $1 AND user_id = $2 AND deleted_at IS NULL
		LIMIT 1`
	var role string
	if err := r.db.QueryRow(ctx, roleQuery, roomID, actorUserID).Scan(&role); err != nil {
		return apperrors.ErrForbidden
	}
	if role != string(enums.TrustRoleOwner) && role != string(enums.TrustRoleAdmin) {
		return apperrors.ErrForbidden
	}

	const insertQuery = `
		INSERT INTO trust_room_members (room_id, user_id, role, joined_at, invited_by_user_id)
		VALUES ($1, $2, $3, NOW(), $4)
		ON CONFLICT (room_id, user_id) DO UPDATE SET role = EXCLUDED.role, deleted_at = NULL`
	_, err := r.db.Exec(ctx, insertQuery, roomID, req.UserID, req.Role, actorUserID)
	return err
}

func scanRoom(row interface{ Scan(dest ...any) error }) (*model.TrustRoom, error) {
	var room model.TrustRoom
	var description *string
	var visibility, accessMode string
	if err := row.Scan(
		&room.ID,
		&room.OwnerID,
		&room.Name,
		&description,
		&visibility,
		&accessMode,
		&room.RequireTwoFactor,
		&room.MinAccountAgeDays,
		&room.MessageRetentionDays,
		&room.CreatedAt,
		&room.UpdatedAt,
		&room.DeletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	room.Description = description
	room.Visibility = enums.TrustRoomVisibility(visibility)
	room.AccessMode = enums.TrustRoomAccessMode(accessMode)
	return &room, nil
}
