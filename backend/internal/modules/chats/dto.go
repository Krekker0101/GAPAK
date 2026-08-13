package chats

import "time"

// ============================================================================
// REQUEST DTOs
// ============================================================================

type CreateChatRequest struct {
	Type               string                 `json:"type" validate:"required,oneof=DIRECT GROUP CHANNEL BROADCAST"`
	Title              string                 `json:"title" validate:"omitempty,max=255"`
	Description        string                 `json:"description" validate:"omitempty,max=1000"`
	AvatarFileID       string                 `json:"avatarFileId" validate:"omitempty,uuid"`
	EncryptionProtocol string                 `json:"encryptionProtocol" validate:"omitempty,oneof=SIGNAL OMEMO TRUSTED_CHAT NONE"`
	TrustedChat        bool                   `json:"trustedChat"`
	MessageTTLSeconds  *int                   `json:"messageTtlSeconds" validate:"omitempty,min=1"`
	ParticipantIDs     []string               `json:"participantIds" validate:"required,min=1,dive,uuid"`
	Metadata           map[string]interface{} `json:"metadata"`
}

type UpdateChatRequest struct {
	Title             string                 `json:"title" validate:"omitempty,max=255"`
	Description       string                 `json:"description" validate:"omitempty,max=1000"`
	AvatarFileID      string                 `json:"avatarFileId" validate:"omitempty,uuid"`
	MessageTTLSeconds *int                   `json:"messageTtlSeconds" validate:"omitempty,min=1"`
	IsMuted           *bool                  `json:"isMuted"`
	IsPinned          *bool                  `json:"isPinned"`
	Metadata          map[string]interface{} `json:"metadata"`
}

type SendMessageRequest struct {
	ClientMessageID     string                      `json:"clientMessageId" validate:"required,min=8,max=128"`
	SenderDeviceID      string                      `json:"senderDeviceId" validate:"required,uuid"`
	Type                string                      `json:"type" validate:"required,oneof=TEXT IMAGE VIDEO AUDIO DOCUMENT VOICE STICKER SYSTEM LOCATION CONTACT"`
	Ciphertext          string                      `json:"ciphertext" validate:"required,min=32,max=50000"`
	Nonce               string                      `json:"nonce" validate:"required,len=24"`
	SenderKeyID         string                      `json:"senderKeyId" validate:"required,min=3,max=255"`
	EncryptionProtocol  string                      `json:"encryptionProtocol" validate:"required,eq=TRUSTED_CHAT"`
	EncryptionAlgorithm string                      `json:"encryptionAlgorithm" validate:"omitempty,max=64"`
	AssociatedData      string                      `json:"associatedData" validate:"omitempty,max=4096"`
	RatchetCounter      *int64                      `json:"ratchetCounter" validate:"omitempty,min=0"`
	AuthenticationTag   string                      `json:"authenticationTag" validate:"required,len=128"`
	Content             string                      `json:"content" validate:"omitempty,max=50000"`
	Metadata            map[string]interface{}      `json:"metadata"`
	ReplyToMessageID    string                      `json:"replyToMessageId" validate:"omitempty,uuid"`
	ForwardedFromID     string                      `json:"forwardedFromId" validate:"omitempty,uuid"`
	ExpiresInSeconds    *int                        `json:"expiresInSeconds" validate:"omitempty,min=1,max=604800"` // Max 7 days
	Attachments         []CreateAttachmentRequest   `json:"attachments"`
	KeyEnvelopes        []MessageKeyEnvelopeRequest `json:"keyEnvelopes" validate:"required,min=1,max=100,dive"`
}

type MessageKeyEnvelopeRequest struct {
	RecipientUserID   string `json:"recipientUserId" validate:"required,uuid"`
	RecipientDeviceID string `json:"recipientDeviceId" validate:"required,uuid"`
	KeyID             string `json:"keyId" validate:"required,min=3,max=255"`
	Algorithm         string `json:"algorithm" validate:"required,max=64"`
	EncryptedKey      string `json:"encryptedKey" validate:"required,min=1,max=8192"`
	Nonce             string `json:"nonce" validate:"omitempty,max=255"`
	KeyVersion        int    `json:"keyVersion" validate:"omitempty,min=1"`
}

