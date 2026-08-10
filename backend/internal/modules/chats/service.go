package chats

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

func nullableStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func metadataToBytes(metadata map[string]interface{}) ([]byte, error) {
	if metadata == nil {
		return nil, nil
	}
	return json.Marshal(metadata)
}

func bytesToMetadata(data []byte) map[string]interface{} {
	if data == nil {
		return nil
	}
	var metadata map[string]interface{}
	if err := json.Unmarshal(data, &metadata); err != nil {
		return nil
	}
	return metadata
}

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// ============================================================================
// CHAT OPERATIONS
// ============================================================================

func (s *Service) CreateChat(ctx context.Context, userID string, req CreateChatRequest) (ChatResponse, error) {
	if len(req.ParticipantIDs) == 0 {
		return ChatResponse{}, apperrors.New(400, "chats.no_participants", "At least one participant is required")
	}
	req.EncryptionProtocol = strings.ToUpper(strings.TrimSpace(req.EncryptionProtocol))
	if req.TrustedChat {
		req.EncryptionProtocol = string(enums.EncryptionProtocolTrustedChat)
	}
	if req.EncryptionProtocol == "" {
		req.EncryptionProtocol = string(enums.EncryptionProtocolSignal)
	}
	if req.EncryptionProtocol == string(enums.EncryptionProtocolNone) {
		return ChatResponse{}, apperrors.New(400, "chats.encryption_required", "Chats must use end-to-end encrypted payloads")
	}

	// For direct chats, check if chat already exists
	if req.Type == string(enums.ChatTypeDirect) {
		if len(req.ParticipantIDs) != 1 {
			return ChatResponse{}, apperrors.New(400, "chats.direct_one_participant", "Direct chats can only have one participant")
		}

		existingChat, err := s.repo.GetChatByMembers(ctx, []string{userID, req.ParticipantIDs[0]})
		if err == nil {
			return s.toChatResponse(ctx, existingChat, userID)
		}
		if !errors.Is(err, apperrors.ErrNotFound) {
			return ChatResponse{}, err
		}
	}

	chat := &model.Chat{
		Type:               enums.ChatType(req.Type),
		Title:              nullableString(req.Title),
		Description:        nullableString(req.Description),
		AvatarFileID:       nullableString(req.AvatarFileID),
		CreatedByID:        userID,
		EncryptionProtocol: enums.EncryptionProtocol(req.EncryptionProtocol),
		MessageTTLSeconds:  req.MessageTTLSeconds,
		IsMuted:            false,
		IsPinned:           false,
		LastSequenceNumber: 0,
	}

	createdChat, err := s.repo.CreateChat(ctx, chat)
	if err != nil {
		return ChatResponse{}, err
	}

	// Add creator as owner
	member := &model.ChatMember{
		ChatID: createdChat.ID,
		UserID: userID,
		Role:   enums.ChatRoleOwner,
	}
	if _, err := s.repo.AddChatMember(ctx, member); err != nil {
		return ChatResponse{}, err
	}

	// Add other participants
	for _, participantID := range req.ParticipantIDs {
		if participantID == userID {
			continue
		}
		member := &model.ChatMember{
			ChatID: createdChat.ID,
			UserID: participantID,
			Role:   enums.ChatRoleMember,
		}
		if _, err := s.repo.AddChatMember(ctx, member); err != nil {
			return ChatResponse{}, err
		}
	}

	return s.toChatResponse(ctx, createdChat, userID)
}

func (s *Service) GetChat(ctx context.Context, chatID, userID string) (ChatResponse, error) {
	if err := s.repo.AssertChatMembership(ctx, chatID, userID); err != nil {
		return ChatResponse{}, err
	}

	chat, err := s.repo.GetChat(ctx, chatID)
	if err != nil {
		return ChatResponse{}, err
	}

	return s.toChatResponse(ctx, chat, userID)
}

func (s *Service) UpdateChat(ctx context.Context, chatID, userID string, req UpdateChatRequest) (ChatResponse, error) {
	_, err := s.repo.GetChat(ctx, chatID)
	if err != nil {
		return ChatResponse{}, err
	}

	// Only owner can update chat
	member, err := s.repo.GetChatMember(ctx, chatID, userID)
	if err != nil {
		return ChatResponse{}, err
	}
	if member.Role != enums.ChatRoleOwner {
		return ChatResponse{}, apperrors.ErrForbidden
	}

	updates := make(map[string]interface{})
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.AvatarFileID != "" {
		updates["avatar_file_id"] = req.AvatarFileID
	}
	if req.MessageTTLSeconds != nil {
		updates["message_ttl_seconds"] = req.MessageTTLSeconds
	}
	if req.IsMuted != nil {
		updates["is_muted"] = req.IsMuted
	}
	if req.IsPinned != nil {
		updates["is_pinned"] = req.IsPinned
	}

	updatedChat, err := s.repo.UpdateChat(ctx, chatID, updates)
	if err != nil {
		return ChatResponse{}, err
	}

	return s.toChatResponse(ctx, updatedChat, userID)
}

func (s *Service) DeleteChat(ctx context.Context, chatID, userID string) error {
	chat, err := s.repo.GetChat(ctx, chatID)
	if err != nil {
		return err
	}

	// Only owner can delete chat
	if chat.CreatedByID != userID {
		return apperrors.ErrForbidden
	}

	return s.repo.DeleteChat(ctx, chatID)
}

func (s *Service) ListChats(ctx context.Context, userID string, query ListChatsQuery) ([]ChatResponse, error) {
	if query.Limit == 0 {
		query.Limit = 50
	}

	chats, err := s.repo.ListUserChats(ctx, userID, query.Limit, query.Offset, query.UnreadOnly, query.PinnedOnly)
	if err != nil {
		return nil, err
	}

	response := make([]ChatResponse, 0, len(chats))
	for _, chat := range chats {
		chatResp, err := s.toChatResponse(ctx, chat, userID)
		if err != nil {
			return nil, err
		}
		response = append(response, chatResp)
	}

	return response, nil
}

