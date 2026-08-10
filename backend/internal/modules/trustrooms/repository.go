package trustrooms

import (
	"context"
	"database/sql"
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

func (r *Repository) Create(ctx context.Context, ownerID string, req CreateTrustRoomRequest) (*model.TrustRoom, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	roomID := uuid.NewString()
	const roomQuery = `
		INSERT INTO trust_rooms (id, owner_id, name, description, visibility, access_mode, require_two_factor, min_account_age_days, message_retention_days, expires_at, updated_at)
		VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7, $8, $9, $10, NOW())
		RETURNING id, owner_id, name, description, visibility, access_mode, require_two_factor, min_account_age_days, message_retention_days, expires_at, created_at, updated_at, deleted_at`
	room, err := scanRoom(tx.QueryRow(ctx, roomQuery, roomID, ownerID, req.Name, req.Description, req.Visibility, req.AccessMode, req.RequireTwoFactor, req.MinAccountAgeDays, req.MessageRetentionDays, req.ExpiresAt))
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
		       tr.min_account_age_days, tr.message_retention_days, tr.expires_at, tr.created_at, tr.updated_at, tr.deleted_at
		FROM trust_rooms tr
		JOIN trust_room_members trm ON trm.room_id = tr.id AND trm.user_id = $1 AND trm.deleted_at IS NULL
		WHERE tr.deleted_at IS NULL AND (tr.expires_at IS NULL OR tr.expires_at > NOW())
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

func (r *Repository) GetByMember(ctx context.Context, userID, roomID string) (*model.TrustRoom, string, int, error) {
	const query = `
		SELECT tr.id, tr.owner_id, tr.name, tr.description, tr.visibility, tr.access_mode, tr.require_two_factor,
		       tr.min_account_age_days, tr.message_retention_days, tr.expires_at, tr.created_at, tr.updated_at, tr.deleted_at,
		       trm.role,
		       (
		           SELECT COUNT(*)
		           FROM trust_room_members cnt
		           WHERE cnt.room_id = tr.id AND cnt.deleted_at IS NULL
		       ) AS member_count
		FROM trust_rooms tr
		JOIN trust_room_members trm ON trm.room_id = tr.id AND trm.user_id = $2 AND trm.deleted_at IS NULL
		WHERE tr.id = $1 AND tr.deleted_at IS NULL AND (tr.expires_at IS NULL OR tr.expires_at > NOW())
		LIMIT 1`

	var room model.TrustRoom
	var description *string
	var expiresAt *time.Time
	var visibility, accessMode, role string
	var memberCount int64
	if err := r.db.QueryRow(ctx, query, roomID, userID).Scan(
		&room.ID,
		&room.OwnerID,
		&room.Name,
		&description,
		&visibility,
		&accessMode,
		&room.RequireTwoFactor,
		&room.MinAccountAgeDays,
		&room.MessageRetentionDays,
		&expiresAt,
		&room.CreatedAt,
		&room.UpdatedAt,
		&room.DeletedAt,
		&role,
		&memberCount,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", 0, apperrors.ErrNotFound
		}
		return nil, "", 0, err
	}

	room.Description = description
	room.ExpiresAt = expiresAt
	room.Visibility = enums.TrustRoomVisibility(visibility)
	room.AccessMode = enums.TrustRoomAccessMode(accessMode)
	return &room, role, int(memberCount), nil
}

func (r *Repository) ListMembers(ctx context.Context, roomID string) ([]TrustRoomMemberResponse, error) {
	const query = `
		SELECT trm.user_id, u.username, u.display_name, u.avatar_file_id, trm.role, trm.joined_at, trm.trusted_until
		FROM trust_room_members trm
		JOIN users u ON u.id = trm.user_id
		WHERE trm.room_id = $1 AND trm.deleted_at IS NULL AND u.deleted_at IS NULL
		ORDER BY trm.joined_at ASC`

	rows, err := r.db.Query(ctx, query, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]TrustRoomMemberResponse, 0)
	for rows.Next() {
		var (
			item         TrustRoomMemberResponse
			avatarFile   sql.NullString
			joinedAt     time.Time
			trustedUntil sql.NullTime
		)

		if err := rows.Scan(&item.UserID, &item.Username, &item.DisplayName, &avatarFile, &item.Role, &joinedAt, &trustedUntil); err != nil {
			return nil, err
		}

		item.JoinedAt = joinedAt
		if avatarFile.Valid {
			value := avatarFile.String
			item.AvatarFileID = &value
		}
		if trustedUntil.Valid {
			value := trustedUntil.Time
			item.TrustedUntil = &value
		}
		items = append(items, item)
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

	if !allowedMemberRole(enums.TrustRoomRole(role), enums.TrustRoomRole(req.Role)) {
		return apperrors.ErrForbidden
	}

	const insertQuery = `
		INSERT INTO trust_room_members (room_id, user_id, role, joined_at, invited_by_user_id)
		VALUES ($1, $2, $3, NOW(), $4)
		ON CONFLICT (room_id, user_id) DO UPDATE SET role = EXCLUDED.role, deleted_at = NULL`
	_, err := r.db.Exec(ctx, insertQuery, roomID, req.UserID, req.Role, actorUserID)
	return err
}

func allowedMemberRole(actorRole, requestedRole enums.TrustRoomRole) bool {
	// There is intentionally no client-driven ownership transfer. An admin may
	// manage members but cannot mint another owner or administrator; only the
	// room owner may grant ADMIN. OWNER remains reserved for room creation.
	if requestedRole == enums.TrustRoleOwner {
		return false
	}
	if actorRole == enums.TrustRoleAdmin && requestedRole == enums.TrustRoleAdmin {
		return false
	}
	return requestedRole == enums.TrustRoleAdmin || requestedRole == enums.TrustRoleModerator ||
		requestedRole == enums.TrustRoleMember || requestedRole == enums.TrustRoleAuditor
}

func scanRoom(row interface{ Scan(dest ...any) error }) (*model.TrustRoom, error) {
	var room model.TrustRoom
	var description *string
	var expiresAt *time.Time
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
		&expiresAt,
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
	room.ExpiresAt = expiresAt
	room.Visibility = enums.TrustRoomVisibility(visibility)
	room.AccessMode = enums.TrustRoomAccessMode(accessMode)
	return &room, nil
}
