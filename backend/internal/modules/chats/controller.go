package chats

import (
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/middleware"
)

type Controller struct {
	service  *Service
	validate *validator.Validate
}

func NewController(service *Service, validate *validator.Validate) *Controller {
	return &Controller{service: service, validate: validate}
}

func (ctl *Controller) RegisterRoutes(router fiber.Router, requireAuth fiber.Handler) {
	group := router.Group("/chats", requireAuth)

	// Chat operations
	group.Get("/", ctl.listChats)
	group.Post("/", ctl.createChat)
	group.Post("/trusted-devices", ctl.registerTrustedDevice)
	group.Get("/trusted-devices", ctl.listTrustedDevices)
	group.Delete("/trusted-devices/:deviceId", ctl.revokeTrustedDevice)
	group.Post("/trusted-devices/:deviceId/pre-keys", ctl.publishPreKey)
	group.Get("/pre-key-bundles/:userId", ctl.getPreKeyBundle)
	group.Get("/:chatId", ctl.getChat)
	group.Patch("/:chatId", ctl.updateChat)
	group.Delete("/:chatId", ctl.deleteChat)

	// Chat member operations
	group.Get("/:chatId/members", ctl.getChatMembers)
	group.Patch("/:chatId/members/:userId", ctl.updateChatMember)
	group.Delete("/:chatId/members/:userId", ctl.removeChatMember)

	// Message operations
	group.Get("/:chatId/messages", ctl.getMessages)
	group.Post("/:chatId/messages", ctl.sendMessage)
	group.Get("/messages/:messageId", ctl.getMessage)
	group.Patch("/messages/:messageId", ctl.editMessage)
	group.Delete("/messages/:messageId", ctl.deleteMessage)
	group.Get("/messages/:messageId/versions", ctl.getMessageVersions)

	// Reaction operations
	group.Post("/messages/:messageId/reactions", ctl.addReaction)
	group.Delete("/messages/:messageId/reactions", ctl.removeReaction)
	group.Get("/messages/:messageId/reactions", ctl.getReactions)

	// Read/Delivery receipt operations
	group.Post("/messages/:messageId/read", ctl.markAsRead)
	group.Post("/messages/:messageId/delivered", ctl.markAsDelivered)

	// Typing indicator operations
	group.Post("/:chatId/typing", ctl.setTypingStatus)
	group.Get("/:chatId/typing", ctl.getTypingSessions)

	// Pinned message operations
	group.Post("/:chatId/pinned", ctl.pinMessage)
	group.Delete("/:chatId/pinned/:messageId", ctl.unpinMessage)
	group.Get("/:chatId/pinned", ctl.getPinnedMessages)
}

// ============================================================================
// CHAT HANDLERS
// ============================================================================

