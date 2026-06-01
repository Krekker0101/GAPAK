package model

import (
	"time"

	"github.com/gapak/backend/internal/domain/enums"
)

type User struct {
	ID                        string
	Email                     *string
	Username                  string
	DisplayName               string
	PasswordHash              string
	Bio                       *string
	AvatarFileID              *string
	StatusMessage             *string
	Role                      enums.UserRole
	AccountStatus             enums.AccountStatus
	AccountType               enums.AccountType
	IsAnonymous               bool
	EmailVerifiedAt           *time.Time
	TwoFactorEnabled          bool
	TwoFactorSecretCiphertext *string
	TwoFactorSecretNonce      *string
	LastSeenAt                *time.Time
	CreatedAt                 time.Time
	UpdatedAt                 time.Time
	DeletedAt                 *time.Time
}

type UserPrivacySettings struct {
	UserID               string
	ProfileVisibility    enums.ProfileVisibility
	LastSeenVisibility   enums.LastSeenVisibility
	AllowFriendRequests  bool
	AllowTrustedInvites  bool
	SearchableByEmail    bool
	SearchableByUsername bool
	PostDefaultPrivacy   enums.PostPrivacy
	ShowOnlineStatus     bool
	CreatedAt            time.Time
	UpdatedAt            time.Time
}

type DeviceSession struct {
	ID                 string
	UserID             string
	RefreshTokenHash   string
	RefreshTokenFamily string
	UserAgent          *string
	DeviceName         *string
	DeviceFingerprint  *string
	IPAddress          *string
	CountryCode        *string
	City               *string
	IsCurrent          bool
	SecurityLevel      enums.SessionSecurityLevel
	LastUsedAt         time.Time
	ExpiresAt          time.Time
	RevokedAt          *time.Time
	CreatedAt          time.Time
}

type PasswordResetToken struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
}