// ============================================================================
// CHAT MEMBER OPERATIONS
// ============================================================================

func (s *Service) GetChatMembers(ctx context.Context, chatID, userID string, query ListMembersQuery) ([]ChatMemberResponse, error) {
	if err := s.repo.AssertChatMembership(ctx, chatID, userID); err != nil {
		return nil, err
	}

	members, err := s.repo.ListChatMembers(ctx, chatID, query.Role, query.Limit, query.Offset)
	if err != nil {
		return nil, err
	}

	response := make([]ChatMemberResponse, 0, len(members))
	for _, member := range members {
		response = append(response, s.toChatMemberResponse(member))
	}

	return response, nil
}

func (s *Service) UpdateChatMember(ctx context.Context, chatID, targetUserID, requestingUserID string, req UpdateChatMemberRequest) (ChatMemberResponse, error) {
	requestingMember, err := s.repo.GetChatMember(ctx, chatID, requestingUserID)
	if err != nil {
		return ChatMemberResponse{}, err
	}

	targetMember, err := s.repo.GetChatMember(ctx, chatID, targetUserID)
	if err != nil {
		return ChatMemberResponse{}, err
	}

	// Owner cannot be removed or demoted
	if targetMember.Role == enums.ChatRoleOwner {
		return ChatMemberResponse{}, apperrors.New(400, "chats.owner_protected", "Cannot modify owner role")
	}
	if targetUserID != requestingUserID && requestingMember.Role != enums.ChatRoleOwner && requestingMember.Role != enums.ChatRoleAdmin {
		return ChatMemberResponse{}, apperrors.ErrForbidden
	}
	if targetUserID == requestingUserID && req.Role != "" {
		return ChatMemberResponse{}, apperrors.ErrForbidden
	}
	if req.Role != "" && !canGrantChatRole(requestingMember.Role, enums.ChatMemberRole(req.Role)) {
		return ChatMemberResponse{}, apperrors.ErrForbidden
	}

	updates := make(map[string]interface{})
	if req.Role != "" {
		updates["role"] = req.Role
	}
	if req.Nickname != "" {
		updates["nickname"] = req.Nickname
	}
	if req.IsMuted != nil {
		updates["is_muted"] = req.IsMuted
	}

	updatedMember, err := s.repo.UpdateChatMember(ctx, chatID, targetUserID, updates)
	if err != nil {
		return ChatMemberResponse{}, err
	}

	return s.toChatMemberResponse(updatedMember), nil
}

func canGrantChatRole(actor, requested enums.ChatMemberRole) bool {
	if requested == enums.ChatRoleOwner {
		return false
	}
	switch actor {
	case enums.ChatRoleOwner:
		return requested == enums.ChatRoleAdmin || requested == enums.ChatRoleModerator || requested == enums.ChatRoleMember
	case enums.ChatRoleAdmin:
		return requested == enums.ChatRoleModerator || requested == enums.ChatRoleMember
	default:
		return false
	}
}

