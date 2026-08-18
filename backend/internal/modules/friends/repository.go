package friends

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/platform/concurrency"
	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/events"
	"github.com/gapak/backend/internal/platform/observability"
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

type SuggestionRecord struct {
	ID                     string
	Username               string
	DisplayName            string
	Bio                    string
	AvatarFileID           string
	Role                   string
	IsAnonymous            bool
	ProfileVisibility      string
	MutualConnectionsCount int
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateRequest(ctx context.Context, requesterID, addresseeID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var allowFriendRequests bool
	if err := tx.QueryRow(ctx, `
		SELECT ups.allow_friend_requests
		FROM users u
		JOIN user_privacy_settings ups ON ups.user_id = u.id
		WHERE u.id = $1 AND u.account_status = 'ACTIVE' AND u.deleted_at IS NULL
	`, addresseeID).Scan(&allowFriendRequests); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperrors.ErrNotFound
		}
		return err
	}
	if !allowFriendRequests {
		return apperrors.New(403, "connections.requests_disabled", "This account does not accept connection requests")
	}
	const existingQuery = `
		SELECT 1 FROM friend_connections
		WHERE deleted_at IS NULL AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)) LIMIT 1`
	var existing int
	if err := tx.QueryRow(ctx, existingQuery, requesterID, addresseeID).Scan(&existing); err == nil {
		return apperrors.ErrConflict
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	connectionID := uuid.NewString()
	const query = `INSERT INTO friend_connections (id, requester_id, addressee_id, status, updated_at) VALUES ($1, $2, $3, $4, NOW())`
	if _, err := tx.Exec(ctx, query, connectionID, requesterID, addresseeID, string(enums.ConnectionPending)); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return apperrors.ErrConflict
		}
		return err
	}
	if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
		Type: events.ConnectionRequestCreated, AggregateType: "connection", AggregateID: connectionID,
		ActorID: strPtr(requesterID), RecipientUserIDs: []string{addresseeID},
		Payload:        map[string]any{"connectionId": connectionID, "requesterId": requesterID, "addresseeId": addresseeID},
		IdempotencyKey: "connection-request-created:" + connectionID, CorrelationID: observability.CorrelationID(ctx),
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) Accept(ctx context.Context, currentUserID, connectionID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := concurrency.NewStore(r.db, "").GuardTx(ctx, tx, "connection", connectionID); err != nil {
		return err
	}
	var requesterID string
	if err := tx.QueryRow(ctx, `SELECT requester_id FROM friend_connections WHERE id = $1 AND addressee_id = $2 AND status = 'PENDING' AND deleted_at IS NULL FOR UPDATE`, connectionID, currentUserID).Scan(&requesterID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperrors.ErrNotFound
		}
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE friend_connections SET status='ACCEPTED', accepted_at=NOW(), updated_at=NOW() WHERE id=$1`, connectionID); err != nil {
		return err
	}
	if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
		Type: events.ConnectionRequestAccepted, AggregateType: "connection", AggregateID: connectionID,
		ActorID: strPtr(currentUserID), RecipientUserIDs: []string{requesterID},
		Payload:        map[string]any{"connectionId": connectionID, "requesterId": requesterID, "addresseeId": currentUserID},
		IdempotencyKey: "connection-request-accepted:" + connectionID, CorrelationID: observability.CorrelationID(ctx),
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) Remove(ctx context.Context, currentUserID, connectionID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := concurrency.NewStore(r.db, "").GuardTx(ctx, tx, "connection", connectionID); err != nil {
		return err
	}

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

	recipientID := requesterID
	if requesterID == currentUserID {
		recipientID = addresseeID
	}
	if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
		Type: events.ConnectionRemoved, AggregateType: "connection", AggregateID: connectionID,
		ActorID: strPtr(currentUserID), RecipientUserIDs: []string{recipientID},
		Payload:        map[string]any{"connectionId": connectionID, "requesterId": requesterID, "addresseeId": addresseeID},
		IdempotencyKey: "connection-removed:" + connectionID + ":" + currentUserID, CorrelationID: observability.CorrelationID(ctx),
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func strPtr(v string) *string { return &v }

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

func (r *Repository) Suggestions(ctx context.Context, currentUserID string, limit int) ([]SuggestionRecord, error) {
	const query = `
		WITH my_connections AS (
			SELECT CASE WHEN fc.requester_id = $1 THEN fc.addressee_id ELSE fc.requester_id END AS user_id
			FROM friend_connections fc
			WHERE fc.status = 'ACCEPTED' AND fc.deleted_at IS NULL
			  AND (fc.requester_id = $1 OR fc.addressee_id = $1)
		), candidate_scores AS (
			SELECT CASE WHEN fc.requester_id = mc.user_id THEN fc.addressee_id ELSE fc.requester_id END AS candidate_id,
			       COUNT(DISTINCT mc.user_id)::int AS mutual_count
			FROM my_connections mc
			JOIN friend_connections fc
			  ON fc.status = 'ACCEPTED' AND fc.deleted_at IS NULL
			 AND (fc.requester_id = mc.user_id OR fc.addressee_id = mc.user_id)
			WHERE CASE WHEN fc.requester_id = mc.user_id THEN fc.addressee_id ELSE fc.requester_id END <> $1
			GROUP BY candidate_id
		)
		SELECT u.id, u.username, u.display_name, u.bio, u.avatar_file_id, u.role,
		       u.is_anonymous, ups.profile_visibility, cs.mutual_count
		FROM candidate_scores cs
		JOIN users u ON u.id = cs.candidate_id
		JOIN user_privacy_settings ups ON ups.user_id = u.id
		WHERE u.account_status = 'ACTIVE' AND u.deleted_at IS NULL
		  AND u.is_anonymous = false
		  AND ups.profile_visibility = 'PUBLIC'
		  AND ups.allow_friend_requests = true
		  AND NOT EXISTS (
			SELECT 1 FROM friend_connections existing
			WHERE existing.deleted_at IS NULL
			  AND ((existing.requester_id = $1 AND existing.addressee_id = u.id)
			    OR (existing.requester_id = u.id AND existing.addressee_id = $1))
		  )
		ORDER BY cs.mutual_count DESC, u.created_at DESC, u.id DESC
		LIMIT $2`
	rows, err := r.db.Query(ctx, query, currentUserID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]SuggestionRecord, 0)
	for rows.Next() {
		var item SuggestionRecord
		var bio, avatarFileID sql.NullString
		if err := rows.Scan(&item.ID, &item.Username, &item.DisplayName, &bio, &avatarFileID, &item.Role, &item.IsAnonymous, &item.ProfileVisibility, &item.MutualConnectionsCount); err != nil {
			return nil, err
		}
		if bio.Valid {
			item.Bio = bio.String
		}
		if avatarFileID.Valid {
			item.AvatarFileID = avatarFileID.String
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