type TwoFactorSetupChallenge struct {
	UserID           string
	SetupSessionID   string
	SecretCiphertext string
	SecretNonce      string
	Attempts         int
	MaxAttempts      int
	ExpiresAt        time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type Post struct {
	ID               string
	AuthorID         string
	ContentType      enums.PostContentType
	Body             string
	Privacy          enums.PostPrivacy
	LikeCount        int
	ExpiresAt        *time.Time
	OneTimeViewLimit *int
	PublishedAt      time.Time
	EditedAt         *time.Time
	DeletedAt        *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type PostAudienceGrant struct {
	ID            string
	PostID        string
	SubjectUserID string
	MaxViews      *int
	UsedViews     int
	ExpiresAt     *time.Time
	CreatedAt     time.Time
}

type DirectChat struct {
	ID            string
	CreatedByID   string
	LastMessageAt *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
	DeletedAt     *time.Time
}

type DirectChatMember struct {
	ChatID     string
	UserID     string
	Role       enums.ChatMemberRole
	JoinedAt   time.Time
	LastReadAt *time.Time
	MutedUntil *time.Time
	DeletedAt  *time.Time
}

type Message struct {
	ID                 string
	ChatID             string
	SenderID           string
	EnvelopeType       enums.MessageEnvelopeType
	Ciphertext         []byte
	Nonce              string
	SenderKeyID        string
	AttachmentManifest []byte
	MetadataJSON       []byte
	ClientMessageID    string
	SentAt             time.Time
	EditedAt           *time.Time
	DeletedAt          *time.Time
}

type MessageMediaAttachment struct {
	ID          string
	MessageID   string
	MediaFileID string
	CreatedAt   time.Time
}

type TrustRoom struct {
	ID                   string
	OwnerID              string
	Name                 string
	Description          *string
	Visibility           enums.TrustRoomVisibility
	AccessMode           enums.TrustRoomAccessMode
	RequireTwoFactor     bool
	MinAccountAgeDays    int
	MessageRetentionDays *int
	CreatedAt            time.Time
	UpdatedAt            time.Time
	DeletedAt            *time.Time
}

type TrustRoomMember struct {
	RoomID          string
	UserID          string
	Role            enums.TrustRoomRole
	InvitedByUserID *string
	TrustedUntil    *time.Time
	JoinedAt        time.Time
	DeletedAt       *time.Time
}

type AuditEvent struct {
	ID             string
	ActorUserID    *string
	ActorSessionID *string
	TargetUserID   *string
	Action         string
	ResourceType   string
	ResourceID     string
	Severity       enums.SecuritySeverity
	IPAddress      *string
	UserAgent      *string
	MetadataJSON   []byte
	CreatedAt      time.Time
}

type SuspiciousActivityFlag struct {
	ID           string
	UserID       string
	SessionID    *string
	Reason       enums.SuspiciousActivityReason
	Severity     enums.SecuritySeverity
	Status       enums.SuspiciousActivityStatus
	MetadataJSON []byte
	CreatedAt    time.Time
	ReviewedAt   *time.Time
}

type DeviceLoginAlert struct {
	ID             string
	UserID         string
	SessionID      string
	Channel        string
	Status         string
	CreatedAt      time.Time
	AcknowledgedAt *time.Time
}

type PresenceConnection struct {
	ConnectionID    string
	UserID          string
	SessionID       string
	State           string
	PagePath        *string
	ConnectedAt     time.Time
	LastHeartbeatAt time.Time
	LastActivityAt  time.Time
	DisconnectedAt  *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type FriendConnection struct {
	ID          string
	RequesterID string
	AddresseeID string
	Status      enums.ConnectionStatus
	AcceptedAt  *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   *time.Time
}

type TrustedCircleMembership struct {
	ID        string
	OwnerID   string
	MemberID  string
	CreatedAt time.Time
}

type MediaFile struct {
	ID              string
	OwnerID         string
	Kind            enums.MediaKind
	StorageProvider enums.StorageProvider
	Bucket          string
	ObjectKey       string
	OriginalName    *string
	MimeType        string
	SizeBytes       int64
	ChecksumSHA256  *string
	Status          enums.MediaStatus
	IsEncrypted     bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DeletedAt       *time.Time
}

type ModerationReport struct {
	ID              string
	ReporterUserID  string
	TargetType      enums.ModerationTargetType
	TargetID        string
	Reason          enums.ModerationReason
	Description     *string
	Status          enums.ModerationStatus
	HandledByUserID *string
	ResolutionNote  *string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type UploadSession struct {
	ID                string
	OwnerID           string
	MediaFileID       string
	Purpose           enums.UploadPurpose
	Status            enums.UploadSessionStatus
	Bucket            string
	ObjectKey         string
	FileName          string
	MimeType          string
	SizeBytes         int64
	PartSizeBytes     int64
	TotalParts        int
	MultipartUploadID *string
	CompletedAt       *time.Time
	AbortedAt         *time.Time
	ExpiresAt         time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type UploadSessionPart struct {
	ID              string
	UploadSessionID string
	PartNumber      int
	ETag            *string
	SizeBytes       int64
	ChecksumSHA256  *string
	UploadedAt      *time.Time
	CreatedAt       time.Time
}

type VideoAsset struct {
	ID                 string
	MediaFileID        string
	Status             enums.VideoAssetStatus
	MasterPlaylistKey  *string
	PreviewPlaylistKey *string
	PosterObjectKey    *string
	DurationMillis     *int
	Width              *int
	Height             *int
	VideoCodec         *string
	AudioCodec         *string
	CreatedAt          time.Time
	UpdatedAt          time.Time
	ReadyAt            *time.Time
	FailedAt           *time.Time
}

type VideoVariant struct {
	ID                string
	VideoAssetID      string
	Label             string
	Status            enums.VideoVariantStatus
	PlaylistObjectKey string
	InitSegmentKey    *string
	SegmentPrefix     *string
	Container         string
	VideoCodec        *string
	AudioCodec        *string
	Width             *int
	Height            *int
	BitrateKbps       *int
	FrameRate         *float64
	DurationMillis    *int
	SizeBytes         *int64
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type MediaThumbnail struct {
	ID          string
	MediaFileID string
	Bucket      string
	ObjectKey   string
	MimeType    string
	Width       int
	Height      int
	SizeBytes   int64
	CreatedAt   time.Time
}

type PlaybackAccessGrant struct {
	ID             string
	MediaFileID    string
	ViewerUserID   string
	GrantTokenHash string
	Reason         string
	Status         enums.PlaybackGrantStatus
	MaxViews       *int
	UsedViews      int
	ExpiresAt      time.Time
	ConsumedAt     *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type ProcessingJob struct {
	ID              string
	QueueName       string
	JobType         enums.ProcessingJobType
	Status          enums.ProcessingJobStatus
	MediaFileID     *string
	UploadSessionID *string
	VideoAssetID    *string
	PayloadJSON     []byte
	Attempts        int
	MaxAttempts     int
	LastError       *string
	ReservedAt      *time.Time
	StartedAt       *time.Time
	FinishedAt      *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type Story struct {
	ID             string
	AuthorID       string
	MediaFileID    string
	VideoAssetID   *string
	TrustRoomID    *string
	Caption        *string
	Privacy        enums.PostPrivacy
	Status         enums.StoryStatus
	AllowReplies   bool
	AllowReactions bool
	HighlightTitle *string
	ExpiresAt      time.Time
	PublishedAt    time.Time
	DeletedAt      *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type StoryAudienceGrant struct {
	ID            string
	StoryID       string
	SubjectUserID string
	MaxViews      *int
	UsedViews     int
	ExpiresAt     *time.Time
	CreatedAt     time.Time
}

type StoryViewer struct {
	StoryID      string
	ViewerUserID string
	ReactionType *enums.StoryReactionType
	ViewedAt     time.Time
	ReactedAt    *time.Time
}

type LiveStream struct {
	ID                  string
	HostUserID          string
	TrustRoomID         *string
	Title               string
	Description         *string
	Visibility          enums.LiveVisibility
	Status              enums.LiveStreamStatus
	ScheduledFor        *time.Time
	StartedAt           *time.Time
	EndedAt             *time.Time
	StreamKeyHash       string
	IngestURL           *string
	PlaybackManifestKey *string
	ReplayMediaFileID   *string
	ViewerCount         int
	AllowReplay         bool
	CreatedAt           time.Time
	UpdatedAt           time.Time
	DeletedAt           *time.Time
}

type LiveParticipant struct {
	StreamID    string
	UserID      string
	Role        enums.LiveParticipantRole
	JoinedAt    time.Time
	LeftAt      *time.Time
	IsMuted     bool
	IsGhostMode bool
}

type LiveChatMessage struct {
	ID        string
	StreamID  string
	SenderID  string
	Body      string
	CreatedAt time.Time
	DeletedAt *time.Time
}

type RealtimeEvent struct {
	ID             string
	Sequence       int64
	Channel        string
	AggregateType  string
	AggregateID    string
	EventType      string
	PayloadJSON    []byte
	RelayStatus    string
	RelayAttempts  int
	LastRelayError *string
	ReservedAt     *time.Time
	RelayedAt      *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type Battle struct {
	ID                string
	ChallengerUserID  string
	OpponentUserID    string
	TrustRoomID       *string
	LiveStreamID      *string
	Mode              enums.BattleMode
	Status            enums.BattleStatus
	Title             string
	InvitationMessage *string
	ScheduledFor      *time.Time
	AcceptedAt        *time.Time
	StartedAt         *time.Time
	EndedAt           *time.Time
	RoundDurationSec  int
	ScoreHostA        int
	ScoreHostB        int
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type BattleParticipant struct {
	BattleID  string
	UserID    string
	Side      string
	IsCreator bool
	JoinedAt  time.Time
}

type BattleRound struct {
	ID          string
	BattleID    string
	RoundNumber int
	StartedAt   *time.Time
	EndedAt     *time.Time
	ScoreHostA  int
	ScoreHostB  int
	CreatedAt   time.Time
}

type BattleVote struct {
	ID            string
	BattleID      string
	BattleRoundID *string
	VoterUserID   string
	Vote          enums.BattleVoteType
	Weight        int
	CreatedAt     time.Time
}

type UserAccountSettings struct {
	UserID                         string
	AccountType                    enums.AccountType
	Bio                            *string
	HeaderImageFileID              *string
	Theme                          string
	AllowCloseFriends              bool
	ShowStoryRing                  bool
	AllowFollowersSeeFollowerCount bool
	ChannelCategory                *string
	ChannelDescription             *string
	ChannelVerificationStatus      string
	ChannelFeaturedPostID          *string
	DisableComments                bool
	DisableSharing                 bool
	AllowDownloads                 bool
	MonetizationEnabled            bool
	CreatedAt                      time.Time
	UpdatedAt                      time.Time
}

type Subscription struct {
	ID               string
	SubscriberID     string
	CreatorID        string
	Status           enums.SubscriptionStatus
	SubscriptionType enums.SubscriptionType
	SubscribedAt     time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type SubscriptionRequest struct {
	ID           string
	SubscriberID string
	CreatorID    string
	Status       enums.SubscriptionStatus
	Message      *string
	RequestedAt  time.Time
	RespondedAt  *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type SubscriptionBlocklist struct {
	ID            string
	UserID        string
	BlockedUserID string
	CreatedAt     time.Time
}

type SubscriptionNotificationPreferences struct {
	SubscriberID  string
	CreatorID     string
	NotifyOnPost  bool
	NotifyOnStory bool
	NotifyOnLive  bool
	NotifyOnClip  bool
	MuteUntil     *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type PostLike struct {
	ID        string
	PostID    string
	UserID    string
	CreatedAt time.Time
}

type Comment struct {
	ID              string
	PostID          string
	AuthorID        string
	ParentCommentID *string
	Content         string
	LikeCount       int
	ReplyCount      int
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DeletedAt       *time.Time
}

type CommentLike struct {
	ID        string
	CommentID string
	UserID    string
	CreatedAt time.Time
}
