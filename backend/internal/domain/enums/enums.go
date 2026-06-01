package enums

type UserRole string
type AccountStatus string
type AccountType string
type PostContentType string
type ProfileVisibility string
type LastSeenVisibility string
type PostPrivacy string
type ConnectionStatus string
type ChatMemberRole string
type MessageEnvelopeType string
type TrustRoomVisibility string
type TrustRoomAccessMode string
type TrustRoomRole string
type SessionSecurityLevel string
type SecuritySeverity string
type SuspiciousActivityReason string
type SuspiciousActivityStatus string
type MediaStatus string
type MediaKind string
type UploadSessionStatus string
type UploadPurpose string
type VideoAssetStatus string
type VideoVariantStatus string
type PlaybackGrantStatus string
type StoryStatus string
type StoryReactionType string
type LiveStreamStatus string
type LiveParticipantRole string
type LiveVisibility string
type BattleStatus string
type BattleMode string
type BattleVoteType string
type ProcessingJobType string
type ProcessingJobStatus string
type StorageProvider string
type ModerationTargetType string
type ModerationReason string
type ModerationStatus string
type SubscriptionType string
type SubscriptionStatus string

const (
	RoleUser            UserRole = "USER"
	RoleModerator       UserRole = "MODERATOR"
	RoleAdmin           UserRole = "ADMIN"
	RoleSecurityAnalyst UserRole = "SECURITY_ANALYST"
)

const (
	AccountStatusActive    AccountStatus = "ACTIVE"
	AccountStatusSuspended AccountStatus = "SUSPENDED"
	AccountStatusDeleted   AccountStatus = "DELETED"
)

const (
	AccountTypePersonal AccountType = "PERSONAL"
	AccountTypeChannel  AccountType = "CHANNEL"
)

const (
	PostContentTypePost PostContentType = "POST"
	PostContentTypeClip PostContentType = "CLIP"
)

const (
	ProfileVisibilityPublic      ProfileVisibility = "PUBLIC"
	ProfileVisibilityConnections ProfileVisibility = "CONNECTIONS"
	ProfileVisibilityTrustedOnly ProfileVisibility = "TRUSTED_ONLY"
	ProfileVisibilityPrivate     ProfileVisibility = "PRIVATE"
)

const (
	LastSeenEveryone    LastSeenVisibility = "EVERYONE"
	LastSeenConnections LastSeenVisibility = "CONNECTIONS"
	LastSeenNobody      LastSeenVisibility = "NOBODY"
)

const (
	PostPrivacyPublic        PostPrivacy = "PUBLIC"
	PostPrivacyFriends       PostPrivacy = "FRIENDS"
	PostPrivacyTrustedCircle PostPrivacy = "TRUSTED_CIRCLE"
	PostPrivacyPrivate       PostPrivacy = "PRIVATE"
	PostPrivacyOneTime       PostPrivacy = "ONE_TIME"
	PostPrivacyTimed         PostPrivacy = "TIMED"
)

const (
	ConnectionPending  ConnectionStatus = "PENDING"
	ConnectionAccepted ConnectionStatus = "ACCEPTED"
	ConnectionBlocked  ConnectionStatus = "BLOCKED"
	ConnectionDeclined ConnectionStatus = "DECLINED"
)

const (
	ChatRoleOwner  ChatMemberRole = "OWNER"
	ChatRoleMember ChatMemberRole = "MEMBER"
)

const (
	MessageEnvelopeText        MessageEnvelopeType = "TEXT"
	MessageEnvelopeAttachment  MessageEnvelopeType = "ATTACHMENT"
	MessageEnvelopeKeyExchange MessageEnvelopeType = "KEY_EXCHANGE"
	MessageEnvelopeSystem      MessageEnvelopeType = "SYSTEM"
)

const (
	TrustRoomVisibilitySecret  TrustRoomVisibility = "SECRET"
	TrustRoomVisibilityPrivate TrustRoomVisibility = "PRIVATE"
)

const (
	TrustRoomInviteOnly TrustRoomAccessMode = "INVITE_ONLY"
	TrustRoomRequest    TrustRoomAccessMode = "REQUEST"
	TrustRoomOwnerOnly  TrustRoomAccessMode = "OWNER_APPROVAL"
)

const (
	TrustRoleOwner     TrustRoomRole = "OWNER"
	TrustRoleAdmin     TrustRoomRole = "ADMIN"
	TrustRoleModerator TrustRoomRole = "MODERATOR"
	TrustRoleMember    TrustRoomRole = "MEMBER"
	TrustRoleAuditor   TrustRoomRole = "AUDITOR"
)

const (
	SessionSecurityUnknown SessionSecurityLevel = "UNKNOWN"
	SessionSecurityTrusted SessionSecurityLevel = "TRUSTED"
	SessionSecurityRisky   SessionSecurityLevel = "RISKY"
)

const (
	SecurityInfo     SecuritySeverity = "INFO"
	SecurityWarning  SecuritySeverity = "WARNING"
	SecurityCritical SecuritySeverity = "CRITICAL"
)

