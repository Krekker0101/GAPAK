package battles

import "time"

type ListQuery struct {
	Page  int `query:"page" validate:"omitempty,min=1,max=10000"`
	Limit int `query:"limit" validate:"omitempty,min=1,max=50"`
}

type CreateBattleRequest struct {
	OpponentUserID    string     `json:"opponentUserId" validate:"required,uuid4"`
	TrustRoomID       *string    `json:"trustRoomId,omitempty" validate:"omitempty,uuid4"`
	LiveStreamID      *string    `json:"liveStreamId,omitempty" validate:"omitempty,uuid4"`
	Mode              string     `json:"mode" validate:"required,oneof=DUEL CREATOR_DUEL ROOM_DUEL"`
	Title             string     `json:"title" validate:"required,min=3,max=120"`
	InvitationMessage *string    `json:"invitationMessage,omitempty" validate:"omitempty,max=300"`
	ScheduledFor      *time.Time `json:"scheduledFor,omitempty"`
	RoundDurationSec  int        `json:"roundDurationSec" validate:"omitempty,min=15,max=1800"`
}

type RespondBattleRequest struct {
	Accept bool `json:"accept"`
}

type VoteBattleRequest struct {
	BattleRoundID *string `json:"battleRoundId,omitempty" validate:"omitempty,uuid4"`
	Vote          string  `json:"vote" validate:"required,oneof=HOST_A HOST_B DRAW"`
	Weight        int     `json:"weight" validate:"omitempty,min=1,max=5"`
}

type BattleParticipantResponse struct {
	UserID    string    `json:"userId"`
	Side      string    `json:"side"`
	IsCreator bool      `json:"isCreator"`
	JoinedAt  time.Time `json:"joinedAt"`
}

type BattleResponse struct {
	ID                string                      `json:"id"`
	ChallengerUserID  string                      `json:"challengerUserId"`
	OpponentUserID    string                      `json:"opponentUserId"`
	TrustRoomID       *string                     `json:"trustRoomId,omitempty"`
	LiveStreamID      *string                     `json:"liveStreamId,omitempty"`
	Mode              string                      `json:"mode"`
	Status            string                      `json:"status"`
	Title             string                      `json:"title"`
	InvitationMessage *string                     `json:"invitationMessage,omitempty"`
	ScheduledFor      *time.Time                  `json:"scheduledFor,omitempty"`
	AcceptedAt        *time.Time                  `json:"acceptedAt,omitempty"`
	StartedAt         *time.Time                  `json:"startedAt,omitempty"`
	EndedAt           *time.Time                  `json:"endedAt,omitempty"`
	RoundDurationSec  int                         `json:"roundDurationSec"`
	ScoreHostA        int                         `json:"scoreHostA"`
	ScoreHostB        int                         `json:"scoreHostB"`
	RoundCount        int                         `json:"roundCount"`
	Participants      []BattleParticipantResponse `json:"participants"`
	CreatedAt         time.Time                   `json:"createdAt"`
}

type AcceptedResponse struct {
	Accepted bool `json:"accepted"`
}
