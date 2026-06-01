package battles

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

func (r *Repository) Create(ctx context.Context, challengerID string, req CreateBattleRequest) (*model.Battle, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	roundDuration := req.RoundDurationSec
	if roundDuration == 0 {
		roundDuration = 60
	}
	const query = `
		INSERT INTO battles (
			id, challenger_user_id, opponent_user_id, trust_room_id, live_stream_id, mode, status, title,
			invitation_message, scheduled_for, round_duration_sec, score_host_a, score_host_b, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, 'INVITED', $7, NULLIF($8, ''), $9, $10, 0, 0, NOW())
		RETURNING id, challenger_user_id, opponent_user_id, trust_room_id, live_stream_id, mode, status, title,
		          invitation_message, scheduled_for, accepted_at, started_at, ended_at, round_duration_sec,
		          score_host_a, score_host_b, created_at, updated_at`
	item, err := scanBattle(tx.QueryRow(ctx, query,
		uuid.NewString(),
		challengerID,
		req.OpponentUserID,
		req.TrustRoomID,
		req.LiveStreamID,
		req.Mode,
		req.Title,
		stringPtr(req.InvitationMessage),
		req.ScheduledFor,
		roundDuration,
	))
	if err != nil {
		return nil, err
	}

	if err := r.upsertParticipant(ctx, tx, item.ID, challengerID, "HOST_A", true); err != nil {
		return nil, err
	}
	if err := r.upsertParticipant(ctx, tx, item.ID, req.OpponentUserID, "HOST_B", true); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return item, nil
}

func (r *Repository) ListVisible(ctx context.Context, viewerID string, page, limit int) ([]model.Battle, error) {
	offset := (page - 1) * limit
	const query = `
		SELECT id, challenger_user_id, opponent_user_id, trust_room_id, live_stream_id, mode, status, title,
		       invitation_message, scheduled_for, accepted_at, started_at, ended_at, round_duration_sec,
		       score_host_a, score_host_b, created_at, updated_at
		FROM battles
		WHERE challenger_user_id = $1 OR opponent_user_id = $1 OR EXISTS (
		    SELECT 1 FROM battle_participants bp WHERE bp.battle_id = battles.id AND bp.user_id = $1
		)
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, query, viewerID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.Battle, 0)
	for rows.Next() {
		item, err := scanBattle(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) GetVisible(ctx context.Context, viewerID, battleID string) (*model.Battle, error) {
	const query = `
		SELECT id, challenger_user_id, opponent_user_id, trust_room_id, live_stream_id, mode, status, title,
		       invitation_message, scheduled_for, accepted_at, started_at, ended_at, round_duration_sec,
		       score_host_a, score_host_b, created_at, updated_at
		FROM battles
		WHERE id = $2
		  AND (
		    challenger_user_id = $1 OR opponent_user_id = $1 OR EXISTS (
		      SELECT 1 FROM battle_participants bp WHERE bp.battle_id = battles.id AND bp.user_id = $1
		    )
		  )
		LIMIT 1`
	return scanBattle(r.db.QueryRow(ctx, query, viewerID, battleID))
}

func (r *Repository) Respond(ctx context.Context, userID, battleID string, accept bool) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	status := "REJECTED"
	if accept {
		status = "ACCEPTED"
	}
	const query = `
		UPDATE battles
		SET status = $3,
		    accepted_at = CASE WHEN $3 = 'ACCEPTED' THEN NOW() ELSE accepted_at END,
		    updated_at = NOW()
		WHERE id = $1 AND opponent_user_id = $2`
	if _, err := tx.Exec(ctx, query, battleID, userID, status); err != nil {
		return err
	}

	if accept {
		const roundQuery = `
			INSERT INTO battle_rounds (id, battle_id, round_number, started_at, score_host_a, score_host_b)
			VALUES ($1, $2, 1, NOW(), 0, 0)
			ON CONFLICT (battle_id, round_number) DO NOTHING`
		if _, err := tx.Exec(ctx, roundQuery, uuid.NewString(), battleID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *Repository) Vote(ctx context.Context, battleID, voterUserID string, req VoteBattleRequest) error {
	weight := req.Weight
	if weight == 0 {
		weight = 1
	}
	const query = `
		INSERT INTO battle_votes (id, battle_id, battle_round_id, voter_user_id, vote, weight)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (battle_id, voter_user_id, battle_round_id)
		DO UPDATE SET vote = EXCLUDED.vote, weight = EXCLUDED.weight`
	_, err := r.db.Exec(ctx, query, uuid.NewString(), battleID, req.BattleRoundID, voterUserID, req.Vote, weight)
	return err
}

func (r *Repository) Participants(ctx context.Context, battleID string) ([]model.BattleParticipant, error) {
	rows, err := r.db.Query(ctx, `
		SELECT battle_id, user_id, side, is_creator, joined_at
		FROM battle_participants
		WHERE battle_id = $1
		ORDER BY joined_at ASC`, battleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.BattleParticipant, 0)
	for rows.Next() {
		var item model.BattleParticipant
		if err := rows.Scan(&item.BattleID, &item.UserID, &item.Side, &item.IsCreator, &item.JoinedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) RoundCount(ctx context.Context, battleID string) (int, error) {
	var count int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM battle_rounds WHERE battle_id = $1`, battleID).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *Repository) upsertParticipant(ctx context.Context, tx pgx.Tx, battleID, userID, side string, isCreator bool) error {
	const query = `
		INSERT INTO battle_participants (battle_id, user_id, side, is_creator, joined_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (battle_id, user_id)
		DO UPDATE SET side = EXCLUDED.side, is_creator = EXCLUDED.is_creator`
	_, err := tx.Exec(ctx, query, battleID, userID, side, isCreator)
	return err
}

func scanBattle(row interface{ Scan(dest ...any) error }) (*model.Battle, error) {
	var item model.Battle
	var mode string
	var status string
	if err := row.Scan(
		&item.ID,
		&item.ChallengerUserID,
		&item.OpponentUserID,
		&item.TrustRoomID,
		&item.LiveStreamID,
		&mode,
		&status,
		&item.Title,
		&item.InvitationMessage,
		&item.ScheduledFor,
		&item.AcceptedAt,
		&item.StartedAt,
		&item.EndedAt,
		&item.RoundDurationSec,
		&item.ScoreHostA,
		&item.ScoreHostB,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	item.Mode = enums.BattleMode(mode)
	item.Status = enums.BattleStatus(status)
	return &item, nil
}

func stringPtr(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
