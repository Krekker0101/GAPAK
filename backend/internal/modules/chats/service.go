package chats

import (
	"context"
	"encoding/json"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateDirect(ctx context.Context, userID string, req CreateDirectChatRequest) (ChatResponse, error) {
	if userID == req.ParticipantUserID {
		return ChatResponse{}, apperrors.New(400, "chats.self_chat_forbidden", "You cannot create a direct chat with yourself")
	}
	chat, err := s.repo.EnsureDirectChat(ctx, userID, req.ParticipantUserID)
	if err != nil {
		return ChatResponse{}, err
	}
	return ChatResponse{
		ID:             chat.ID,
		ParticipantIDs: []string{userID, req.ParticipantUserID},
		LastMessageAt:  chat.LastMessageAt,
		CreatedAt:      chat.CreatedAt,
	}, nil
}

func (s *Service) List(ctx context.Context, userID string) ([]ChatResponse, error) {
	chats, err := s.repo.ListChats(ctx, userID)
	if err != nil {
		return nil, err
	}
	response := make([]ChatResponse, 0, len(chats))
	for _, item := range chats {
		response = append(response, ChatResponse{
			ID:             item.ID,
			ParticipantIDs: item.ParticipantIDs,
			LastMessageAt:  item.LastMessageAt,
			CreatedAt:      item.CreatedAt,
		})
	}
	return response, nil
}

func (s *Service) Send(ctx context.Context, userID, chatID string, req SendMessageRequest) (MessageResponse, error) {
	record, err := s.repo.SendMessage(ctx, userID, chatID, req)
	if err != nil {
		return MessageResponse{}, err
	}
	return toMessageResponse(record), nil
}

func (s *Service) Messages(ctx context.Context, userID, chatID string, page, limit int) ([]MessageResponse, error) {
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = 50
	}
	items, err := s.repo.ListMessages(ctx, userID, chatID, page, limit)
	if err != nil {
		return nil, err
	}
	response := make([]MessageResponse, 0, len(items))
	for _, item := range items {
		copy := item
		response = append(response, toMessageResponse(&copy))
	}
	return response, nil
}

func (s *Service) Events(ctx context.Context, userID, chatID string, after int64, limit int) ([]ChatEventResponse, map[string]any, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	items, err := s.repo.ListEvents(ctx, userID, chatID, after, limit+1)
	if err != nil {
		return nil, nil, err
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	response := make([]ChatEventResponse, 0, len(items))
	for _, item := range items {
		payload := map[string]any{}
		if len(item.PayloadJSON) > 0 {
			if err := json.Unmarshal(item.PayloadJSON, &payload); err != nil {
				return nil, nil, err
			}
		}
		response = append(response, ChatEventResponse{
			ID:        item.ID,
			Sequence:  item.Sequence,
			Channel:   item.Channel,
			ChatID:    item.AggregateID,
			EventType: item.EventType,
			Payload:   payload,
			CreatedAt: item.CreatedAt,
			RelayedAt: item.RelayedAt,
		})
	}

	pagination := map[string]any{
		"after":   after,
		"limit":   limit,
		"hasMore": hasMore,
	}
	if len(response) > 0 {
		pagination["nextCursor"] = response[len(response)-1].Sequence
	}
	return response, pagination, nil
}

func toMessageResponse(record *MessageRecord) MessageResponse {
	message := &record.Message
	attachments := make([]MessageAttachmentResponse, 0, len(record.Attachments))
	for _, attachment := range record.Attachments {
		attachments = append(attachments, MessageAttachmentResponse{
			MediaFileID:  attachment.MediaFileID,
			Kind:         attachment.Kind,
			Status:       attachment.Status,
			OriginalName: attachment.OriginalName,
			MimeType:     attachment.MimeType,
			SizeBytes:    attachment.SizeBytes,
		})
	}
	return MessageResponse{
		ID:                 message.ID,
		ChatID:             message.ChatID,
		SenderID:           message.SenderID,
		EnvelopeType:       string(message.EnvelopeType),
		Ciphertext:         string(message.Ciphertext),
		Nonce:              message.Nonce,
		SenderKeyID:        message.SenderKeyID,
		AttachmentManifest: decodeMessageJSON(message.AttachmentManifest),
		Attachments:        attachments,
		Metadata:           decodeMessageJSON(message.MetadataJSON),
		ClientMessageID:    message.ClientMessageID,
		SentAt:             message.SentAt,
		EditedAt:           message.EditedAt,
	}
}

func decodeMessageJSON(raw []byte) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	payload := map[string]any{}
	_ = json.Unmarshal(raw, &payload)
	return payload
}