type CreateAttachmentRequest struct {
	MediaFileID     string                 `json:"mediaFileId" validate:"required,uuid"`
	Kind            string                 `json:"kind" validate:"required,oneof=IMAGE VIDEO AUDIO DOCUMENT VOICE STICKER LOCATION CONTACT"`
	FileName        string                 `json:"fileName" validate:"omitempty,max=512"`
	MimeType        string                 `json:"mimeType" validate:"omitempty,max=255"`
	SizeBytes       int64                  `json:"sizeBytes" validate:"required,min=1"`
	Width           *int                   `json:"width" validate:"omitempty,min=1"`
	Height          *int                   `json:"height" validate:"omitempty,min=1"`
	DurationSeconds *int                   `json:"durationSeconds" validate:"omitempty,min=1"`
	ThumbnailFileID string                 `json:"thumbnailFileId" validate:"omitempty,uuid"`
	Metadata        map[string]interface{} `json:"metadata"`
}

type EditMessageRequest struct {
	Ciphertext          string                      `json:"ciphertext" validate:"required,min=32,max=50000"`
	Nonce               string                      `json:"nonce" validate:"required,len=24"`
	Content             string                      `json:"content" validate:"omitempty,max=50000"`
	Metadata            map[string]interface{}      `json:"metadata"`
	EncryptionProtocol  string                      `json:"encryptionProtocol" validate:"omitempty,eq=TRUSTED_CHAT"`
	EncryptionAlgorithm string                      `json:"encryptionAlgorithm" validate:"omitempty"`
	AssociatedData      string                      `json:"associatedData" validate:"omitempty,max=4096"`
	RatchetCounter      *int64                      `json:"ratchetCounter" validate:"omitempty,min=0"`
	AuthenticationTag   string                      `json:"authenticationTag" validate:"required,len=128"`
	KeyEnvelopes        []MessageKeyEnvelopeRequest `json:"keyEnvelopes" validate:"omitempty,max=100,dive"`
}

type RegisterTrustedDeviceRequest struct {
	DeviceName        string `json:"deviceName" validate:"omitempty,max=120"`
	IdentityKeyPublic string `json:"identityKeyPublic" validate:"required,min=32,max=4096"`
	SigningKeyPublic  string `json:"signingKeyPublic" validate:"omitempty,max=4096"`
}

type PublishPreKeyRequest struct {
	KeyID     string     `json:"keyId" validate:"required,min=3,max=255"`
	PublicKey string     `json:"publicKey" validate:"required,min=32,max=4096"`
	Signature string     `json:"signature" validate:"omitempty,max=4096"`
	OneTime   bool       `json:"oneTime"`
	ExpiresAt *time.Time `json:"expiresAt"`
}

type PreKeyBundleQuery struct {
	UserID string `query:"userId" validate:"required,uuid"`
}

type DeleteMessageRequest struct {
	DeleteForEveryone bool `json:"deleteForEveryone"`
}

type AddReactionRequest struct {
	ReactionType string `json:"reactionType" validate:"required,oneof=LIKE LOVE LAUGH SURPRISE SAD ANGRY FIRE THUMBS_UP THUMBS_DOWN"`
}

type RemoveReactionRequest struct {
	ReactionType string `json:"reactionType" validate:"required,oneof=LIKE LOVE LAUGH SURPRISE SAD ANGRY FIRE THUMBS_UP THUMBS_DOWN"`
}

type MarkAsReadRequest struct {
	MessageID string `json:"messageId" validate:"required,uuid"`
}

type PinMessageRequest struct {
	MessageID string `json:"messageId" validate:"required,uuid"`
}

type UnpinMessageRequest struct {
	MessageID string `json:"messageId" validate:"required,uuid"`
}

type SetTypingStatusRequest struct {
	Status string `json:"status" validate:"required,oneof=TYPING STOPPED"`
}

type UpdateChatMemberRequest struct {
	Role     string `json:"role" validate:"omitempty,oneof=OWNER ADMIN MODERATOR MEMBER"`
	Nickname string `json:"nickname" validate:"omitempty,max=100"`
	IsMuted  *bool  `json:"isMuted"`
}

type UpdateChatSettingsRequest struct {
	NotificationLevel string                 `json:"notificationLevel" validate:"omitempty,oneof=ALL MENTIONS NONE"`
	Theme             string                 `json:"theme" validate:"omitempty,max=20"`
	CustomSettings    map[string]interface{} `json:"customSettings"`
}

// ============================================================================
// QUERY DTOs
// ============================================================================

type ListChatsQuery struct {
	Type       string `query:"type" validate:"omitempty,oneof=DIRECT GROUP CHANNEL BROADCAST"`
	Limit      int    `query:"limit" validate:"omitempty,min=1,max=100"`
	Offset     int    `query:"offset" validate:"omitempty,min=0"`
	UnreadOnly bool   `query:"unreadOnly"`
	PinnedOnly bool   `query:"pinnedOnly"`
}

