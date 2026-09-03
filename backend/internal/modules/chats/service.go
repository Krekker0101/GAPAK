package chats

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/events"
	"github.com/gapak/backend/internal/platform/observability"
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

type messageAuxiliary struct {
	reactions        map[string][]*model.Reaction
	readReceipts     map[string][]*model.ReadReceipt
	deliveryReceipts map[string][]*model.DeliveryReceipt
	pinned           map[string]bool
	versionCounts    map[string]int
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// ============================================================================
// CHAT OPERATIONS
// ============================================================================

func (s *Service) CreateChat(ctx context.Context, userID string, req CreateChatRequest) (ChatResponse, error) {
	if req.Type == string(enums.ChatTypeDirect) && len(req.ParticipantIDs) == 1 && req.ParticipantIDs[0] == userID {
		return ChatResponse{}, apperrors.New(400, "chats.direct_self_forbidden", "A direct chat requires another user")
	}
	// Normalize participant IDs before touching the database. Duplicate IDs and
	// the creator in participantIds otherwise cause unique-key failures or a
	// misleading one-member conversation.
	participants := make([]string, 0, len(req.ParticipantIDs))
	seen := map[string]struct{}{userID: {}}
	for _, participantID := range req.ParticipantIDs {
		if _, exists := seen[participantID]; exists {
			continue
		}
		seen[participantID] = struct{}{}
		participants = append(participants, participantID)
	}
	if len(participants) == 0 {
		return ChatResponse{}, apperrors.New(400, "chats.no_participants", "At least one participant is required")
	}
	req.ParticipantIDs = participants
	req.EncryptionProtocol = strings.ToUpper(strings.TrimSpace(req.EncryptionProtocol))
	if req.TrustedChat {
		req.EncryptionProtocol = string(enums.EncryptionProtocolTrustedChat)
	}
	if req.EncryptionProtocol == "" {
		if req.Type == string(enums.ChatTypeDirect) {
			req.EncryptionProtocol = string(enums.EncryptionProtocolNone)
		} else {
			req.EncryptionProtocol = string(enums.EncryptionProtocolTrustedChat)
		}
	}
	if req.EncryptionProtocol == string(enums.EncryptionProtocolNone) && req.Type != string(enums.ChatTypeDirect) {
		return ChatResponse{}, apperrors.New(400, "chats.plaintext_direct_only", "Simple messaging is available only for direct chats")
	}
	if req.EncryptionProtocol != string(enums.EncryptionProtocolTrustedChat) && req.EncryptionProtocol != string(enums.EncryptionProtocolNone) {
		return ChatResponse{}, apperrors.New(400, "chats.e2ee.protocol_required", "Chats must use the GAPAK E2EE protocol")
	}

	// Chat and membership creation is one transaction. This prevents orphaned
	// chats when a participant is unavailable or a membership insert fails.
	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return ChatResponse{}, err
	}
	defer tx.Rollback(ctx)
	repoTx := s.repo.WithTx(tx)

	// For direct chats, serialize the pair and return the existing chat.
	if req.Type == string(enums.ChatTypeDirect) {
		if len(req.ParticipantIDs) != 1 {
			return ChatResponse{}, apperrors.New(400, "chats.direct_one_participant", "Direct chats can only have one participant")
		}
		if err := repoTx.LockDirectChatPair(ctx, userID, req.ParticipantIDs[0]); err != nil {
			return ChatResponse{}, err
		}

		existingChat, err := repoTx.GetChatByMembers(ctx, []string{userID, req.ParticipantIDs[0]})
		if err == nil {
			return s.toChatResponse(ctx, existingChat, userID)
		}
		if !errors.Is(err, apperrors.ErrNotFound) {
			return ChatResponse{}, err
		}
	}
	activeParticipants, err := repoTx.CountActiveUsersForShare(ctx, req.ParticipantIDs)
	if err != nil {
		return ChatResponse{}, err
	}
	if activeParticipants != len(req.ParticipantIDs) {
		return ChatResponse{}, apperrors.New(400, "chats.participant_unavailable", "One or more chat participants are unavailable")
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

	createdChat, err := repoTx.CreateChat(ctx, chat)
	if err != nil {
		return ChatResponse{}, err
	}

	// Add creator as owner
	member := &model.ChatMember{
		ChatID: createdChat.ID,
		UserID: userID,
		Role:   enums.ChatRoleOwner,
	}
	if _, err := repoTx.AddChatMember(ctx, member); err != nil {
		return ChatResponse{}, err
	}

	// Add other participants
	for _, participantID := range req.ParticipantIDs {
		member := &model.ChatMember{
			ChatID: createdChat.ID,
			UserID: participantID,
			Role:   enums.ChatRoleMember,
		}
		if _, err := repoTx.AddChatMember(ctx, member); err != nil {
			return ChatResponse{}, err
		}
	}
	// Member count is maintained by a database trigger; re-read it before the
	// transaction commits instead of returning the stale zero from INSERT.
	createdChat, err = repoTx.GetChat(ctx, createdChat.ID)
	if err != nil {
		return ChatResponse{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ChatResponse{}, err
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

	if query.Limit == 0 {
		query.Limit = 100
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

func canSendToChat(chatType enums.ChatType, role enums.ChatMemberRole) bool {
	if chatType != enums.ChatTypeChannel && chatType != enums.ChatTypeBroadcast {
		return true
	}
	return role == enums.ChatRoleOwner || role == enums.ChatRoleAdmin || role == enums.ChatRoleModerator
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
	member, err := s.repo.GetChatMember(ctx, chatID, userID)
	if err != nil {
		return MessageResponse{}, err
	}
	chat, err := s.repo.GetChat(ctx, chatID)
	if err != nil {
		return MessageResponse{}, err
	}
	if !canSendToChat(chat.Type, member.Role) {
		return MessageResponse{}, apperrors.New(403, "chats.posting_forbidden", "Only chat managers can publish to channels and broadcast lists")
	}
	req.EncryptionProtocol = strings.ToUpper(strings.TrimSpace(req.EncryptionProtocol))
	isPlain := chat.EncryptionProtocol == enums.EncryptionProtocolNone
	if req.EncryptionProtocol != string(chat.EncryptionProtocol) {
		return MessageResponse{}, apperrors.New(409, "chats.message_protocol_mismatch", "Message protocol does not match the chat protocol")
	}
	if isPlain {
		if chat.Type != enums.ChatTypeDirect {
			return MessageResponse{}, apperrors.New(400, "chats.plaintext_direct_only", "Simple messaging is available only for direct chats")
		}
		if strings.TrimSpace(req.Content) == "" && len(req.Attachments) == 0 {
			return MessageResponse{}, apperrors.New(400, "chats.message_empty", "Message content or an attachment is required")
		}
		if req.SenderDeviceID != "" || req.SenderKeyID != "" || req.Ciphertext != "" || req.Nonce != "" || req.AuthenticationTag != "" || len(req.KeyEnvelopes) != 0 {
			return MessageResponse{}, apperrors.New(400, "chats.simple_message_crypto_fields", "Simple messages must not include E2EE fields")
		}
	} else {
		if strings.TrimSpace(req.Content) != "" {
			return MessageResponse{}, apperrors.New(400, "chats.plaintext_rejected", "Plaintext message content is not accepted by encrypted chats")
		}
		if err := validateE2EECiphertext(req); err != nil {
			return MessageResponse{}, err
		}
		if len(req.KeyEnvelopes) == 0 {
			return MessageResponse{}, apperrors.New(400, "chats.key_envelopes_required", "Encrypted messages require per-device key envelopes")
		}
		expectedSenderKeyID := req.SenderDeviceID + ":identity:v1"
		if req.SenderKeyID != expectedSenderKeyID {
			return MessageResponse{}, apperrors.New(400, "chats.e2ee.invalid_sender_key_id", "senderKeyId does not match the authenticated sender device")
		}
	}
	if strings.TrimSpace(req.ReplyToMessageID) != "" {
		repliedMessage, err := s.repo.GetMessage(ctx, req.ReplyToMessageID)
		if err != nil {
			return MessageResponse{}, err
		}
		if repliedMessage.ChatID != chatID {
			return MessageResponse{}, apperrors.ErrNotFound
		}
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

	var effectiveTTL *int
	if chat.MessageTTLSeconds != nil {
		value := *chat.MessageTTLSeconds
		effectiveTTL = &value
	}
	if req.ExpiresInSeconds != nil && (effectiveTTL == nil || *req.ExpiresInSeconds < *effectiveTTL) {
		value := *req.ExpiresInSeconds
		effectiveTTL = &value
	}
	var expiresAt *time.Time
	if effectiveTTL != nil {
		value := time.Now().UTC().Add(time.Duration(*effectiveTTL) * time.Second)
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
		Content:                nullableString(req.Content),
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

	if !isPlain {
		senderDevice, err := repoTx.GetTrustedDeviceForUpdate(ctx, req.SenderDeviceID)
		if err != nil {
			return MessageResponse{}, err
		}
		if senderDevice.UserID != userID || senderDevice.RevokedAt != nil || senderDevice.TrustStatus != "TRUSTED" {
			return MessageResponse{}, apperrors.ErrForbidden
		}
		if err := s.validateKeyEnvelopeRecipientsWithRepo(ctx, repoTx, chatID, req.KeyEnvelopes, true); err != nil {
			return MessageResponse{}, err
		}
	}

	createdMessage, err := repoTx.CreateMessageInTx(ctx, message)
	if err != nil {
		return MessageResponse{}, err
	}
	// A retry can race with the first request. CreateMessage returns the
	// already-persisted row in that case. Do not create duplicate envelopes,
	// attachments, receipts, sequence numbers, or realtime events.
	if createdMessage.ID != candidateMessageID {
		same, compareErr := sameMessageRequest(ctx, repoTx, createdMessage, req)
		if compareErr != nil {
			return MessageResponse{}, compareErr
		}
		if !same {
			return MessageResponse{}, apperrors.New(409, "chats.message.replay_conflict", "clientMessageId was already used for a different message")
		}
		return s.toMessageResponse(ctx, createdMessage, userID, nil, nil, nil)
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

	// Resolve recipients for notifications. Delivery receipts are created only
	// after a recipient client actually acknowledges the message; persisting a
	// receipt here would incorrectly mark offline devices as delivered.
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
	eventID := uuid.NewString()
	if err := repoTx.AppendChatMessageRealtimeEvent(ctx, eventID, createdMessage.ChatID, createdMessage.ID, createdMessage.SenderID, nullableStringValue(createdMessage.SenderDeviceID), createdMessage.ClientMessageID, createdMessage.SequenceNumber); err != nil {
		return MessageResponse{}, err
	}
	membersForNotification := make([]string, 0, len(recipientIDs))
	membersForNotification = append(membersForNotification, recipientIDs...)
	if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
		Type: events.MessageCreated, AggregateType: "message", AggregateID: createdMessage.ID,
		ActorID: strPtrLocal(userID), RecipientUserIDs: membersForNotification,
		Payload:        map[string]any{"messageId": createdMessage.ID, "chatId": createdMessage.ChatID, "sequence": createdMessage.SequenceNumber},
		IdempotencyKey: "message-created:" + createdMessage.ID, CorrelationID: observability.CorrelationID(ctx), Sequence: &createdMessage.SequenceNumber,
	}); err != nil {
		return MessageResponse{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return MessageResponse{}, err
	}

	return s.toMessageResponse(ctx, createdMessage, userID, nil, nil, nil)
}

func (s *Service) GetMessage(ctx context.Context, messageID, userID string) (MessageResponse, error) {
	message, err := s.repo.GetMessage(ctx, messageID)
	if err != nil {
		return MessageResponse{}, err
	}

	if err := s.repo.AssertChatMembership(ctx, message.ChatID, userID); err != nil {
		return MessageResponse{}, err
	}

	return s.toMessageResponse(ctx, message, userID, nil, nil, nil)
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

	req.EncryptionProtocol = strings.ToUpper(strings.TrimSpace(req.EncryptionProtocol))
	isPlain := message.EncryptionProtocol == enums.EncryptionProtocolNone
	if req.EncryptionProtocol != string(message.EncryptionProtocol) {
		return MessageResponse{}, apperrors.New(409, "chats.message_protocol_mismatch", "Edited message protocol does not match the original message")
	}
	if isPlain {
		if strings.TrimSpace(req.Content) == "" {
			return MessageResponse{}, apperrors.New(400, "chats.message_empty", "Edited message content is required")
		}
		if req.SenderDeviceID != "" || req.SenderKeyID != "" || req.Ciphertext != "" || req.Nonce != "" || req.AuthenticationTag != "" || len(req.KeyEnvelopes) != 0 {
			return MessageResponse{}, apperrors.New(400, "chats.simple_message_crypto_fields", "Simple messages must not include E2EE fields")
		}
	} else {
		if strings.TrimSpace(req.Content) != "" {
			return MessageResponse{}, apperrors.New(400, "chats.plaintext_rejected", "Plaintext content is not accepted by encrypted chats")
		}
		if req.SenderKeyID != req.SenderDeviceID+":identity:v1" {
			return MessageResponse{}, apperrors.New(400, "chats.e2ee.invalid_sender_key_id", "senderKeyId does not match the editing sender device")
		}
		if err := validateHex(req.Ciphertext, "ciphertext", 16, 25000); err != nil {
			return MessageResponse{}, err
		}
		if err := validateHex(req.Nonce, "nonce", 12, 12); err != nil {
			return MessageResponse{}, err
		}
		if err := validateHex(req.AuthenticationTag, "authenticationTag", 64, 64); err != nil {
			return MessageResponse{}, err
		}
	}

	// Wrap version, update and envelopes in a transaction for consistency.
	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return MessageResponse{}, err
	}
	defer tx.Rollback(ctx)

	repoTx := s.repo.WithTx(tx)

	if !isPlain {
		device, err := repoTx.GetTrustedDeviceForUpdate(ctx, req.SenderDeviceID)
		if err != nil {
			return MessageResponse{}, err
		}
		if device.UserID != userID || device.RevokedAt != nil || device.TrustStatus != "TRUSTED" {
			return MessageResponse{}, apperrors.ErrForbidden
		}
		if err := s.validateKeyEnvelopeRecipientsWithRepo(ctx, repoTx, message.ChatID, req.KeyEnvelopes, true); err != nil {
			return MessageResponse{}, err
		}
	}

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
		"sender_device_id":     nullableString(req.SenderDeviceID),
		"sender_key_id":        req.SenderKeyID,
		"ciphertext":           req.Ciphertext,
		"nonce":                req.Nonce,
		"content":              nullableString(req.Content),
		"metadata":             req.Metadata,
		"edited_at":            time.Now().UTC(),
		"authentication_tag":   nullableString(req.AuthenticationTag),
		"encryption_algorithm": req.EncryptionAlgorithm,
	}
	if !isPlain {
		updates["encryption_algorithm"] = gapakE2EEEncryptionAlgorithm
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
	if !isPlain && len(req.KeyEnvelopes) > 0 {
		envelopes, err := s.toMessageKeyModels(messageID, req.SenderDeviceID, req.KeyEnvelopes)
		if err != nil {
			return MessageResponse{}, err
		}
		if err := repoTx.ReplaceMessageKeyEnvelopes(ctx, messageID, envelopes); err != nil {
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
	recipients, err := repoTx.ListChatMemberIDs(ctx, message.ChatID)
	if err != nil {
		return MessageResponse{}, err
	}
	if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
		Type: events.MessageEdited, AggregateType: "message", AggregateID: message.ID,
		ActorID: strPtrLocal(userID), RecipientUserIDs: withoutID(recipients, userID),
		Payload:        map[string]any{"messageId": message.ID, "chatId": message.ChatID, "sequence": updatedMessage.SequenceNumber},
		IdempotencyKey: "message-edited:" + message.ID + ":" + updatedMessage.UpdatedAt.UTC().Format(time.RFC3339Nano), CorrelationID: observability.CorrelationID(ctx), Sequence: &updatedMessage.SequenceNumber,
	}); err != nil {
		return MessageResponse{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return MessageResponse{}, err
	}

	return s.toMessageResponse(ctx, updatedMessage, userID, nil, nil, nil)
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
		return apperrors.New(400, "chats.delete_for_me_unsupported", "Per-user deletion is not supported; the message was not deleted")
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
	recipients, err := repoTx.ListChatMemberIDs(ctx, message.ChatID)
	if err != nil {
		return err
	}
	if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
		Type: events.MessageDeleted, AggregateType: "message", AggregateID: message.ID,
		ActorID: strPtrLocal(userID), RecipientUserIDs: withoutID(recipients, userID),
		Payload:        map[string]any{"messageId": message.ID, "chatId": message.ChatID, "sequence": message.SequenceNumber},
		IdempotencyKey: "message-deleted:" + message.ID + ":" + userID, CorrelationID: observability.CorrelationID(ctx), Sequence: &message.SequenceNumber,
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
	auxiliary, err := s.loadMessageAuxiliary(ctx, ids)
	if err != nil {
		return nil, err
	}
	response := make([]MessageResponse, 0, len(messages))
	for _, message := range messages {
		item, err := s.toMessageResponse(ctx, message, userID, attachmentMap[message.ID], keyEnvelopeMap[message.ID], auxiliary)
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
	auxiliary, err := s.loadMessageAuxiliary(ctx, messageIDs)
	if err != nil {
		return nil, nil, err
	}

	response := make([]MessageResponse, 0, len(messages))
	for _, message := range messages {
		msgResp, err := s.toMessageResponse(ctx, message, userID, attachmentMap[message.ID], keyEnvelopeMap[message.ID], auxiliary)
		if err != nil {
			return nil, nil, err
		}
		response = append(response, msgResp)
	}

	pagination := &CursorPaginationResponse{
		HasMore: len(messages) >= query.Limit,
	}

	if cursorMessage := messagePageCursor(messages, query.Before); cursorMessage != nil {
		// A "before" page is returned in chronological order even though SQL
		// selects the newest matching rows first. Its continuation cursor must
		// therefore use the oldest row, otherwise the next page overlaps almost
		// completely and advances by only one message.
		// Use millisecond precision (matching the DB TIMESTAMP(3)) to avoid skipping messages.
		cursorStr := cursorMessage.SentAt.UTC().Format("2006-01-02T15:04:05.000Z07:00")
		pagination.NextCursor = &cursorStr
		pagination.NextCursorID = &cursorMessage.ID
	}

	return response, pagination, nil
}

func messagePageCursor(messages []*model.Message, before bool) *model.Message {
	if len(messages) == 0 {
		return nil
	}
	if before {
		return messages[0]
	}
	return messages[len(messages)-1]
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

	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return ReactionResponse{}, err
	}
	defer tx.Rollback(ctx)
	repoTx := s.repo.WithTx(tx)
	createdReaction, err := repoTx.AddReaction(ctx, reaction)
	if err != nil {
		return ReactionResponse{}, err
	}
	realtimeEventID := uuid.NewString()
	if err := repoTx.AppendChatRealtimeEvent(ctx, realtimeEventID, message.ChatID, "chat.reaction.changed", map[string]any{
		"eventId": realtimeEventID, "type": "chat.reaction.changed", "chatId": message.ChatID,
		"messageId": message.ID, "data": map[string]any{"messageId": message.ID},
	}); err != nil {
		return ReactionResponse{}, err
	}
	recipients, err := repoTx.ListChatMemberIDs(ctx, message.ChatID)
	if err != nil {
		return ReactionResponse{}, err
	}
	if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
		Type: events.MessageReactionCreated, AggregateType: "message", AggregateID: message.ID,
		ActorID: strPtrLocal(userID), RecipientUserIDs: withoutID(recipients, userID),
		Payload:        map[string]any{"messageId": message.ID, "chatId": message.ChatID, "reactionType": req.ReactionType},
		IdempotencyKey: "message-reaction-created:" + message.ID + ":" + userID + ":" + req.ReactionType, CorrelationID: observability.CorrelationID(ctx),
	}); err != nil {
		return ReactionResponse{}, err
	}
	if err := tx.Commit(ctx); err != nil {
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

	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	repoTx := s.repo.WithTx(tx)
	if err := repoTx.RemoveReaction(ctx, messageID, userID, req.ReactionType); err != nil {
		return err
	}
	realtimeEventID := uuid.NewString()
	if err := repoTx.AppendChatRealtimeEvent(ctx, realtimeEventID, message.ChatID, "chat.reaction.changed", map[string]any{
		"eventId": realtimeEventID, "type": "chat.reaction.changed", "chatId": message.ChatID,
		"messageId": message.ID, "data": map[string]any{"messageId": message.ID},
	}); err != nil {
		return err
	}
	recipients, err := repoTx.ListChatMemberIDs(ctx, message.ChatID)
	if err != nil {
		return err
	}
	if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
		Type: events.MessageReactionRemoved, AggregateType: "message", AggregateID: message.ID,
		ActorID: strPtrLocal(userID), RecipientUserIDs: withoutID(recipients, userID),
		Payload:        map[string]any{"messageId": message.ID, "chatId": message.ChatID, "reactionType": req.ReactionType},
		IdempotencyKey: "message-reaction-removed:" + message.ID + ":" + userID + ":" + req.ReactionType, CorrelationID: observability.CorrelationID(ctx),
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
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

	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return ReadReceiptResponse{}, err
	}
	defer tx.Rollback(ctx)
	repoTx := s.repo.WithTx(tx)
	receipt, err := repoTx.MarkAsRead(ctx, req.MessageID, userID)
	if err != nil {
		return ReadReceiptResponse{}, err
	}
	if err := repoTx.AdvanceChatMemberReadCursor(ctx, message.ChatID, userID, req.MessageID, receipt.ReadAt); err != nil {
		return ReadReceiptResponse{}, err
	}
	realtimeEventID := uuid.NewString()
	if err := repoTx.AppendChatRealtimeEvent(ctx, realtimeEventID, message.ChatID, "chat.read_receipt", map[string]any{
		"eventId": realtimeEventID, "type": "chat.read_receipt", "chatId": message.ChatID,
		"messageId": message.ID, "senderId": userID,
		"data": map[string]any{"id": receipt.ID, "messageId": receipt.MessageID, "userId": receipt.UserID, "readAt": receipt.ReadAt},
	}); err != nil {
		return ReadReceiptResponse{}, err
	}
	recipients, err := repoTx.ListChatMemberIDs(ctx, message.ChatID)
	if err != nil {
		return ReadReceiptResponse{}, err
	}
	if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
		Type: events.MessageRead, AggregateType: "message", AggregateID: message.ID,
		ActorID: strPtrLocal(userID), RecipientUserIDs: withoutID(recipients, userID),
		Payload:        map[string]any{"messageId": message.ID, "chatId": message.ChatID, "readAt": receipt.ReadAt},
		IdempotencyKey: "message-read:" + message.ID + ":" + userID + ":" + receipt.ReadAt.UTC().Format(time.RFC3339Nano), CorrelationID: observability.CorrelationID(ctx),
	}); err != nil {
		return ReadReceiptResponse{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ReadReceiptResponse{}, err
	}
	return s.toReadReceiptResponse(receipt), nil
}

// ValidateSession verifies that a WebSocket browser connection is backed by an
// active session. It deliberately does not map a session ID to a trusted E2EE
// device ID; browser authentication and E2EE device authorization are separate
// security domains.
func (s *Service) ValidateSession(ctx context.Context, userID, sessionID string) error {
	var one int
	err := s.repo.db.QueryRow(ctx, `
		SELECT 1 FROM device_sessions
		WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at > NOW()
		LIMIT 1`, sessionID, userID).Scan(&one)
	if err != nil {
		return apperrors.ErrForbidden
	}
	return nil
}
func (s *Service) RegisterTrustedDevice(ctx context.Context, userID string, req RegisterTrustedDeviceRequest) (TrustedDeviceResponse, error) {
	if err := validateE2EEPublicJWK(req.IdentityKeyPublic, "identityKeyPublic"); err != nil {
		return TrustedDeviceResponse{}, err
	}
	if strings.TrimSpace(req.SigningKeyPublic) == "" {
		return TrustedDeviceResponse{}, apperrors.New(400, "chats.e2ee.signing_key_required", "signingKeyPublic is required for GAPAK E2EE devices")
	}
	if err := validateE2EEPublicJWK(req.SigningKeyPublic, "signingKeyPublic"); err != nil {
		return TrustedDeviceResponse{}, err
	}
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
	if device.UserID != userID || device.RevokedAt != nil || device.TrustStatus != "TRUSTED" {
		return DevicePreKeyResponse{}, apperrors.ErrForbidden
	}
	if err := validateE2EEPublicJWK(req.PublicKey, "publicKey"); err != nil {
		return DevicePreKeyResponse{}, err
	}
	if req.Signature != "" {
		if err := validateHex(req.Signature, "signature", 64, 64); err != nil {
			return DevicePreKeyResponse{}, err
		}
	}
	if req.OneTime && req.ExpiresAt == nil {
		return DevicePreKeyResponse{}, apperrors.New(400, "chats.e2ee.expiry_required", "One-time prekeys must have an expiration time")
	}
	if req.ExpiresAt != nil && !req.ExpiresAt.After(time.Now().UTC()) {
		return DevicePreKeyResponse{}, apperrors.New(400, "chats.e2ee.stale_prekey", "Prekey expiration must be in the future")
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
	bundles, err := s.repo.GetPreKeyBundles(ctx, userID)
	if err != nil {
		return PreKeyBundleResponse{}, err
	}
	first := bundles[0]
	response := PreKeyBundleResponse{
		UserID:  userID,
		Device:  s.toTrustedDeviceResponse(first.Device),
		Devices: make([]PreKeyDeviceBundleResponse, 0, len(bundles)),
	}
	if first.SignedPreKey != nil {
		value := s.toDevicePreKeyResponse(first.SignedPreKey)
		response.SignedPreKey = &value
	}
	if first.OneTimePreKey != nil {
		value := s.toDevicePreKeyResponse(first.OneTimePreKey)
		response.OneTimePreKey = &value
	}
	for _, bundle := range bundles {
		item := PreKeyDeviceBundleResponse{
			ID: bundle.Device.ID, UserID: bundle.Device.UserID,
			IdentityKeyPublic: bundle.Device.IdentityKeyPublic,
			SigningKeyPublic:  bundle.Device.SigningKeyPublic,
			TrustStatus:       bundle.Device.TrustStatus, KeyVersion: 1,
		}
		if bundle.SignedPreKey != nil {
			value := s.toDevicePreKeyResponse(bundle.SignedPreKey)
			item.SignedPreKey = &value
		}
		if bundle.OneTimePreKey != nil {
			value := s.toDevicePreKeyResponse(bundle.OneTimePreKey)
			item.OneTimePreKey = &value
		}
		response.Devices = append(response.Devices, item)
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

	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return DeliveryReceiptResponse{}, err
	}
	defer tx.Rollback(ctx)
	repoTx := s.repo.WithTx(tx)
	receipt, err := repoTx.MarkAsDelivered(ctx, messageID, userID)
	if err != nil {
		return DeliveryReceiptResponse{}, err
	}
	realtimeEventID := uuid.NewString()
	if err := repoTx.AppendChatRealtimeEvent(ctx, realtimeEventID, message.ChatID, "chat.delivery_receipt", map[string]any{
		"eventId": realtimeEventID, "type": "chat.delivery_receipt", "chatId": message.ChatID,
		"messageId": message.ID, "senderId": userID,
		"data": map[string]any{"id": receipt.ID, "messageId": receipt.MessageID, "userId": receipt.UserID, "deliveredAt": receipt.DeliveredAt},
	}); err != nil {
		return DeliveryReceiptResponse{}, err
	}
	if err := tx.Commit(ctx); err != nil {
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
	message, err := s.repo.GetMessage(ctx, req.MessageID)
	if err != nil {
		return PinnedMessage{}, err
	}
	if message.ChatID != chatID {
		return PinnedMessage{}, apperrors.ErrNotFound
	}
	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return PinnedMessage{}, err
	}
	defer tx.Rollback(ctx)
	repoTx := s.repo.WithTx(tx)
	pinned, err := repoTx.PinMessage(ctx, chatID, req.MessageID, userID)
	if err != nil {
		return PinnedMessage{}, err
	}
	eventID := uuid.NewString()
	if err := repoTx.AppendChatRealtimeEvent(ctx, eventID, chatID, "chat.pin.changed", map[string]any{
		"eventId": eventID, "type": "chat.pin.changed", "chatId": chatID, "messageId": req.MessageID,
		"data": map[string]any{"messageId": req.MessageID, "pinned": true, "pinnedById": userID},
	}); err != nil {
		return PinnedMessage{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return PinnedMessage{}, err
	}

	return s.toPinnedMessageResponse(pinned), nil
}

func (s *Service) UnpinMessage(ctx context.Context, chatID, userID string, req UnpinMessageRequest) error {
	if err := s.repo.AssertChatMembership(ctx, chatID, userID); err != nil {
		return err
	}
	message, err := s.repo.GetMessage(ctx, req.MessageID)
	if err != nil {
		return err
	}
	if message.ChatID != chatID {
		return apperrors.ErrNotFound
	}
	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	repoTx := s.repo.WithTx(tx)
	if err := repoTx.UnpinMessage(ctx, chatID, req.MessageID); err != nil {
		return err
	}
	eventID := uuid.NewString()
	if err := repoTx.AppendChatRealtimeEvent(ctx, eventID, chatID, "chat.pin.changed", map[string]any{
		"eventId": eventID, "type": "chat.pin.changed", "chatId": chatID, "messageId": req.MessageID,
		"data": map[string]any{"messageId": req.MessageID, "pinned": false, "pinnedById": userID},
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
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

func (s *Service) StartCleanup(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = time.Minute
	}
	go func() {
		cleanup := func() {
			_ = s.CleanupExpiredTypingSessions(ctx)
			_ = s.CleanupExpiredMessages(ctx)
		}
		cleanup()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				cleanup()
			}
		}
	}()
}

// ============================================================================
// RESPONSE CONVERTERS
// ============================================================================

func (s *Service) toChatResponse(ctx context.Context, chat *model.Chat, userID string) (ChatResponse, error) {
	member, err := s.repo.GetChatMember(ctx, chat.ID, userID)
	if err != nil {
		member = &model.ChatMember{IsMuted: false}
	}

	const unreadQuery = `
		SELECT COUNT(*) FROM messages m
		WHERE m.chat_id = $1 AND m.sent_at >= $2 AND m.sender_id != $4
		  AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at > NOW())
		  AND m.sequence_number > COALESCE((SELECT read_message.sequence_number FROM messages read_message WHERE read_message.id = $3), 0)`
	unreadCount := int64(0)
	if err := s.repo.db.QueryRow(ctx, unreadQuery, chat.ID, member.JoinedAt, member.LastReadMessageID, userID).Scan(&unreadCount); err != nil {
		unreadCount = 0
	}
	var directPeer *DirectPeerResponse
	if chat.Type == enums.ChatTypeDirect {
		if peer, peerErr := s.repo.GetDirectChatPeer(ctx, chat.ID, userID); peerErr == nil {
			directPeer = &DirectPeerResponse{ID: peer.ID, Username: peer.Username, DisplayName: peer.DisplayName, AvatarFileID: peer.AvatarFileID}
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
		DirectPeer:         directPeer,
		CreatedAt:          chat.CreatedAt,
		UpdatedAt:          chat.UpdatedAt,
	}, nil
}

func (s *Service) loadMessageAuxiliary(ctx context.Context, messageIDs []string) (*messageAuxiliary, error) {
	reactions, err := s.repo.GetReactionsByMessageIDs(ctx, messageIDs)
	if err != nil {
		return nil, err
	}
	readReceipts, err := s.repo.GetReadReceiptsByMessageIDs(ctx, messageIDs)
	if err != nil {
		return nil, err
	}
	deliveryReceipts, err := s.repo.GetDeliveryReceiptsByMessageIDs(ctx, messageIDs)
	if err != nil {
		return nil, err
	}
	pinned, err := s.repo.GetPinnedMessageIDs(ctx, messageIDs)
	if err != nil {
		return nil, err
	}
	versionCounts, err := s.repo.GetMessageVersionCounts(ctx, messageIDs)
	if err != nil {
		return nil, err
	}
	return &messageAuxiliary{
		reactions: reactions, readReceipts: readReceipts,
		deliveryReceipts: deliveryReceipts, pinned: pinned, versionCounts: versionCounts,
	}, nil
}

func (s *Service) toMessageResponse(ctx context.Context, message *model.Message, viewerUserID string, attachments []*model.Attachment, keyEnvelopes []*model.MessageKey, auxiliary *messageAuxiliary) (MessageResponse, error) {
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
	if auxiliary == nil {
		auxiliary, err = s.loadMessageAuxiliary(ctx, []string{message.ID})
		if err != nil {
			return MessageResponse{}, err
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
	reactionResponses := make([]ReactionResponse, 0, len(auxiliary.reactions[message.ID]))
	for _, reaction := range auxiliary.reactions[message.ID] {
		reactionResponses = append(reactionResponses, s.toReactionResponse(reaction))
	}
	readReceiptResponses := make([]ReadReceiptResponse, 0, len(auxiliary.readReceipts[message.ID]))
	for _, receipt := range auxiliary.readReceipts[message.ID] {
		readReceiptResponses = append(readReceiptResponses, s.toReadReceiptResponse(receipt))
	}
	deliveryReceiptResponses := make([]DeliveryReceiptResponse, 0, len(auxiliary.deliveryReceipts[message.ID]))
	for _, receipt := range auxiliary.deliveryReceipts[message.ID] {
		deliveryReceiptResponses = append(deliveryReceiptResponses, s.toDeliveryReceiptResponse(receipt))
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
		Content:              message.Content,
		KeyEnvelopes:         keyEnvelopeResponses,
		Metadata:             bytesToMetadata(message.Metadata),
		ReplyToMessageID:     message.ReplyToMessageID,
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
		Reactions:            reactionResponses,
		ReadReceipts:         readReceiptResponses,
		DeliveryReceipts:     deliveryReceiptResponses,
		IsPinned:             auxiliary.pinned[message.ID],
		VersionCount:         auxiliary.versionCounts[message.ID],
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
	return s.validateKeyEnvelopeRecipientsWithRepo(ctx, s.repo, chatID, reqs, false)
}

func (s *Service) validateKeyEnvelopeRecipientsWithRepo(ctx context.Context, repo *Repository, chatID string, reqs []MessageKeyEnvelopeRequest, lock bool) error {
	expectedRecipients, err := repo.ListChatTrustedDeviceRecipients(ctx, chatID)
	if err != nil {
		return err
	}
	expected := make(map[string]string, len(expectedRecipients))
	for _, recipient := range expectedRecipients {
		expected[recipient.DeviceID] = recipient.UserID
	}
	if len(reqs) != len(expected) {
		return apperrors.New(400, "chats.e2ee.incomplete_recipient_devices", "A key envelope is required for every active trusted device in the chat")
	}
	seenDevices := make(map[string]struct{}, len(reqs))
	for _, req := range reqs {
		if err := validateGapakE2EEKeyEnvelope(req); err != nil {
			return err
		}
		if _, ok := seenDevices[req.RecipientDeviceID]; ok {
			return apperrors.New(409, "chats.e2ee.duplicate_recipient_device", "Each recipient device may receive only one key envelope")
		}
		seenDevices[req.RecipientDeviceID] = struct{}{}
		expectedUserID, ok := expected[req.RecipientDeviceID]
		if !ok || expectedUserID != req.RecipientUserID {
			return apperrors.ErrForbidden
		}
		if err := repo.AssertChatMembership(ctx, chatID, req.RecipientUserID); err != nil {
			return err
		}
		var device *model.TrustedDevice
		var err error
		if lock {
			device, err = repo.GetTrustedDeviceForUpdate(ctx, req.RecipientDeviceID)
		} else {
			device, err = repo.GetTrustedDevice(ctx, req.RecipientDeviceID)
		}
		if err != nil {
			return err
		}
		if device.UserID != req.RecipientUserID || device.RevokedAt != nil || device.TrustStatus != "TRUSTED" {
			return apperrors.ErrForbidden
		}
	}
	return nil
}

func sameMessageRequest(ctx context.Context, repo *Repository, message *model.Message, req SendMessageRequest) (bool, error) {
	if message.EncryptionProtocol == enums.EncryptionProtocolNone {
		metadata, err := metadataToBytes(req.Metadata)
		if err != nil {
			return false, err
		}
		if req.EncryptionProtocol == string(enums.EncryptionProtocolNone) &&
			message.Type == enums.MessageType(req.Type) &&
			nullableStringValue(message.Content) == req.Content &&
			string(message.Metadata) == string(metadata) &&
			nullableStringValue(message.ReplyToMessageID) == req.ReplyToMessageID {
			// Continue below only when the basic payload is equal so attachments
			// can be compared without accepting a conflicting idempotent retry.
		} else {
			return false, nil
		}
		attachments, err := repo.GetAttachmentsByMessage(ctx, message.ID)
		if err != nil {
			return false, err
		}
		if len(attachments) != len(req.Attachments) {
			return false, nil
		}
		for i, reqAtt := range req.Attachments {
			att := attachments[i]
			if att.MediaFileID != reqAtt.MediaFileID || string(att.Kind) != reqAtt.Kind ||
				nullableStringValue(att.FileName) != reqAtt.FileName || nullableStringValue(att.MimeType) != reqAtt.MimeType ||
				att.SizeBytes != reqAtt.SizeBytes {
				return false, nil
			}
		}
		return true, nil
	}
	return sameEncryptedMessageRequest(ctx, repo, message, req)
}

func sameEncryptedMessageRequest(ctx context.Context, repo *Repository, message *model.Message, req SendMessageRequest) (bool, error) {
	if message.SenderDeviceID == nil || *message.SenderDeviceID != req.SenderDeviceID ||
		message.Type != enums.MessageType(req.Type) ||
		message.Ciphertext != req.Ciphertext ||
		message.Nonce != req.Nonce ||
		message.SenderKeyID != req.SenderKeyID ||
		message.EncryptionProtocol != enums.EncryptionProtocol(req.EncryptionProtocol) ||
		message.EncryptionAlgorithm != req.EncryptionAlgorithm ||
		nullableStringValue(message.AssociatedData) != req.AssociatedData ||
		nullableStringValue(message.AuthenticationTag) != req.AuthenticationTag ||
		((message.RatchetCounter == nil) != (req.RatchetCounter == nil)) ||
		(message.RatchetCounter != nil && req.RatchetCounter != nil && *message.RatchetCounter != *req.RatchetCounter) ||
		(message.ReplyToMessageID == nil) != (req.ReplyToMessageID == "") ||
		(message.ReplyToMessageID != nil && *message.ReplyToMessageID != req.ReplyToMessageID) ||
		(message.ForwardedFromMessageID == nil) != (req.ForwardedFromID == "") ||
		(message.ForwardedFromMessageID != nil && *message.ForwardedFromMessageID != req.ForwardedFromID) {
		return false, nil
	}

	metadata, err := metadataToBytes(req.Metadata)
	if err != nil {
		return false, err
	}
	if string(message.Metadata) != string(metadata) {
		return false, nil
	}

	attachments, err := repo.GetAttachmentsByMessage(ctx, message.ID)
	if err != nil {
		return false, err
	}
	if len(attachments) != len(req.Attachments) {
		return false, nil
	}
	for i, reqAtt := range req.Attachments {
		att := attachments[i]
		if att.MediaFileID != reqAtt.MediaFileID || string(att.Kind) != reqAtt.Kind || nullableStringValue(att.FileName) != reqAtt.FileName ||
			nullableStringValue(att.MimeType) != reqAtt.MimeType || att.SizeBytes != reqAtt.SizeBytes ||
			!sameIntPtr(att.Width, reqAtt.Width) || !sameIntPtr(att.Height, reqAtt.Height) || !sameIntPtr(att.DurationSeconds, reqAtt.DurationSeconds) ||
			nullableStringValue(att.ThumbnailFileID) != reqAtt.ThumbnailFileID {
			return false, nil
		}
		attMetadata, err := metadataToBytes(reqAtt.Metadata)
		if err != nil {
			return false, err
		}
		if string(att.Metadata) != string(attMetadata) {
			return false, nil
		}
	}

	envelopes, err := repo.GetAllMessageKeyEnvelopes(ctx, message.ID)
	if err != nil {
		return false, err
	}
	if len(envelopes) != len(req.KeyEnvelopes) {
		return false, nil
	}
	requestEnvelopes := append([]MessageKeyEnvelopeRequest(nil), req.KeyEnvelopes...)
	sort.Slice(requestEnvelopes, func(i, j int) bool {
		return requestEnvelopes[i].RecipientDeviceID < requestEnvelopes[j].RecipientDeviceID
	})
	sort.Slice(envelopes, func(i, j int) bool { return envelopes[i].RecipientDeviceID < envelopes[j].RecipientDeviceID })
	for i, reqEnv := range requestEnvelopes {
		env := envelopes[i]
		if env.RecipientID != reqEnv.RecipientUserID || env.RecipientDeviceID != reqEnv.RecipientDeviceID || env.KeyID != reqEnv.KeyID ||
			env.Algorithm != reqEnv.Algorithm || env.EncryptedKey != reqEnv.EncryptedKey || nullableStringValue(env.Nonce) != reqEnv.Nonce || env.KeyVersion != maxInt(reqEnv.KeyVersion, 1) {
			return false, nil
		}
	}

	if req.ExpiresInSeconds == nil {
		if message.ExpiresAt != nil {
			return false, nil
		}
	} else {
		if message.ExpiresAt == nil {
			return false, nil
		}
		wantExpiry := message.CreatedAt.Add(time.Duration(*req.ExpiresInSeconds) * time.Second)
		if absDuration(message.ExpiresAt.Sub(wantExpiry)) > 5*time.Second {
			return false, nil
		}
	}
	return true, nil
}

func sameIntPtr(a *int, b *int) bool {
	if (a == nil) != (b == nil) {
		return false
	}
	return a == nil || *a == *b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
func absDuration(v time.Duration) time.Duration {
	if v < 0 {
		return -v
	}
	return v
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

func strPtrLocal(v string) *string { return &v }

func withoutID(ids []string, excluded string) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if id != excluded {
			out = append(out, id)
		}
	}
	return out
}