const (
	SuspiciousReasonImpossibleTravel SuspiciousActivityReason = "IMPOSSIBLE_TRAVEL"
	SuspiciousReasonTorAccess        SuspiciousActivityReason = "TOR_ACCESS"
	SuspiciousReasonBruteforce       SuspiciousActivityReason = "BRUTE_FORCE"
	SuspiciousReasonNewDevice        SuspiciousActivityReason = "NEW_DEVICE"
)

const (
	SuspiciousStatusOpen     SuspiciousActivityStatus = "OPEN"
	SuspiciousStatusReviewed SuspiciousActivityStatus = "REVIEWED"
	SuspiciousStatusResolved SuspiciousActivityStatus = "RESOLVED"
)

const (
	MediaPending     MediaStatus = "PENDING"
	MediaReady       MediaStatus = "READY"
	MediaFailed      MediaStatus = "FAILED"
	MediaQuarantined MediaStatus = "QUARANTINED"
	MediaDeleted     MediaStatus = "DELETED"
)

const (
	MediaKindImage      MediaKind = "IMAGE"
	MediaKindVideo      MediaKind = "VIDEO"
	MediaKindAudio      MediaKind = "AUDIO"
	MediaKindDocument   MediaKind = "DOCUMENT"
	MediaKindThumbnail  MediaKind = "THUMBNAIL"
	MediaKindLiveReplay MediaKind = "LIVE_REPLAY"
	MediaKindStoryAsset MediaKind = "STORY_ASSET"
)

const (
	UploadSessionInitiated UploadSessionStatus = "INITIATED"
	UploadSessionPartial   UploadSessionStatus = "PARTIAL"
	UploadSessionCompleted UploadSessionStatus = "COMPLETED"
	UploadSessionAborted   UploadSessionStatus = "ABORTED"
	UploadSessionExpired   UploadSessionStatus = "EXPIRED"
)

const (
	UploadPurposePostAttachment UploadPurpose = "POST_ATTACHMENT"
	UploadPurposeChatAttachment UploadPurpose = "CHAT_ATTACHMENT"
	UploadPurposeClip           UploadPurpose = "CLIP"
	UploadPurposeStory          UploadPurpose = "STORY"
	UploadPurposeProfile        UploadPurpose = "PROFILE"
	UploadPurposeTrustRoom      UploadPurpose = "TRUST_ROOM"
	UploadPurposeLiveReplay     UploadPurpose = "LIVE_REPLAY"
)

const (
	VideoAssetQueued     VideoAssetStatus = "QUEUED"
	VideoAssetProcessing VideoAssetStatus = "PROCESSING"
	VideoAssetReady      VideoAssetStatus = "READY"
	VideoAssetFailed     VideoAssetStatus = "FAILED"
)

const (
	VideoVariantQueued     VideoVariantStatus = "QUEUED"
	VideoVariantProcessing VideoVariantStatus = "PROCESSING"
	VideoVariantReady      VideoVariantStatus = "READY"
	VideoVariantFailed     VideoVariantStatus = "FAILED"
)

const (
	PlaybackGrantActive   PlaybackGrantStatus = "ACTIVE"
	PlaybackGrantConsumed PlaybackGrantStatus = "CONSUMED"
	PlaybackGrantExpired  PlaybackGrantStatus = "EXPIRED"
	PlaybackGrantRevoked  PlaybackGrantStatus = "REVOKED"
)

const (
	StoryStatusActive      StoryStatus = "ACTIVE"
	StoryStatusExpired     StoryStatus = "EXPIRED"
	StoryStatusArchived    StoryStatus = "ARCHIVED"
	StoryStatusHighlighted StoryStatus = "HIGHLIGHTED"
)

const (
	StoryReactionLike    StoryReactionType = "LIKE"
	StoryReactionFire    StoryReactionType = "FIRE"
	StoryReactionSupport StoryReactionType = "SUPPORT"
)

const (
	LiveStatusScheduled LiveStreamStatus = "SCHEDULED"
	LiveStatusLive      LiveStreamStatus = "LIVE"
	LiveStatusEnded     LiveStreamStatus = "ENDED"
	LiveStatusCancelled LiveStreamStatus = "CANCELLED"
)

const (
	LiveRoleHost      LiveParticipantRole = "HOST"
	LiveRoleCoHost    LiveParticipantRole = "CO_HOST"
	LiveRoleGuest     LiveParticipantRole = "GUEST"
	LiveRoleModerator LiveParticipantRole = "MODERATOR"
	LiveRoleViewer    LiveParticipantRole = "VIEWER"
)

const (
	LiveVisibilityPublic        LiveVisibility = "PUBLIC"
	LiveVisibilityFriends       LiveVisibility = "FRIENDS"
	LiveVisibilityTrustedCircle LiveVisibility = "TRUSTED_CIRCLE"
	LiveVisibilityPrivate       LiveVisibility = "PRIVATE"
	LiveVisibilityTrustRoom     LiveVisibility = "TRUST_ROOM"
)

