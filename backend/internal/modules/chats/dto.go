package chats

import "time"

type CreateDirectChatRequest struct {
	ParticipantUserID string `json:"participantUserId" validate:"required,uuid4"`
}

type SendMessageRequest struct {
	ClientMessageID    string         `json:"clientMessageId" validate:"required,min=8,max=128"`
	EnvelopeType       string         `json:"envelopeType" validate:"required,oneof=TEXT ATTACHMENT KEY_EXCHANGE SYSTEM"`
	Ciphertext         string         `json:"ciphertext" validate:"required,min=1,max=50000"`
	Nonce              string         `json:"nonce" validate:"required,min=8,max=255"`
	SenderKeyID        string         `json:"senderKeyId" validate:"required,min=3,max=255"`
	AttachmentManifest map[string]any `json:"attachmentManifest"`
	Metadata           map[string]any `json:"metadata"`
}

type MessagesQuery struct {
	Page  int `query:"page" validate:"omitempty,min=1"`
	Limit int `query:"limit" validate:"omitempty,min=1,max=100"`
}

type EventsQuery struct {
	After int64 `query:"after" validate:"omitempty,min=0"`
	Limit int   `query:"limit" validate:"omitempty,min=1,max=100"`
}

type ChatResponse struct {
	ID             string     `json:"id"`
	ParticipantIDs []string   `json:"participantIds"`
	LastMessageAt  *time.Time `json:"lastMessageAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}

type MessageAttachmentResponse struct {
	MediaFileID  string  `json:"mediaFileId"`
	Kind         string  `json:"kind"`
	Status       string  `json:"status"`
	OriginalName *string `json:"originalName,omitempty"`
	MimeType     string  `json:"mimeType"`
	SizeBytes    int64   `json:"sizeBytes"`
}

type MessageResponse struct {
	ID                 string                      `json:"id"`
	ChatID             string                      `json:"chatId"`
	SenderID           string                      `json:"senderId"`
	EnvelopeType       string                      `json:"envelopeType"`
	Ciphertext         string                      `json:"ciphertext"`
	Nonce              string                      `json:"nonce"`
	SenderKeyID        string                      `json:"senderKeyId"`
	AttachmentManifest map[string]any              `json:"attachmentManifest,omitempty"`
	Attachments        []MessageAttachmentResponse `json:"attachments,omitempty"`
	Metadata           map[string]any              `json:"metadata,omitempty"`
	ClientMessageID    string                      `json:"clientMessageId"`
	SentAt             time.Time                   `json:"sentAt"`
	EditedAt           *time.Time                  `json:"editedAt,omitempty"`
}

type ChatEventResponse struct {
	ID        string         `json:"id"`
	Sequence  int64          `json:"sequence"`
	Channel   string         `json:"channel"`
	ChatID    string         `json:"chatId"`
	EventType string         `json:"eventType"`
	Payload   map[string]any `json:"payload"`
	CreatedAt time.Time      `json:"createdAt"`
	RelayedAt *time.Time     `json:"relayedAt,omitempty"`
}