func (s *Service) RemoveChatMember(ctx context.Context, chatID, targetUserID, requestingUserID string) error {
	requestingMember, err := s.repo.GetChatMember(ctx, chatID, requestingUserID)
	if err != nil {
		return err
	}

	targetMember, err := s.repo.GetChatMember(ctx, chatID, targetUserID)
	if err != nil {
		return err
	}

	// Owner cannot be removed
	if targetMember.Role == enums.ChatRoleOwner {
		return apperrors.New(400, "chats.owner_protected", "Cannot remove owner from chat")
	}

	// Members can only remove themselves
	if targetUserID != requestingUserID && requestingMember.Role != enums.ChatRoleOwner && requestingMember.Role != enums.ChatRoleAdmin {
		return apperrors.ErrForbidden
	}

	return s.repo.RemoveChatMember(ctx, chatID, targetUserID)
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

func (s *Service) SendMessage(ctx context.Context, chatID, userID string, req SendMessageRequest) (MessageResponse, error) {
	if err := s.repo.AssertChatMembership(ctx, chatID, userID); err != nil {
		return MessageResponse{}, err
	}
	if strings.TrimSpace(req.Content) != "" {
		return MessageResponse{}, apperrors.New(400, "chats.plaintext_rejected", "Plaintext message content is not accepted by the server")
	}
	req.EncryptionProtocol = strings.ToUpper(strings.TrimSpace(req.EncryptionProtocol))
	if strings.EqualFold(req.EncryptionProtocol, string(enums.EncryptionProtocolNone)) {
		return MessageResponse{}, apperrors.New(400, "chats.encryption_required", "Messages must use end-to-end encrypted payloads")
	}
	if req.EncryptionProtocol == "" {
		req.EncryptionProtocol = string(enums.EncryptionProtocolSignal)
	}
	if req.EncryptionAlgorithm == "" {
		req.EncryptionAlgorithm = "client-managed-aead"
	}
	if len(req.KeyEnvelopes) == 0 {
		return MessageResponse{}, apperrors.New(400, "chats.key_envelopes_required", "Encrypted messages require per-device key envelopes")
	}
	if err := s.validateKeyEnvelopeRecipients(ctx, chatID, req.KeyEnvelopes); err != nil {
		return MessageResponse{}, err
	}
	mediaIDs := make([]string, 0, len(req.Attachments))
	thumbnailIDs := make([]string, 0, len(req.Attachments))
	for _, attachment := range req.Attachments {
		mediaIDs = append(mediaIDs, attachment.MediaFileID)
		if strings.TrimSpace(attachment.ThumbnailFileID) != "" {
			thumbnailIDs = append(thumbnailIDs, attachment.ThumbnailFileID)
		}
	}
	if err := s.repo.EnsureOwnedReadyMedia(ctx, userID, mediaIDs, thumbnailIDs); err != nil {
		return MessageResponse{}, err
	}
	if req.SenderDeviceID != "" {
		device, err := s.repo.GetTrustedDevice(ctx, req.SenderDeviceID)
		if err != nil {
			return MessageResponse{}, err
		}
		if device.UserID != userID || device.RevokedAt != nil || device.TrustStatus != "TRUSTED" {
			return MessageResponse{}, apperrors.ErrForbidden
		}
	}

	var expiresAt *time.Time
	if req.ExpiresInSeconds != nil {
		value := time.Now().UTC().Add(time.Duration(*req.ExpiresInSeconds) * time.Second)
		expiresAt = &value
	}

	metadataBytes, err := metadataToBytes(req.Metadata)
	if err != nil {
		return MessageResponse{}, err
	}

	candidateMessageID := uuid.NewString()
	message := &model.Message{
		ID:                     candidateMessageID,
		ChatID:                 chatID,
		SenderID:               userID,
		ClientMessageID:        req.ClientMessageID,
		SenderDeviceID:         nullableString(req.SenderDeviceID),
		Type:                   enums.MessageType(req.Type),
		Ciphertext:             req.Ciphertext,
		Nonce:                  req.Nonce,
		SenderKeyID:            req.SenderKeyID,
		EncryptionProtocol:     enums.EncryptionProtocol(req.EncryptionProtocol),
		EncryptionAlgorithm:    req.EncryptionAlgorithm,
		AssociatedData:         nullableString(req.AssociatedData),
		RatchetCounter:         req.RatchetCounter,
		AuthenticationTag:      nullableString(req.AuthenticationTag),
		Content:                nil,
		Metadata:               metadataBytes,
		ReplyToMessageID:       nullableString(req.ReplyToMessageID),
		ForwardedFromMessageID: nullableString(req.ForwardedFromID),
		ExpiresAt:              expiresAt,
	}

	// Wrap message, key envelopes, attachments and delivery receipts in a single transaction
	// so the message is never persisted without its decryption keys.
	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return MessageResponse{}, err
	}
	defer tx.Rollback(ctx)

	repoTx := s.repo.WithTx(tx)

	createdMessage, err := repoTx.CreateMessageInTx(ctx, message)
	if err != nil {
		return MessageResponse{}, err
	}
	// A retry can race with the first request. CreateMessage returns the
	// already-persisted row in that case. Do not create duplicate envelopes,
	// attachments, receipts, sequence numbers, or realtime events.
	if createdMessage.ID != candidateMessageID {
		return s.toMessageResponse(ctx, createdMessage, userID, nil, nil)
	}
	if len(req.KeyEnvelopes) > 0 {
		envelopes, err := s.toMessageKeyModels(createdMessage.ID, req.SenderDeviceID, req.KeyEnvelopes)
		if err != nil {
			return MessageResponse{}, err
		}
		if err := repoTx.CreateMessageKeyEnvelopes(ctx, envelopes); err != nil {
			return MessageResponse{}, err
		}
	}

	if len(req.Attachments) > 0 {
		attachments := make([]*model.Attachment, 0, len(req.Attachments))
		for _, att := range req.Attachments {
			metadataBytes, err := metadataToBytes(att.Metadata)
			if err != nil {
				return MessageResponse{}, err
			}
			attachment := &model.Attachment{
				MessageID:       createdMessage.ID,
				MediaFileID:     att.MediaFileID,
				Kind:            enums.AttachmentKind(att.Kind),
				FileName:        nullableString(att.FileName),
				MimeType:        nullableString(att.MimeType),
				SizeBytes:       att.SizeBytes,
				Width:           att.Width,
				Height:          att.Height,
				DurationSeconds: att.DurationSeconds,
				ThumbnailFileID: nullableString(att.ThumbnailFileID),
				Metadata:        metadataBytes,
			}
			attachments = append(attachments, attachment)
		}
		if err := repoTx.CreateAttachmentsBatch(ctx, attachments); err != nil {
			return MessageResponse{}, err
		}
	}

	// Mark as delivered to all other members in the same transaction.
	members, err := repoTx.ListChatMembers(ctx, chatID, "", 100, 0)
	if err != nil {
		return MessageResponse{}, err
	}
	recipientIDs := make([]string, 0, len(members))
	for _, member := range members {
		if member.UserID != userID {
			recipientIDs = append(recipientIDs, member.UserID)
		}
	}
	if len(recipientIDs) > 0 {
		if err := repoTx.MarkMessagesAsDeliveredBatch(ctx, createdMessage.ID, recipientIDs); err != nil {
			return MessageResponse{}, err
		}
	}

	eventID := uuid.NewString()
	if err := repoTx.AppendChatMessageRealtimeEvent(ctx, eventID, createdMessage.ChatID, createdMessage.ID, createdMessage.SenderID, nullableStringValue(createdMessage.SenderDeviceID), createdMessage.ClientMessageID, createdMessage.SequenceNumber); err != nil {
		return MessageResponse{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return MessageResponse{}, err
	}

	return s.toMessageResponse(ctx, createdMessage, userID, nil, nil)
}

func (s *Service) GetMessage(ctx context.Context, messageID, userID string) (MessageResponse, error) {
	message, err := s.repo.GetMessage(ctx, messageID)
	if err != nil {
		return MessageResponse{}, err
	}

	if err := s.repo.AssertChatMembership(ctx, message.ChatID, userID); err != nil {
		return MessageResponse{}, err
	}

	return s.toMessageResponse(ctx, message, userID, nil, nil)
}

func (s *Service) EditMessage(ctx context.Context, messageID, userID string, req EditMessageRequest) (MessageResponse, error) {
	message, err := s.repo.GetMessage(ctx, messageID)
	if err != nil {
		return MessageResponse{}, err
	}

	// Only sender can edit
	if message.SenderID != userID {
		return MessageResponse{}, apperrors.ErrForbidden
	}

	// Can only edit within 24 hours
	if time.Since(message.SentAt) > 24*time.Hour {
		return MessageResponse{}, apperrors.New(400, "chats.edit_expired", "Can only edit messages within 24 hours")
	}

	if strings.TrimSpace(req.Content) != "" {
		return MessageResponse{}, apperrors.New(400, "chats.plaintext_rejected", "Plaintext message content is not accepted by the server")
	}
	req.EncryptionProtocol = strings.ToUpper(strings.TrimSpace(req.EncryptionProtocol))

	// Wrap version, update and envelopes in a transaction for consistency.
	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return MessageResponse{}, err
	}
	defer tx.Rollback(ctx)

	repoTx := s.repo.WithTx(tx)

	// Create version before editing
	version := &model.MessageVersion{
		MessageID:  messageID,
		Ciphertext: message.Ciphertext,
		Nonce:      message.Nonce,
		Content:    message.Content,
		Metadata:   message.Metadata,
		EditedByID: userID,
	}
	if _, err := repoTx.CreateMessageVersion(ctx, version); err != nil {
		return MessageResponse{}, err
	}

	updates := map[string]interface{}{
		"ciphertext":           req.Ciphertext,
		"nonce":                req.Nonce,
		"content":              nil,
		"metadata":             req.Metadata,
		"edited_at":            time.Now().UTC(),
		"encryption_algorithm": "client-managed-aead",
	}
	if req.EncryptionProtocol != "" {
		updates["encryption_protocol"] = strings.ToUpper(strings.TrimSpace(req.EncryptionProtocol))
	}
	if req.AssociatedData != "" {
		updates["associated_data"] = req.AssociatedData
	}
	if req.RatchetCounter != nil {
		updates["ratchet_counter"] = req.RatchetCounter
	}

	updatedMessage, err := repoTx.UpdateMessage(ctx, messageID, updates)
	if err != nil {
		return MessageResponse{}, err
	}
	if len(req.KeyEnvelopes) > 0 {
		if err := s.validateKeyEnvelopeRecipients(ctx, message.ChatID, req.KeyEnvelopes); err != nil {
			return MessageResponse{}, err
		}
		senderDeviceID := ""
		if message.SenderDeviceID != nil {
			senderDeviceID = *message.SenderDeviceID
		}
		envelopes, err := s.toMessageKeyModels(messageID, senderDeviceID, req.KeyEnvelopes)
		if err != nil {
			return MessageResponse{}, err
		}
		if err := repoTx.CreateMessageKeyEnvelopes(ctx, envelopes); err != nil {
			return MessageResponse{}, err
		}
	}

	eventID := uuid.NewString()
	if err := repoTx.AppendChatRealtimeEvent(ctx, eventID, message.ChatID, "chat.message.edited", map[string]any{
		"eventId": eventID, "type": "chat.message.edited", "chatId": message.ChatID,
		"messageId": updatedMessage.ID, "senderId": updatedMessage.SenderID, "sequence": updatedMessage.SequenceNumber,
	}); err != nil {
		return MessageResponse{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return MessageResponse{}, err
	}

	return s.toMessageResponse(ctx, updatedMessage, userID, nil, nil)
}

func (s *Service) DeleteMessage(ctx context.Context, messageID, userID string, req DeleteMessageRequest) error {
	message, err := s.repo.GetMessage(ctx, messageID)
	if err != nil {
		return err
	}

	// Only sender can delete
	if message.SenderID != userID {
		return apperrors.ErrForbidden
	}

	if !req.DeleteForEveryone {
		return nil
	}
	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	repoTx := s.repo.WithTx(tx)
	if err := repoTx.DeleteMessage(ctx, messageID, userID, true); err != nil {
		return err
	}
	eventID := uuid.NewString()
	if err := repoTx.AppendChatRealtimeEvent(ctx, eventID, message.ChatID, "chat.message.deleted", map[string]any{
		"eventId": eventID, "type": "chat.message.deleted", "chatId": message.ChatID,
		"messageId": message.ID, "senderId": message.SenderID, "sequence": message.SequenceNumber,
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// GetMessagesAfterSequence recovers messages missed while a client was offline.
// Sequence numbers are monotonic per chat, so this is deterministic and avoids
// timestamp ambiguity during reconnect.
func (s *Service) GetMessagesAfterSequence(ctx context.Context, chatID, userID string, afterSequence int64, limit int) ([]MessageResponse, error) {
	messages, err := s.repo.GetMessagesAfterSequence(ctx, chatID, userID, afterSequence, limit)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(messages))
	for i, message := range messages {
		ids[i] = message.ID
	}
	attachmentMap, err := s.repo.GetAttachmentsByMessageIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	keyEnvelopeMap, err := s.repo.GetMessageKeyEnvelopesForUsers(ctx, ids, userID)
	if err != nil {
		return nil, err
	}
	response := make([]MessageResponse, 0, len(messages))
	for _, message := range messages {
		item, err := s.toMessageResponse(ctx, message, userID, attachmentMap[message.ID], keyEnvelopeMap[message.ID])
		if err != nil {
			return nil, err
		}
		response = append(response, item)
	}
	return response, nil
}

func (s *Service) GetMessages(ctx context.Context, chatID, userID string, query ListMessagesQuery) ([]MessageResponse, *CursorPaginationResponse, error) {
	var cursor *time.Time
	var cursorID *string

	if query.Cursor != "" {
		parsed, err := time.Parse(time.RFC3339Nano, query.Cursor)
		if err == nil {
			cursor = &parsed
		}
	}
	if query.CursorID != "" {
		cursorID = &query.CursorID
	}

	if query.Limit == 0 {
		query.Limit = 50
	}

	messages, err := s.repo.GetMessagesCursor(ctx, chatID, userID, cursor, cursorID, query.Limit, query.Before)
	if err != nil {
		return nil, nil, err
	}

	messageIDs := make([]string, len(messages))
	for i, message := range messages {
		messageIDs[i] = message.ID
	}
	attachmentMap, err := s.repo.GetAttachmentsByMessageIDs(ctx, messageIDs)
	if err != nil {
		return nil, nil, err
	}
	keyEnvelopeMap, err := s.repo.GetMessageKeyEnvelopesForUsers(ctx, messageIDs, userID)
	if err != nil {
		return nil, nil, err
	}

	response := make([]MessageResponse, 0, len(messages))
	for _, message := range messages {
		msgResp, err := s.toMessageResponse(ctx, message, userID, attachmentMap[message.ID], keyEnvelopeMap[message.ID])
		if err != nil {
			return nil, nil, err
		}
		response = append(response, msgResp)
	}

	pagination := &CursorPaginationResponse{
		HasMore: len(messages) >= query.Limit,
	}

	if len(messages) > 0 {
		lastMessage := messages[len(messages)-1]
		// Use millisecond precision (matching the DB TIMESTAMP(3)) to avoid skipping messages.
		cursorStr := lastMessage.SentAt.UTC().Format("2006-01-02T15:04:05.000Z07:00")
		pagination.NextCursor = &cursorStr
		pagination.NextCursorID = &lastMessage.ID
	}

	return response, pagination, nil
}

func (s *Service) GetMessageVersions(ctx context.Context, messageID, userID string) ([]MessageVersionResponse, error) {
	message, err := s.repo.GetMessage(ctx, messageID)
	if err != nil {
		return nil, err
	}

	if err := s.repo.AssertChatMembership(ctx, message.ChatID, userID); err != nil {
		return nil, err
	}

	versions, err := s.repo.GetMessageVersions(ctx, messageID)
	if err != nil {
		return nil, err
	}

	response := make([]MessageVersionResponse, 0, len(versions))
	for _, version := range versions {
		response = append(response, s.toMessageVersionResponse(version))
	}

	return response, nil
}

// ============================================================================
// REACTION OPERATIONS
// ============================================================================

func (s *Service) AddReaction(ctx context.Context, messageID, userID string, req AddReactionRequest) (ReactionResponse, error) {
	message, err := s.repo.GetMessage(ctx, messageID)
	if err != nil {
		return ReactionResponse{}, err
	}

	if err := s.repo.AssertChatMembership(ctx, message.ChatID, userID); err != nil {
		return ReactionResponse{}, err
	}

	reaction := &model.Reaction{
		MessageID:    messageID,
		UserID:       userID,
		ReactionType: enums.ReactionType(req.ReactionType),
	}

	createdReaction, err := s.repo.AddReaction(ctx, reaction)
	if err != nil {
		return ReactionResponse{}, err
	}

	return s.toReactionResponse(createdReaction), nil
}

func (s *Service) RemoveReaction(ctx context.Context, messageID, userID string, req RemoveReactionRequest) error {
	message, err := s.repo.GetMessage(ctx, messageID)
	if err != nil {
		return err
	}

	if err := s.repo.AssertChatMembership(ctx, message.ChatID, userID); err != nil {
		return err
	}

	return s.repo.RemoveReaction(ctx, messageID, userID, req.ReactionType)
}

func (s *Service) GetReactions(ctx context.Context, messageID, userID string, query ListReactionsQuery) ([]ReactionResponse, error) {
	message, err := s.repo.GetMessage(ctx, messageID)
	if err != nil {
		return nil, err
	}

	if err := s.repo.AssertChatMembership(ctx, message.ChatID, userID); err != nil {
		return nil, err
	}

	reactions, err := s.repo.GetReactions(ctx, messageID, query.Type, query.Limit)
	if err != nil {
		return nil, err
	}

	response := make([]ReactionResponse, 0, len(reactions))
	for _, reaction := range reactions {
		response = append(response, s.toReactionResponse(reaction))
	}

	return response, nil
}

// ============================================================================
// READ/DELIVERY RECEIPT OPERATIONS
// ============================================================================

func (s *Service) ListChatMemberIDs(ctx context.Context, chatID, userID string) ([]string, error) {
	if err := s.repo.AssertChatMembership(ctx, chatID, userID); err != nil {
		return nil, err
	}
	return s.repo.ListChatMemberIDs(ctx, chatID)
}

func (s *Service) MarkAsRead(ctx context.Context, chatID, userID string, req MarkAsReadRequest) (ReadReceiptResponse, error) {
	message, err := s.repo.GetMessage(ctx, req.MessageID)
	if err != nil {
		return ReadReceiptResponse{}, err
	}
	if chatID != "" && message.ChatID != chatID {
		return ReadReceiptResponse{}, apperrors.ErrForbidden
	}
	if err := s.repo.AssertChatMembership(ctx, message.ChatID, userID); err != nil {
		return ReadReceiptResponse{}, err
	}

	receipt, err := s.repo.MarkAsRead(ctx, req.MessageID, userID)
	if err != nil {
		return ReadReceiptResponse{}, err
	}

	// Update member's last read
	updates := map[string]interface{}{
		"last_read_message_id": req.MessageID,
		"last_read_at":         time.Now(),
	}
	_, _ = s.repo.UpdateChatMember(ctx, message.ChatID, userID, updates)

	return s.toReadReceiptResponse(receipt), nil
}

func (s *Service) RegisterTrustedDevice(ctx context.Context, userID string, req RegisterTrustedDeviceRequest) (TrustedDeviceResponse, error) {
	device := &model.TrustedDevice{
		UserID:            userID,
		DeviceName:        nullableString(req.DeviceName),
		IdentityKeyPublic: strings.TrimSpace(req.IdentityKeyPublic),
		SigningKeyPublic:  nullableString(req.SigningKeyPublic),
	}
	created, err := s.repo.RegisterTrustedDevice(ctx, device)
	if err != nil {
		return TrustedDeviceResponse{}, err
	}
	return s.toTrustedDeviceResponse(created), nil
}

func (s *Service) ListTrustedDevices(ctx context.Context, userID string) ([]TrustedDeviceResponse, error) {
	devices, err := s.repo.ListTrustedDevices(ctx, userID)
	if err != nil {
		return nil, err
	}
	response := make([]TrustedDeviceResponse, 0, len(devices))
	for _, device := range devices {
		response = append(response, s.toTrustedDeviceResponse(device))
	}
	return response, nil
}

func (s *Service) RevokeTrustedDevice(ctx context.Context, userID, deviceID string) error {
	return s.repo.RevokeTrustedDevice(ctx, userID, deviceID)
}

func (s *Service) PublishPreKey(ctx context.Context, userID, deviceID string, req PublishPreKeyRequest) (DevicePreKeyResponse, error) {
	device, err := s.repo.GetTrustedDevice(ctx, deviceID)
	if err != nil {
		return DevicePreKeyResponse{}, err
	}
	if device.UserID != userID || device.RevokedAt != nil {
		return DevicePreKeyResponse{}, apperrors.ErrForbidden
	}
	preKey := &model.DevicePreKey{
		DeviceID:  deviceID,
		UserID:    userID,
		KeyID:     strings.TrimSpace(req.KeyID),
		PublicKey: strings.TrimSpace(req.PublicKey),
		Signature: nullableString(req.Signature),
		OneTime:   req.OneTime,
		ExpiresAt: req.ExpiresAt,
	}
	created, err := s.repo.PublishDevicePreKey(ctx, preKey)
	if err != nil {
		return DevicePreKeyResponse{}, err
	}
	return s.toDevicePreKeyResponse(created), nil
}

func (s *Service) GetPreKeyBundle(ctx context.Context, userID string) (PreKeyBundleResponse, error) {
	device, signedPreKey, oneTimePreKey, err := s.repo.GetPreKeyBundle(ctx, userID)
	if err != nil {
		return PreKeyBundleResponse{}, err
	}
	response := PreKeyBundleResponse{
		UserID: userID,
		Device: s.toTrustedDeviceResponse(device),
	}
	if signedPreKey != nil {
		value := s.toDevicePreKeyResponse(signedPreKey)
		response.SignedPreKey = &value
	}
	if oneTimePreKey != nil {
		value := s.toDevicePreKeyResponse(oneTimePreKey)
		response.OneTimePreKey = &value
	}
	return response, nil
}

func (s *Service) MarkAsDelivered(ctx context.Context, messageID, userID string) (DeliveryReceiptResponse, error) {
	message, err := s.repo.GetMessage(ctx, messageID)
	if err != nil {
		return DeliveryReceiptResponse{}, err
	}

	if err := s.repo.AssertChatMembership(ctx, message.ChatID, userID); err != nil {
		return DeliveryReceiptResponse{}, err
	}

	receipt, err := s.repo.MarkAsDelivered(ctx, messageID, userID)
	if err != nil {
		return DeliveryReceiptResponse{}, err
	}

	return s.toDeliveryReceiptResponse(receipt), nil
}

// ============================================================================
// TYPING INDICATOR OPERATIONS
// ============================================================================

func (s *Service) SetTypingStatus(ctx context.Context, chatID, userID string, req SetTypingStatusRequest) error {
	if err := s.repo.AssertChatMembership(ctx, chatID, userID); err != nil {
		return err
	}

	expiresAt := time.Now().Add(10 * time.Second)
	return s.repo.SetTypingStatus(ctx, chatID, userID, enums.TypingStatus(req.Status), expiresAt)
}

func (s *Service) GetTypingSessions(ctx context.Context, chatID, userID string) ([]TypingSessionResponse, error) {
	if err := s.repo.AssertChatMembership(ctx, chatID, userID); err != nil {
		return nil, err
	}

	sessions, err := s.repo.GetTypingSessions(ctx, chatID)
	if err != nil {
		return nil, err
	}

	response := make([]TypingSessionResponse, 0, len(sessions))
	for _, session := range sessions {
		response = append(response, s.toTypingSessionResponse(session))
	}

	return response, nil
}

// ============================================================================
// PINNED MESSAGE OPERATIONS
// ============================================================================

func (s *Service) PinMessage(ctx context.Context, chatID, userID string, req PinMessageRequest) (PinnedMessage, error) {
	if err := s.repo.AssertChatMembership(ctx, chatID, userID); err != nil {
		return PinnedMessage{}, err
	}

	pinned, err := s.repo.PinMessage(ctx, chatID, req.MessageID, userID)
	if err != nil {
		return PinnedMessage{}, err
	}

	return s.toPinnedMessageResponse(pinned), nil
}

func (s *Service) UnpinMessage(ctx context.Context, chatID, userID string, req UnpinMessageRequest) error {
	if err := s.repo.AssertChatMembership(ctx, chatID, userID); err != nil {
		return err
	}

	return s.repo.UnpinMessage(ctx, chatID, req.MessageID)
}

func (s *Service) GetPinnedMessages(ctx context.Context, chatID, userID string) ([]PinnedMessage, error) {
	if err := s.repo.AssertChatMembership(ctx, chatID, userID); err != nil {
		return nil, err
	}

	pinned, err := s.repo.GetPinnedMessages(ctx, chatID)
	if err != nil {
		return nil, err
	}

	response := make([]PinnedMessage, 0, len(pinned))
	for _, p := range pinned {
		response = append(response, s.toPinnedMessageResponse(p))
	}

	return response, nil
}

// ============================================================================
// CLEANUP OPERATIONS
// ============================================================================

func (s *Service) CleanupExpiredTypingSessions(ctx context.Context) error {
	return s.repo.CleanupExpiredTypingSessions(ctx)
}

func (s *Service) CleanupExpiredMessages(ctx context.Context) error {
	return s.repo.CleanupExpiredMessages(ctx)
}

// ============================================================================
// RESPONSE CONVERTERS
// ============================================================================

func (s *Service) toChatResponse(ctx context.Context, chat *model.Chat, userID string) (ChatResponse, error) {
	member, err := s.repo.GetChatMember(ctx, chat.ID, userID)
	if err != nil {
		member = &model.ChatMember{IsMuted: false}
	}

	// Calculate unread count
	unreadCount := int64(0)
	if member.LastReadAt != nil {
		const query = `
			SELECT COUNT(*) FROM messages
			WHERE chat_id = $1 AND sent_at > $2 AND sender_id != $3 AND deleted_at IS NULL
		`
		err := s.repo.db.QueryRow(ctx, query, chat.ID, member.LastReadAt, userID).Scan(&unreadCount)
		if err != nil {
			unreadCount = 0
		}
	}

	return ChatResponse{
		ID:                 chat.ID,
		Type:               string(chat.Type),
		Title:              chat.Title,
		Description:        chat.Description,
		AvatarFileID:       chat.AvatarFileID,
		CreatedByID:        chat.CreatedByID,
		EncryptionProtocol: string(chat.EncryptionProtocol),
		MessageTTLSeconds:  chat.MessageTTLSeconds,
		IsMuted:            member.IsMuted,
		IsPinned:           chat.IsPinned,
		LastMessage:        nil,
		LastMessageAt:      chat.LastMessageAt,
		LastSequenceNumber: chat.LastSequenceNumber,
		MemberCount:        chat.MemberCount,
		UnreadCount:        unreadCount,
		CreatedAt:          chat.CreatedAt,
		UpdatedAt:          chat.UpdatedAt,
	}, nil
}

func (s *Service) toMessageResponse(ctx context.Context, message *model.Message, viewerUserID string, attachments []*model.Attachment, keyEnvelopes []*model.MessageKey) (MessageResponse, error) {
	var err error
	if attachments == nil {
		attachments, err = s.repo.GetAttachmentsByMessage(ctx, message.ID)
		if err != nil {
			attachments = []*model.Attachment{}
		}
	}
	if keyEnvelopes == nil {
		keyEnvelopes, err = s.repo.GetMessageKeyEnvelopesForUser(ctx, message.ID, viewerUserID)
		if err != nil {
			keyEnvelopes = []*model.MessageKey{}
		}
	}

	attachmentResponses := make([]AttachmentResponse, 0, len(attachments))
	for _, att := range attachments {
		attachmentResponses = append(attachmentResponses, s.toAttachmentResponse(att))
	}
	keyEnvelopeResponses := make([]MessageKeyEnvelopeResponse, 0, len(keyEnvelopes))
	for _, envelope := range keyEnvelopes {
		keyEnvelopeResponses = append(keyEnvelopeResponses, s.toMessageKeyEnvelopeResponse(envelope))
	}

	return MessageResponse{
		ID:                   message.ID,
		ChatID:               message.ChatID,
		SenderID:             message.SenderID,
		ClientMessageID:      message.ClientMessageID,
		SenderDeviceID:       message.SenderDeviceID,
		SequenceNumber:       message.SequenceNumber,
		Type:                 string(message.Type),
		Status:               string(message.Status),
		Ciphertext:           message.Ciphertext,
		Nonce:                message.Nonce,
		SenderKeyID:          message.SenderKeyID,
		EncryptionProtocol:   string(message.EncryptionProtocol),
		EncryptionAlgorithm:  message.EncryptionAlgorithm,
		AssociatedData:       message.AssociatedData,
		RatchetCounter:       message.RatchetCounter,
		AuthenticationTag:    message.AuthenticationTag,
		Content:              nil,
		KeyEnvelopes:         keyEnvelopeResponses,
		Metadata:             bytesToMetadata(message.Metadata),
		ReplyToMessage:       nil,
		ForwardedFromMessage: nil,
		ForwardedFromChatID:  message.ForwardedFromChatID,
		ExpiresAt:            message.ExpiresAt,
		SentAt:               message.SentAt,
		EditedAt:             message.EditedAt,
		DeletedAt:            message.DeletedAt,
		DeletedByID:          message.DeletedByID,
		CreatedAt:            message.CreatedAt,
		UpdatedAt:            message.UpdatedAt,
		Attachments:          attachmentResponses,
		Reactions:            []ReactionResponse{},
		ReadReceipts:         []ReadReceiptResponse{},
		DeliveryReceipts:     []DeliveryReceiptResponse{},
		IsPinned:             false,
		VersionCount:         0,
	}, nil
}

func (s *Service) toChatMemberResponse(member *model.ChatMember) ChatMemberResponse {
	return ChatMemberResponse{
		ID:                member.ID,
		ChatID:            member.ChatID,
		UserID:            member.UserID,
		Role:              string(member.Role),
		Nickname:          member.Nickname,
		JoinedAt:          member.JoinedAt,
		LeftAt:            member.LeftAt,
		IsMuted:           member.IsMuted,
		MuteUntil:         member.MuteUntil,
		LastReadMessageID: member.LastReadMessageID,
		LastReadAt:        member.LastReadAt,
		CreatedAt:         member.CreatedAt,
		UpdatedAt:         member.UpdatedAt,
	}
}

func (s *Service) toAttachmentResponse(attachment *model.Attachment) AttachmentResponse {
	return AttachmentResponse{
		ID:              attachment.ID,
		MessageID:       attachment.MessageID,
		MediaFileID:     attachment.MediaFileID,
		Kind:            string(attachment.Kind),
		FileName:        attachment.FileName,
		MimeType:        attachment.MimeType,
		SizeBytes:       attachment.SizeBytes,
		Width:           attachment.Width,
		Height:          attachment.Height,
		DurationSeconds: attachment.DurationSeconds,
		ThumbnailFileID: attachment.ThumbnailFileID,
		Metadata:        bytesToMetadata(attachment.Metadata),
		CreatedAt:       attachment.CreatedAt,
	}
}

func (s *Service) toReactionResponse(reaction *model.Reaction) ReactionResponse {
	return ReactionResponse{
		ID:           reaction.ID,
		MessageID:    reaction.MessageID,
		UserID:       reaction.UserID,
		ReactionType: string(reaction.ReactionType),
		CreatedAt:    reaction.CreatedAt,
	}
}

func (s *Service) toReadReceiptResponse(receipt *model.ReadReceipt) ReadReceiptResponse {
	return ReadReceiptResponse{
		ID:        receipt.ID,
		MessageID: receipt.MessageID,
		UserID:    receipt.UserID,
		ReadAt:    receipt.ReadAt,
	}
}

func (s *Service) toDeliveryReceiptResponse(receipt *model.DeliveryReceipt) DeliveryReceiptResponse {
	return DeliveryReceiptResponse{
		ID:          receipt.ID,
		MessageID:   receipt.MessageID,
		UserID:      receipt.UserID,
		DeliveredAt: receipt.DeliveredAt,
	}
}

func (s *Service) toTypingSessionResponse(session *model.TypingSession) TypingSessionResponse {
	return TypingSessionResponse{
		ID:        session.ID,
		ChatID:    session.ChatID,
		UserID:    session.UserID,
		Status:    string(session.Status),
		ExpiresAt: session.ExpiresAt,
		CreatedAt: session.CreatedAt,
	}
}

func (s *Service) toMessageVersionResponse(version *model.MessageVersion) MessageVersionResponse {
	return MessageVersionResponse{
		ID:            version.ID,
		MessageID:     version.MessageID,
		VersionNumber: version.VersionNumber,
		Ciphertext:    version.Ciphertext,
		Nonce:         version.Nonce,
		Content:       version.Content,
		Metadata:      bytesToMetadata(version.Metadata),
		EditedAt:      version.EditedAt,
		EditedByID:    version.EditedByID,
	}
}

func (s *Service) toTrustedDeviceResponse(device *model.TrustedDevice) TrustedDeviceResponse {
	return TrustedDeviceResponse{
		ID:                device.ID,
		UserID:            device.UserID,
		DeviceName:        device.DeviceName,
		IdentityKeyPublic: device.IdentityKeyPublic,
		SigningKeyPublic:  device.SigningKeyPublic,
		Fingerprint:       device.Fingerprint,
		TrustStatus:       device.TrustStatus,
		CreatedAt:         device.CreatedAt,
		LastSeenAt:        device.LastSeenAt,
		RevokedAt:         device.RevokedAt,
	}
}

func (s *Service) toDevicePreKeyResponse(preKey *model.DevicePreKey) DevicePreKeyResponse {
	return DevicePreKeyResponse{
		ID:        preKey.ID,
		DeviceID:  preKey.DeviceID,
		UserID:    preKey.UserID,
		KeyID:     preKey.KeyID,
		PublicKey: preKey.PublicKey,
		Signature: preKey.Signature,
		OneTime:   preKey.OneTime,
		UsedAt:    preKey.UsedAt,
		CreatedAt: preKey.CreatedAt,
		ExpiresAt: preKey.ExpiresAt,
	}
}

func (s *Service) toMessageKeyEnvelopeResponse(envelope *model.MessageKey) MessageKeyEnvelopeResponse {
	return MessageKeyEnvelopeResponse{
		ID:                envelope.ID,
		MessageID:         envelope.MessageID,
		RecipientUserID:   envelope.RecipientID,
		RecipientDeviceID: envelope.RecipientDeviceID,
		SenderDeviceID:    envelope.SenderDeviceID,
		KeyID:             envelope.KeyID,
		Algorithm:         envelope.Algorithm,
		EncryptedKey:      envelope.EncryptedKey,
		Nonce:             envelope.Nonce,
		KeyVersion:        envelope.KeyVersion,
		CreatedAt:         envelope.CreatedAt,
	}
}

func (s *Service) toMessageKeyModels(messageID, senderDeviceID string, reqs []MessageKeyEnvelopeRequest) ([]*model.MessageKey, error) {
	envelopes := make([]*model.MessageKey, 0, len(reqs))
	for _, req := range reqs {
		req.RecipientUserID = strings.TrimSpace(req.RecipientUserID)
		req.RecipientDeviceID = strings.TrimSpace(req.RecipientDeviceID)
		req.KeyID = strings.TrimSpace(req.KeyID)
		req.Algorithm = strings.TrimSpace(req.Algorithm)
		if req.RecipientUserID == "" || req.RecipientDeviceID == "" || req.KeyID == "" || req.Algorithm == "" || req.EncryptedKey == "" {
			return nil, apperrors.New(400, "chats.key_envelope_invalid", "Key envelope fields are required")
		}
		envelope := &model.MessageKey{
			MessageID:         messageID,
			RecipientID:       req.RecipientUserID,
			RecipientDeviceID: req.RecipientDeviceID,
			SenderDeviceID:    senderDeviceID,
			KeyID:             req.KeyID,
			Algorithm:         req.Algorithm,
			EncryptedKey:      req.EncryptedKey,
			Nonce:             nullableString(req.Nonce),
			KeyVersion:        req.KeyVersion,
		}
		envelopes = append(envelopes, envelope)
	}
	return envelopes, nil
}

func (s *Service) validateKeyEnvelopeRecipients(ctx context.Context, chatID string, reqs []MessageKeyEnvelopeRequest) error {
	seen := make(map[string]struct{}, len(reqs))
	for _, req := range reqs {
		if _, ok := seen[req.RecipientUserID]; ok {
			continue
		}
		seen[req.RecipientUserID] = struct{}{}
		if err := s.repo.AssertChatMembership(ctx, chatID, req.RecipientUserID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) toPinnedMessageResponse(pinned *model.PinnedMessage) PinnedMessage {
	return PinnedMessage{
		ID:         pinned.ID,
		ChatID:     pinned.ChatID,
		MessageID:  pinned.MessageID,
		PinnedByID: pinned.PinnedByID,
		PinnedAt:   pinned.PinnedAt,
	}
}

// ============================================================================
// HELPERS
// ============================================================================

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