const (
	BattleStatusInvited  BattleStatus = "INVITED"
	BattleStatusAccepted BattleStatus = "ACCEPTED"
	BattleStatusRejected BattleStatus = "REJECTED"
	BattleStatusLive     BattleStatus = "LIVE"
	BattleStatusEnded    BattleStatus = "ENDED"
	BattleStatusCanceled BattleStatus = "CANCELLED"
)

const (
	BattleModeDuel        BattleMode = "DUEL"
	BattleModeCreatorDuel BattleMode = "CREATOR_DUEL"
	BattleModeRoomDuel    BattleMode = "ROOM_DUEL"
)

const (
	BattleVoteHostA BattleVoteType = "HOST_A"
	BattleVoteHostB BattleVoteType = "HOST_B"
	BattleVoteDraw  BattleVoteType = "DRAW"
)

const (
	ProcessingJobMediaAnalyze       ProcessingJobType = "MEDIA_ANALYZE"
	ProcessingJobVideoTranscode     ProcessingJobType = "VIDEO_TRANSCODE"
	ProcessingJobThumbnailGenerate  ProcessingJobType = "THUMBNAIL_GENERATE"
	ProcessingJobStoryOptimize      ProcessingJobType = "STORY_OPTIMIZE"
	ProcessingJobLiveReplayFinalize ProcessingJobType = "LIVE_REPLAY_FINALIZE"
	ProcessingJobCleanupOrphans     ProcessingJobType = "CLEANUP_ORPHANS"
)

const (
	ProcessingJobPending   ProcessingJobStatus = "PENDING"
	ProcessingJobReserved  ProcessingJobStatus = "RESERVED"
	ProcessingJobRunning   ProcessingJobStatus = "RUNNING"
	ProcessingJobSucceeded ProcessingJobStatus = "SUCCEEDED"
	ProcessingJobFailed    ProcessingJobStatus = "FAILED"
	ProcessingJobDead      ProcessingJobStatus = "DEAD"
)

const (
	StorageProviderS3    StorageProvider = "S3"
	StorageProviderMinio StorageProvider = "MINIO"
	StorageProviderLocal StorageProvider = "LOCAL"
)

const (
	ModerationTargetUser  ModerationTargetType = "USER"
	ModerationTargetPost  ModerationTargetType = "POST"
	ModerationTargetRoom  ModerationTargetType = "TRUST_ROOM"
	ModerationTargetMedia ModerationTargetType = "MEDIA"
)

const (
	ModerationReasonHarassment ModerationReason = "HARASSMENT"
	ModerationReasonSpam       ModerationReason = "SPAM"
	ModerationReasonIllegal    ModerationReason = "ILLEGAL_CONTENT"
	ModerationReasonImperson   ModerationReason = "IMPERSONATION"
)

const (
	ModerationStatusOpen      ModerationStatus = "OPEN"
	ModerationStatusReviewing ModerationStatus = "IN_REVIEW"
	ModerationStatusResolved  ModerationStatus = "RESOLVED"
	ModerationStatusDismissed ModerationStatus = "DISMISSED"
)

const (
	SubscriptionTypeVisible SubscriptionType = "VISIBLE"
	SubscriptionTypeSilent  SubscriptionType = "SILENT"
)

const (
	SubscriptionStatusPending SubscriptionStatus = "PENDING"
	SubscriptionStatusActive  SubscriptionStatus = "ACTIVE"
	SubscriptionStatusBlocked SubscriptionStatus = "BLOCKED"
)

const (
	PermissionAdminDashboardRead   = "admin:dashboard:read"
	PermissionAdminUsersRead       = "admin:users:read"
	PermissionAdminUsersWrite      = "admin:users:write"
	PermissionAdminContentRead     = "admin:content:read"
	PermissionAdminContentWrite    = "admin:content:write"
	PermissionAdminModerationRead  = "admin:moderation:read"
	PermissionAdminModerationWrite = "admin:moderation:write"
	PermissionSecurityEventsRead   = "security:events:read"
	PermissionSecuritySessionsRead = "security:sessions:read"
	PermissionSecurityPanicExecute = "security:panic:execute"
)

var RolePermissions = map[string][]string{
	string(RoleUser): {},
	string(RoleModerator): {
		PermissionAdminModerationRead,
	},
	string(RoleAdmin): {
		PermissionAdminDashboardRead,
		PermissionAdminUsersRead,
		PermissionAdminUsersWrite,
		PermissionAdminContentRead,
		PermissionAdminContentWrite,
		PermissionAdminModerationRead,
		PermissionAdminModerationWrite,
		PermissionSecurityEventsRead,
		PermissionSecuritySessionsRead,
		PermissionSecurityPanicExecute,
	},
	string(RoleSecurityAnalyst): {
		PermissionSecurityEventsRead,
		PermissionSecuritySessionsRead,
		PermissionSecurityPanicExecute,
	},
}