func (ctl *Controller) listChats(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	query, err := httpx.BindQuery[ListChatsQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.ListChats(c.UserContext(), claims.UserID, query)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) createChat(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	payload, err := httpx.BindBody[CreateChatRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.CreateChat(c.UserContext(), claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) getChat(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	response, err := ctl.service.GetChat(c.UserContext(), chatID, claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) updateChat(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[UpdateChatRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.UpdateChat(c.UserContext(), chatID, claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) deleteChat(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	if err := ctl.service.DeleteChat(c.UserContext(), chatID, claims.UserID); err != nil {
		return err
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ============================================================================
// CHAT MEMBER HANDLERS
// ============================================================================

func (ctl *Controller) getChatMembers(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	query, err := httpx.BindQuery[ListMembersQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.GetChatMembers(c.UserContext(), chatID, claims.UserID, query)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) updateChatMember(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	targetUserID, err := httpx.UUIDParam(c, "userId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[UpdateChatMemberRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.UpdateChatMember(c.UserContext(), chatID, targetUserID, claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) removeChatMember(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	targetUserID, err := httpx.UUIDParam(c, "userId")
	if err != nil {
		return err
	}
	if err := ctl.service.RemoveChatMember(c.UserContext(), chatID, targetUserID, claims.UserID); err != nil {
		return err
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

func (ctl *Controller) getMessages(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	query, err := httpx.BindQuery[ListMessagesQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	response, pagination, err := ctl.service.GetMessages(c.UserContext(), chatID, claims.UserID, query)
	if err != nil {
		return err
	}
	paginationMap := map[string]any{
		"nextCursor":     pagination.NextCursor,
		"nextCursorId":   pagination.NextCursorID,
		"previousCursor": pagination.PreviousCursor,
		"hasMore":        pagination.HasMore,
		"totalCount":     pagination.TotalCount,
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), paginationMap))
}

func (ctl *Controller) sendMessage(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[SendMessageRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.SendMessage(c.UserContext(), chatID, claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) registerTrustedDevice(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	payload, err := httpx.BindBody[RegisterTrustedDeviceRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.RegisterTrustedDevice(c.UserContext(), claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) listTrustedDevices(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.ListTrustedDevices(c.UserContext(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) revokeTrustedDevice(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	deviceID, err := httpx.UUIDParam(c, "deviceId")
	if err != nil {
		return err
	}
	if err := ctl.service.RevokeTrustedDevice(c.UserContext(), claims.UserID, deviceID); err != nil {
		return err
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

func (ctl *Controller) publishPreKey(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	deviceID, err := httpx.UUIDParam(c, "deviceId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[PublishPreKeyRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.PublishPreKey(c.UserContext(), claims.UserID, deviceID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) getPreKeyBundle(c *fiber.Ctx) error {
	query, err := httpx.BindQuery[PreKeyBundleQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.GetPreKeyBundle(c.UserContext(), query.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) getMessage(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	messageID, err := httpx.UUIDParam(c, "messageId")
	if err != nil {
		return err
	}
	response, err := ctl.service.GetMessage(c.UserContext(), messageID, claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) editMessage(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	messageID, err := httpx.UUIDParam(c, "messageId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[EditMessageRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.EditMessage(c.UserContext(), messageID, claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) deleteMessage(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	messageID, err := httpx.UUIDParam(c, "messageId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[DeleteMessageRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	if err := ctl.service.DeleteMessage(c.UserContext(), messageID, claims.UserID, payload); err != nil {
		return err
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

func (ctl *Controller) getMessageVersions(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	messageID, err := httpx.UUIDParam(c, "messageId")
	if err != nil {
		return err
	}
	response, err := ctl.service.GetMessageVersions(c.UserContext(), messageID, claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

// ============================================================================
// REACTION HANDLERS
// ============================================================================

func (ctl *Controller) addReaction(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	messageID, err := httpx.UUIDParam(c, "messageId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[AddReactionRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.AddReaction(c.UserContext(), messageID, claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) removeReaction(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	messageID, err := httpx.UUIDParam(c, "messageId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[RemoveReactionRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	if err := ctl.service.RemoveReaction(c.UserContext(), messageID, claims.UserID, payload); err != nil {
		return err
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

func (ctl *Controller) getReactions(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	messageID, err := httpx.UUIDParam(c, "messageId")
	if err != nil {
		return err
	}
	query, err := httpx.BindQuery[ListReactionsQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.GetReactions(c.UserContext(), messageID, claims.UserID, query)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

// ============================================================================
// READ/DELIVERY RECEIPT HANDLERS
// ============================================================================

func (ctl *Controller) markAsRead(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	messageID, err := httpx.UUIDParam(c, "messageId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[MarkAsReadRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	payload.MessageID = messageID
	response, err := ctl.service.MarkAsRead(c.UserContext(), "", claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) markAsDelivered(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	messageID, err := httpx.UUIDParam(c, "messageId")
	if err != nil {
		return err
	}
	response, err := ctl.service.MarkAsDelivered(c.UserContext(), messageID, claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

// ============================================================================
// TYPING INDICATOR HANDLERS
// ============================================================================

func (ctl *Controller) setTypingStatus(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[SetTypingStatusRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	if err := ctl.service.SetTypingStatus(c.UserContext(), chatID, claims.UserID, payload); err != nil {
		return err
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

func (ctl *Controller) getTypingSessions(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	response, err := ctl.service.GetTypingSessions(c.UserContext(), chatID, claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

// ============================================================================
// PINNED MESSAGE HANDLERS
// ============================================================================

func (ctl *Controller) pinMessage(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[PinMessageRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.PinMessage(c.UserContext(), chatID, claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) unpinMessage(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	messageID, err := httpx.UUIDParam(c, "messageId")
	if err != nil {
		return err
	}
	payload := UnpinMessageRequest{MessageID: messageID}
	if err := ctl.service.UnpinMessage(c.UserContext(), chatID, claims.UserID, payload); err != nil {
		return err
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

func (ctl *Controller) getPinnedMessages(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	chatID, err := httpx.UUIDParam(c, "chatId")
	if err != nil {
		return err
	}
	response, err := ctl.service.GetPinnedMessages(c.UserContext(), chatID, claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}