type ListMessagesQuery struct {
	Cursor          string `query:"cursor"`   // ISO 8601 timestamp
	CursorID        string `query:"cursorId"` // Message ID for tie-breaking
	Limit           int    `query:"limit" validate:"omitempty,min=1,max=100"`
	Before          bool   `query:"before"` // true = get messages before cursor (newer), false = after cursor (older)
	WithReplies     bool   `query:"withReplies"`
	WithAttachments bool   `query:"withAttachments"`
}

type ListReactionsQuery struct {
	MessageID string `query:"messageId" validate:"required,uuid"`
	Type      string `query:"type" validate:"omitempty,oneof=LIKE LOVE LAUGH SURPRISE SAD ANGRY FIRE THUMBS_UP THUMBS_DOWN"`
	Limit     int    `query:"limit" validate:"omitempty,min=1,max=100"`
}

type ListMembersQuery struct {
	Role   string `query:"role" validate:"omitempty,oneof=OWNER ADMIN MODERATOR MEMBER"`
	Limit  int    `query:"limit" validate:"omitempty,min=1,max=100"`
	Offset int    `query:"offset" validate:"omitempty,min=0"`
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

type ChatResponse struct {
	ID                 string                  `json:"id"`
	Type               string                  `json:"type"`
	Title              *string                 `json:"title,omitempty"`
	Description        *string                 `json:"description,omitempty"`
	AvatarFileID       *string                 `json:"avatarFileId,omitempty"`
	CreatedByID        string                  `json:"createdById"`
	EncryptionProtocol string                  `json:"encryptionProtocol"`
	MessageTTLSeconds  *int                    `json:"messageTtlSeconds,omitempty"`
	IsMuted            bool                    `json:"isMuted"`
	IsPinned           bool                    `json:"isPinned"`
	LastMessage        *MessagePreviewResponse `json:"lastMessage,omitempty"`
	LastMessageAt      *time.Time              `json:"lastMessageAt,omitempty"`
	LastSequenceNumber int64                   `json:"lastSequenceNumber"`
	MemberCount        int                     `json:"memberCount"`
	UnreadCount        int64                   `json:"unreadCount"`
	CreatedAt          time.Time               `json:"createdAt"`
	UpdatedAt          time.Time               `json:"updatedAt"`
}

type MessagePreviewResponse struct {
	ID            string    `json:"id"`
	SenderID      string    `json:"senderId"`
	Type          string    `json:"type"`
	Status        string    `json:"status"`
	Content       *string   `json:"content,omitempty"`
	SentAt        time.Time `json:"sentAt"`
	HasAttachment bool      `json:"hasAttachment"`
}

type ChatMemberResponse struct {
	ID                string     `json:"id"`
	ChatID            string     `json:"chatId"`
	UserID            string     `json:"userId"`
	Role              string     `json:"role"`
	Nickname          *string    `json:"nickname,omitempty"`
	JoinedAt          time.Time  `json:"joinedAt"`
	LeftAt            *time.Time `json:"leftAt,omitempty"`
	IsMuted           bool       `json:"isMuted"`
	MuteUntil         *time.Time `json:"muteUntil,omitempty"`
	LastReadMessageID *string    `json:"lastReadMessageId,omitempty"`
	LastReadAt        *time.Time `json:"lastReadAt,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

type MessageResponse struct {
	ID                   string                       `json:"id"`
	ChatID               string                       `json:"chatId"`
	SenderID             string                       `json:"senderId"`
	ClientMessageID      string                       `json:"clientMessageId,omitempty"`
	SenderDeviceID       *string                      `json:"senderDeviceId,omitempty"`
	SequenceNumber       int64                        `json:"sequenceNumber"`
	Type                 string                       `json:"type"`
	Status               string                       `json:"status"`
	Ciphertext           string                       `json:"ciphertext"`
	Nonce                string                       `json:"nonce"`
	SenderKeyID          string                       `json:"senderKeyId"`
	EncryptionProtocol   string                       `json:"encryptionProtocol"`
	EncryptionAlgorithm  string                       `json:"encryptionAlgorithm,omitempty"`
	AssociatedData       *string                      `json:"associatedData,omitempty"`
	RatchetCounter       *int64                       `json:"ratchetCounter,omitempty"`
	AuthenticationTag    *string                      `json:"authenticationTag,omitempty"`
	Content              *string                      `json:"content,omitempty"`
	KeyEnvelopes         []MessageKeyEnvelopeResponse `json:"keyEnvelopes,omitempty"`
	Metadata             map[string]interface{}       `json:"metadata,omitempty"`
	ReplyToMessage       *MessageResponse             `json:"replyToMessage,omitempty"`
	ForwardedFromMessage *MessageResponse             `json:"forwardedFromMessage,omitempty"`
	ForwardedFromChatID  *string                      `json:"forwardedFromChatId,omitempty"`
	ExpiresAt            *time.Time                   `json:"expiresAt,omitempty"`
	SentAt               time.Time                    `json:"sentAt"`
	EditedAt             *time.Time                   `json:"editedAt,omitempty"`
	DeletedAt            *time.Time                   `json:"deletedAt,omitempty"`
	DeletedByID          *string                      `json:"deletedById,omitempty"`
	CreatedAt            time.Time                    `json:"createdAt"`
	UpdatedAt            time.Time                    `json:"updatedAt"`
	Attachments          []AttachmentResponse         `json:"attachments,omitempty"`
	Reactions            []ReactionResponse           `json:"reactions,omitempty"`
	ReadReceipts         []ReadReceiptResponse        `json:"readReceipts,omitempty"`
	DeliveryReceipts     []DeliveryReceiptResponse    `json:"deliveryReceipts,omitempty"`
	IsPinned             bool                         `json:"isPinned"`
	VersionCount         int                          `json:"versionCount"`
}

type MessageKeyEnvelopeResponse struct {
	ID                string    `json:"id"`
	MessageID         string    `json:"messageId"`
	RecipientUserID   string    `json:"recipientUserId"`
	RecipientDeviceID string    `json:"recipientDeviceId"`
	SenderDeviceID    string    `json:"senderDeviceId"`
	KeyID             string    `json:"keyId"`
	Algorithm         string    `json:"algorithm"`
	EncryptedKey      string    `json:"encryptedKey"`
	Nonce             *string   `json:"nonce,omitempty"`
	KeyVersion        int       `json:"keyVersion"`
	CreatedAt         time.Time `json:"createdAt"`
}

type TrustedDeviceResponse struct {
	ID                string     `json:"id"`
	UserID            string     `json:"userId"`
	DeviceName        *string    `json:"deviceName,omitempty"`
	IdentityKeyPublic string     `json:"identityKeyPublic"`
	SigningKeyPublic  *string    `json:"signingKeyPublic,omitempty"`
	Fingerprint       string     `json:"fingerprint"`
	TrustStatus       string     `json:"trustStatus"`
	CreatedAt         time.Time  `json:"createdAt"`
	LastSeenAt        *time.Time `json:"lastSeenAt,omitempty"`
	RevokedAt         *time.Time `json:"revokedAt,omitempty"`
}

type PreKeyBundleResponse struct {
	UserID        string                `json:"userId"`
	Device        TrustedDeviceResponse `json:"device"`
	SignedPreKey  *DevicePreKeyResponse `json:"signedPreKey,omitempty"`
	OneTimePreKey *DevicePreKeyResponse `json:"oneTimePreKey,omitempty"`
}

type DevicePreKeyResponse struct {
	ID        string     `json:"id"`
	DeviceID  string     `json:"deviceId"`
	UserID    string     `json:"userId"`
	KeyID     string     `json:"keyId"`
	PublicKey string     `json:"publicKey"`
	Signature *string    `json:"signature,omitempty"`
	OneTime   bool       `json:"oneTime"`
	UsedAt    *time.Time `json:"usedAt,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

type AttachmentResponse struct {
	ID              string                 `json:"id"`
	MessageID       string                 `json:"messageId"`
	MediaFileID     string                 `json:"mediaFileId"`
	Kind            string                 `json:"kind"`
	FileName        *string                `json:"fileName,omitempty"`
	MimeType        *string                `json:"mimeType,omitempty"`
	SizeBytes       int64                  `json:"sizeBytes"`
	Width           *int                   `json:"width,omitempty"`
	Height          *int                   `json:"height,omitempty"`
	DurationSeconds *int                   `json:"durationSeconds,omitempty"`
	ThumbnailFileID *string                `json:"thumbnailFileId,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt       time.Time              `json:"createdAt"`
}

type ReactionResponse struct {
	ID           string    `json:"id"`
	MessageID    string    `json:"messageId"`
	UserID       string    `json:"userId"`
	ReactionType string    `json:"reactionType"`
	CreatedAt    time.Time `json:"createdAt"`
}

type ReadReceiptResponse struct {
	ID        string    `json:"id"`
	MessageID string    `json:"messageId"`
	UserID    string    `json:"userId"`
	ReadAt    time.Time `json:"readAt"`
}

type DeliveryReceiptResponse struct {
	ID          string    `json:"id"`
	MessageID   string    `json:"messageId"`
	UserID      string    `json:"userId"`
	DeliveredAt time.Time `json:"deliveredAt"`
}

type MessageVersionResponse struct {
	ID            string                 `json:"id"`
	MessageID     string                 `json:"messageId"`
	VersionNumber int                    `json:"versionNumber"`
	Ciphertext    string                 `json:"ciphertext"`
	Nonce         string                 `json:"nonce"`
	Content       *string                `json:"content,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	EditedAt      time.Time              `json:"editedAt"`
	EditedByID    string                 `json:"editedById"`
}

type TypingSessionResponse struct {
	ID        string    `json:"id"`
	ChatID    string    `json:"chatId"`
	UserID    string    `json:"userId"`
	Status    string    `json:"status"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

type ChatSettingsResponse struct {
	ID                string                 `json:"id"`
	ChatID            string                 `json:"chatId"`
	UserID            string                 `json:"userId"`
	NotificationLevel string                 `json:"notificationLevel"`
	Theme             *string                `json:"theme,omitempty"`
	CustomSettings    map[string]interface{} `json:"customSettings,omitempty"`
	CreatedAt         time.Time              `json:"createdAt"`
	UpdatedAt         time.Time              `json:"updatedAt"`
}

type CursorPaginationResponse struct {
	NextCursor     *string `json:"nextCursor,omitempty"`
	NextCursorID   *string `json:"nextCursorId,omitempty"`
	PreviousCursor *string `json:"previousCursor,omitempty"`
	HasMore        bool    `json:"hasMore"`
	TotalCount     *int64  `json:"totalCount,omitempty"`
}

// ============================================================================
// WEBSOCKET EVENT DTOs
// ============================================================================

type WebSocketMessage struct {
	Event   string                 `json:"event"` // message.sent, message.edited, message.deleted, reaction.added, reaction.removed, typing.started, typing.stopped, member.joined, member.left, chat.updated
	Payload map[string]interface{} `json:"payload"`
	ChatID  string                 `json:"chatId,omitempty"`
	UserID  string                 `json:"userId,omitempty"`
}

type MessageSentEvent struct {
	Message MessageResponse `json:"message"`
	ChatID  string          `json:"chatId"`
}

type MessageEditedEvent struct {
	Message    MessageResponse `json:"message"`
	ChatID     string          `json:"chatId"`
	OldContent *string         `json:"oldContent,omitempty"`
}

type MessageDeletedEvent struct {
	MessageID         string    `json:"messageId"`
	ChatID            string    `json:"chatId"`
	DeletedBy         string    `json:"deletedBy"`
	DeletedAt         time.Time `json:"deletedAt"`
	DeleteForEveryone bool      `json:"deleteForEveryone"`
}

type ReactionAddedEvent struct {
	MessageID    string    `json:"messageId"`
	ChatID       string    `json:"chatId"`
	UserID       string    `json:"userId"`
	ReactionType string    `json:"reactionType"`
	CreatedAt    time.Time `json:"createdAt"`
}

type ReactionRemovedEvent struct {
	MessageID    string `json:"messageId"`
	ChatID       string `json:"chatId"`
	UserID       string `json:"userId"`
	ReactionType string `json:"reactionType"`
}

type TypingStartedEvent struct {
	ChatID    string    `json:"chatId"`
	UserID    string    `json:"userId"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type TypingStoppedEvent struct {
	ChatID string `json:"chatId"`
	UserID string `json:"userId"`
}

type MemberJoinedEvent struct {
	ChatID   string    `json:"chatId"`
	UserID   string    `json:"userId"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joinedAt"`
}

type MemberLeftEvent struct {
	ChatID string    `json:"chatId"`
	UserID string    `json:"userId"`
	LeftAt time.Time `json:"leftAt"`
}

type ChatUpdatedEvent struct {
	ChatID    string       `json:"chatId"`
	Changes   ChatResponse `json:"changes"`
	UpdatedAt time.Time    `json:"updatedAt"`
}

type ReadReceiptEvent struct {
	MessageID string    `json:"messageId"`
	ChatID    string    `json:"chatId"`
	UserID    string    `json:"userId"`
	ReadAt    time.Time `json:"readAt"`
}

type DeliveryReceiptEvent struct {
	MessageID   string    `json:"messageId"`
	ChatID      string    `json:"chatId"`
	UserID      string    `json:"userId"`
	DeliveredAt time.Time `json:"deliveredAt"`
}

type PinnedMessage struct {
	ID         string    `json:"id"`
	ChatID     string    `json:"chatId"`
	MessageID  string    `json:"messageId"`
	PinnedByID string    `json:"pinnedById"`
	PinnedAt   time.Time `json:"pinnedAt"`
}
