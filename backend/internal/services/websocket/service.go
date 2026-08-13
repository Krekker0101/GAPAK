package websocket

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	fastws "github.com/fasthttp/websocket"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"

	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/observability"
)

const (
	maxConnectionsPerUser    = 5
	maxWebSocketMessageBytes = 1 << 20
	maxSubscriptionsPerConn  = 100
	maxSendQueueDepth        = 256
	writeTimeout             = 10 * time.Second
	inboundRateWindow        = time.Second
	inboundRateBurst         = 60
)

var (
	authTimeout  = 10 * time.Second
	readTimeout  = 65 * time.Second
	pingInterval = 30 * time.Second
)

// Service handles WebSocket connections and real-time messaging.
type Service struct {
	connections     *ConnectionRegistry
	redis           *redis.Client
	messageService  MessageService
	presenceService PresenceService
	authService     AuthService
	logger          zerolog.Logger
	metrics         *observability.Registry
	stopOnce        sync.Once
	stopFunc        context.CancelFunc
}

// ConnectionRegistry manages active WebSocket connections keyed by device ID.
type ConnectionRegistry struct {
	connections map[string]*Connection // connection_id -> Connection
	mu          sync.RWMutex
}

func (cr *ConnectionRegistry) snapshot() []*Connection {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	out := make([]*Connection, 0, len(cr.connections))
	for _, conn := range cr.connections {
		out = append(out, conn)
	}
	return out
}

// Connection represents a WebSocket connection.
type Connection struct {
	ID            string
	UserID        string
	DeviceID      string
	Conn          *fiberws.Conn
	Send          chan []byte
	Subscriptions map[string]bool // chat_id -> subscribed
	CreatedAt     time.Time
	LastPing      time.Time
	mu            sync.Mutex
	closeOnce     sync.Once
	done          chan struct{}
	seenEvents    map[string]time.Time
	rateMu        sync.Mutex
	rateWindow    time.Time
	rateCount     int
}

// MessageService interface for message operations.
type MessageService interface {
	GetMessage(ctx context.Context, userID, id string) (interface{}, error)
	GetMessages(ctx context.Context, userID, chatID string, limit int, before *time.Time) ([]interface{}, error)
	GetMessagesAfterSequence(ctx context.Context, userID, chatID string, afterSequence int64, limit int) ([]interface{}, error)
	SendMessage(ctx context.Context, userID, chatID string, data map[string]interface{}) (interface{}, error)
	MarkAsRead(ctx context.Context, userID, chatID, messageID string) (interface{}, error)
	MarkAsDelivered(ctx context.Context, userID, chatID, messageID string) (interface{}, error)
	AssertChatAccess(ctx context.Context, userID, chatID string) error
	ListChatMemberIDs(ctx context.Context, userID, chatID string) ([]string, error)
	ValidateDevice(ctx context.Context, userID, deviceID string) error
	ValidateSession(ctx context.Context, userID, sessionID string) error
}

// PresenceService interface for presence operations.
type PresenceService interface {
	SetOnline(ctx context.Context, userID, deviceID string) error
	SetOffline(ctx context.Context, userID, deviceID string) error
	IsOnline(ctx context.Context, userID string) (bool, error)
}

// AuthService interface for authentication.
type AuthService interface {
	ValidateToken(ctx context.Context, token string) (string, error)
}

// WebSocketMessage represents a WebSocket message.
type WebSocketMessage struct {
	ID     string      `json:"id,omitempty"`
	Type   string      `json:"type"`
	Data   interface{} `json:"data"`
	AckFor string      `json:"ackFor,omitempty"`
}

type realtimeEnvelope struct {
	EventID         string `json:"eventId"`
	Type            string `json:"type"`
	ChatID          string `json:"chatId"`
	MessageID       string `json:"messageId,omitempty"`
	SenderID        string `json:"senderId,omitempty"`
	SenderDeviceID  string `json:"senderDeviceId,omitempty"`
	Sequence        int64  `json:"sequence,omitempty"`
	ClientMessageID string `json:"clientMessageId,omitempty"`
	Data            any    `json:"data,omitempty"`
}

// NewService creates a new WebSocket service.
func NewService(
	redis *redis.Client,
	messageService MessageService,
	presenceService PresenceService,
	authService AuthService,
	logger zerolog.Logger,
	metrics *observability.Registry,
) *Service {
	return &Service{
		connections:     &ConnectionRegistry{connections: make(map[string]*Connection)},
		redis:           redis,
		messageService:  messageService,
		presenceService: presenceService,
		authService:     authService,
		logger:          logger,
		metrics:         metrics,
	}
}

// Start launches the instance-local Redis realtime subscriber. Durable chat
// events are written to PostgreSQL first and relayed by the worker. Redis is
// only a fan-out transport; reconnecting clients recover from PostgreSQL.
func (s *Service) Start(ctx context.Context) {
	if s.redis == nil || s.stopFunc != nil {
		return
	}
	runCtx, cancel := context.WithCancel(ctx)
	s.stopFunc = cancel
	go s.redisSubscribeLoop(runCtx)
}

// Stop closes active connections with the standard WebSocket Going Away code
// and stops the instance-local Redis subscriber.
func (s *Service) Stop(ctx context.Context) {
	s.stopOnce.Do(func() {
		if s.stopFunc != nil {
			s.stopFunc()
		}
		for _, conn := range s.connections.snapshot() {
			conn.close(fastws.CloseGoingAway, "server shutdown")
		}
	})
	select {
	case <-ctx.Done():
	case <-time.After(10 * time.Millisecond):
	}
}

func (s *Service) redisSubscribeLoop(ctx context.Context) {
	for ctx.Err() == nil {
		pubsub := s.redis.PSubscribe(ctx, "chat:*", "notifications:*")
		_, err := pubsub.Receive(ctx)
		if err != nil {
			_ = pubsub.Close()
			if !sleepContext(ctx, time.Second) {
				return
			}
			continue
		}
		for {
			msg, err := pubsub.ReceiveMessage(ctx)
			if err != nil {
				_ = pubsub.Close()
				if ctx.Err() == nil {
					_ = sleepContext(ctx, time.Second)
				}
				break
			}
			var event realtimeEnvelope
			if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
				s.logger.Warn().Err(err).Msg("invalid realtime event payload")
				continue
			}
			s.handleRealtimeEvent(ctx, event)
		}
	}
}

func sleepContext(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

func (s *Service) handleRealtimeEvent(ctx context.Context, event realtimeEnvelope) {
	if event.EventID == "" {
		return
	}
	isNotification := strings.HasPrefix(event.Type, "notification.")
	if event.ChatID == "" && !isNotification {
		return
	}
	for _, conn := range s.connections.snapshot() {
		if event.EventID != "" && s.markEventSeen(conn, event.EventID) {
			continue
		}
		if !isNotification && !s.isSubscribed(conn, event.ChatID) {
			continue
		}
		if isNotification {
			if !s.isAuthorizedRealtimeRecipient(conn, event) {
				continue
			}
		} else if event.Type != "chat.message.created" {
			if !s.isAuthorizedRealtimeRecipient(conn, event) {
				continue
			}
		}
		// The sending connection already receives a durable ACK. Other devices
		// of the same user still receive the event for multi-device sync.
		if event.SenderID == conn.UserID && event.SenderDeviceID != "" && event.SenderDeviceID == conn.DeviceID {
			continue
		}
		dataPayload := event.Data
		if event.Type == "chat.read_receipt" {
			if envelope, ok := event.Data.(map[string]interface{}); ok {
				dataPayload = envelope["receipt"]
			}
		}
		data := WebSocketMessage{ID: event.EventID, Type: event.Type, Data: dataPayload}
		if (event.Type == "chat.message.created" || event.Type == "chat.message.edited" || event.Type == "chat.message.deleted") && event.Data == nil {
			message, err := s.messageService.GetMessage(ctx, conn.UserID, event.MessageID)
			if err != nil {
				continue
			}
			data.Data = message
		}
		if err := s.enqueue(conn, data); err != nil {
			if s.metrics != nil {
				s.metrics.WSSlowConsumers.Inc(observability.Label("event", "queue_full"))
			}
			conn.close(fastws.CloseTryAgainLater, "slow consumer")
		}
	}
}

func (s *Service) markEventSeen(conn *Connection, eventID string) bool {
	now := time.Now()
	conn.mu.Lock()
	defer conn.mu.Unlock()
	for id, seenAt := range conn.seenEvents {
		if now.Sub(seenAt) > 10*time.Minute {
			delete(conn.seenEvents, id)
		}
	}
	if _, exists := conn.seenEvents[eventID]; exists {
		return true
	}
	if len(conn.seenEvents) >= 2048 {
		var oldestID string
		var oldest time.Time
		for id, seenAt := range conn.seenEvents {
			if oldestID == "" || seenAt.Before(oldest) {
				oldestID, oldest = id, seenAt
			}
		}
		if oldestID != "" {
			delete(conn.seenEvents, oldestID)
		}
	}
	conn.seenEvents[eventID] = now
	return false
}

func (s *Service) isAuthorizedRealtimeRecipient(conn *Connection, event realtimeEnvelope) bool {
	if recipients, ok := event.Data.(map[string]interface{}); ok {
		raw, exists := recipients["recipient_user_ids"]
		if !exists {
			return false
		}
		switch ids := raw.(type) {
		case []interface{}:
			for _, item := range ids {
				if id, ok := item.(string); ok && id == conn.UserID {
					return true
				}
			}
		case []string:
			for _, id := range ids {
				if id == conn.UserID {
					return true
				}
			}
		}
	}
	return false
}

func (s *Service) isSubscribed(conn *Connection, chatID string) bool {
	conn.mu.Lock()
	defer conn.mu.Unlock()
	return conn.Subscriptions[chatID]
}

// HandleConnection handles a new WebSocket connection.
func (s *Service) HandleConnection(c *fiberws.Conn) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	authCtx, authCancel := context.WithTimeout(ctx, authTimeout)
	userID, deviceID := s.authenticateConnection(authCtx, c)
	authCancel()
	if userID == "" {
		return
	}

	connection := &Connection{
		ID:            generateConnectionID(),
		UserID:        userID,
		DeviceID:      deviceID,
		Conn:          c,
		Send:          make(chan []byte, maxSendQueueDepth),
		Subscriptions: make(map[string]bool),
		CreatedAt:     time.Now().UTC(),
		LastPing:      time.Now().UTC(),
		done:          make(chan struct{}),
		seenEvents:    make(map[string]time.Time),
	}

	if !s.connections.Register(connection) {
		_ = c.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(fastws.ClosePolicyViolation, "connection limit reached"), time.Now().Add(time.Second))
		return
	}
	defer s.connections.Unregister(connection.ID)
	if s.metrics != nil {
		s.metrics.WSConnections.Inc(observability.Label("event", "connected"))
		s.metrics.WSActiveConnections.Set(observability.Label("scope", "instance"), int64(len(s.connections.snapshot())))
	}
	defer func() {
		if s.metrics != nil {
			s.metrics.WSDisconnects.Inc(observability.Label("reason", "closed"))
		}
	}()

	if err := s.presenceService.SetOnline(ctx, userID, connection.ID); err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("failed to set online")
	}
	defer func() {
		if err := s.presenceService.SetOffline(ctx, userID, connection.ID); err != nil {
			s.logger.Error().Err(err).Str("user_id", userID).Msg("failed to set offline")
		}
	}()

	go s.writePump(connection)
	s.readPump(ctx, connection)
	connection.close(fastws.CloseNormalClosure, "connection closed")
}

func (s *Service) authenticateConnection(ctx context.Context, c *fiberws.Conn) (userID, deviceID string) {
	if uid, ok := c.Locals("userId").(string); ok && uid != "" {
		if sessionID, ok := c.Locals("sessionId").(string); ok && sessionID != "" {
			if err := s.messageService.ValidateSession(ctx, uid, sessionID); err != nil {
				_ = c.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(fastws.ClosePolicyViolation, "session invalid"), time.Now().Add(time.Second))
				return "", ""
			}
			return uid, "session:" + sessionID
		}
	}

	// No browser/query/header credentials reached the upgrade middleware.
	// Require an explicit first-frame auth message within authTimeout.
	_ = c.SetReadDeadline(time.Now().Add(authTimeout))
	var authMsg WebSocketMessage
	if err := c.ReadJSON(&authMsg); err != nil {
		if ctx.Err() != nil {
			_ = c.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(fastws.ClosePolicyViolation, "authentication timeout"), time.Now().Add(time.Second))
		} else {
			_ = c.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(fastws.CloseProtocolError, "invalid authentication frame"), time.Now().Add(time.Second))
		}
		return "", ""
	}

	if authMsg.Type != "auth" {
		_ = c.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(fastws.ClosePolicyViolation, "authentication required"), time.Now().Add(time.Second))
		return "", ""
	}
	authData, ok := authMsg.Data.(map[string]interface{})
	if !ok {
		_ = c.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(fastws.CloseProtocolError, "invalid auth data"), time.Now().Add(time.Second))
		return "", ""
	}
	token, ok := authData["token"].(string)
	if !ok || strings.TrimSpace(token) == "" {
		_ = c.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(fastws.ClosePolicyViolation, "token required"), time.Now().Add(time.Second))
		return "", ""
	}
	did, ok := authData["device_id"].(string)
	if !ok || strings.TrimSpace(did) == "" {
		_ = c.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(fastws.ClosePolicyViolation, "device_id required"), time.Now().Add(time.Second))
		return "", ""
	}
	uid, err := s.authenticateFirstFrame(ctx, token, did)
	if err != nil {
		_ = c.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(fastws.ClosePolicyViolation, err.Error()), time.Now().Add(time.Second))
		return "", ""
	}
	return uid, did
}

func (s *Service) authenticateFirstFrame(ctx context.Context, token, deviceID string) (string, error) {
	uid, err := s.authService.ValidateToken(ctx, token)
	if err != nil {
		return "", errors.New("authentication failed")
	}
	if err := s.messageService.ValidateDevice(ctx, uid, deviceID); err != nil {
		return "", errors.New("invalid device")
	}
	return uid, nil
}

func (s *Service) readPump(ctx context.Context, conn *Connection) {
	defer conn.Conn.Close()

	conn.Conn.SetReadLimit(maxWebSocketMessageBytes)
	conn.Conn.SetReadDeadline(time.Now().Add(readTimeout))
	conn.Conn.SetPongHandler(func(string) error {
		conn.Conn.SetReadLimit(maxWebSocketMessageBytes)
		conn.Conn.SetReadDeadline(time.Now().Add(readTimeout))
		conn.LastPing = time.Now()
		return nil
	})

	for {
		_, message, err := conn.Conn.ReadMessage()
		if err != nil {
			if s.metrics != nil {
				s.metrics.WSErrors.Inc(observability.Label("event", "read_error"))
			}
			if fastws.IsUnexpectedCloseError(err, fastws.CloseGoingAway, fastws.CloseAbnormalClosure) {
				s.logger.Error().Err(err).Str("user_id", conn.UserID).Msg("unexpected close error")
			}
			break
		}

		if len(message) > maxWebSocketMessageBytes {
			_ = conn.Conn.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(fastws.CloseMessageTooBig, "message too large"), time.Now().Add(time.Second))
			break
		}

		if !conn.allowInboundFrame() {
			_ = conn.Conn.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(fastws.CloseTryAgainLater, "rate limit exceeded"), time.Now().Add(time.Second))
			break
		}

		var wsMsg WebSocketMessage
		if s.metrics != nil {
			s.metrics.WSMessages.Inc(observability.Label("direction", "inbound"))
		}

		if err := json.Unmarshal(message, &wsMsg); err != nil {
			_ = s.enqueue(conn, WebSocketMessage{Type: "error", Data: map[string]interface{}{"code": "INVALID_JSON", "message": "invalid JSON frame"}})
			continue
		}

		if err := s.handleMessage(ctx, conn, &wsMsg); err != nil {
			if s.metrics != nil {
				s.metrics.WSErrors.Inc(observability.Label("event", "message_error"))
			}
			s.logger.Error().Err(err).Str("type", wsMsg.Type).Msg("failed to handle message")
			publicErr := apperrors.As(err)
			message := publicErr.Message
			if publicErr.Status >= 500 {
				message = "Request could not be processed"
			}
			_ = s.enqueue(conn, WebSocketMessage{Type: "error", Data: map[string]interface{}{"code": publicErr.Code, "message": message}})
		}
	}
}

func (s *Service) writePump(conn *Connection) {
	ticker := time.NewTicker(pingInterval)
	defer func() {
		ticker.Stop()
		conn.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-conn.Send:
			conn.Conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			if !ok {
				_ = conn.Conn.WriteMessage(fiberws.CloseMessage, []byte{})
				return
			}

			if s.metrics != nil {
				s.metrics.WSMessages.Inc(observability.Label("direction", "outbound"))
			}
			if err := conn.Conn.WriteMessage(fiberws.TextMessage, message); err != nil {
				s.logger.Error().Err(err).Str("user_id", conn.UserID).Msg("failed to write message")
				return
			}

		case <-ticker.C:
			conn.Conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			if err := conn.Conn.WriteMessage(fiberws.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (s *Service) handleMessage(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	switch msg.Type {
	case "auth":
		// Duplicate auth frames on an already-authenticated connection are ignored.
		// Treat duplicate auth frames as idempotent so they do not poison the
		// connection with an unknown-message error.
		return nil
	case "subscribe":
		return s.handleSubscribe(ctx, conn, msg)
	case "unsubscribe":
		return s.handleUnsubscribe(ctx, conn, msg)
	case "message":
		return s.handleSendMessage(ctx, conn, msg)
	case "read_receipt":
		return s.handleReadReceipt(ctx, conn, msg)
	case "delivery_ack":
		return s.handleDeliveryAck(ctx, conn, msg)
	case "typing":
		return s.handleTyping(ctx, conn, msg)
	default:
		return fmt.Errorf("unknown message type: %s", msg.Type)
	}
}

func (s *Service) handleSubscribe(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		return errors.New("invalid subscription data")
	}

	chatID, ok := data["chat_id"].(string)
	if !ok {
		return errors.New("chat_id required")
	}

	if err := s.messageService.AssertChatAccess(ctx, conn.UserID, chatID); err != nil {
		return err
	}

	conn.mu.Lock()
	if conn.Subscriptions[chatID] {
		conn.mu.Unlock()
		return nil
	}
	if len(conn.Subscriptions) >= maxSubscriptionsPerConn {
		conn.mu.Unlock()
		return errors.New("subscription limit reached")
	}
	// Reserve the subscription before the history query so concurrent duplicate
	// subscribe frames cannot both pass the check and enqueue duplicate history.
	conn.Subscriptions[chatID] = true
	conn.mu.Unlock()

	var (
		messages []interface{}
		err      error
	)
	if raw, ok := data["after_sequence"]; ok {
		sequence, ok := parseSequence(raw)
		if !ok || sequence < 0 {
			return errors.New("after_sequence must be a non-negative integer")
		}
		messages, err = s.messageService.GetMessagesAfterSequence(ctx, conn.UserID, chatID, sequence, 100)
	} else {
		messages, err = s.messageService.GetMessages(ctx, conn.UserID, chatID, 50, nil)
	}
	if err != nil {
		conn.mu.Lock()
		delete(conn.Subscriptions, chatID)
		conn.mu.Unlock()
		s.logger.Error().Err(err).Str("chat_id", chatID).Msg("failed to recover chat messages")
		return err
	}

	response := WebSocketMessage{
		ID:   generateConnectionID(),
		Type: "history",
		Data: messages,
	}

	dataBytes, err := json.Marshal(response)
	if err != nil {
		return err
	}

	if !s.enqueueRaw(conn, dataBytes) {
		return errors.New("connection is overloaded")
	}

	s.logger.Info().
		Str("user_id", conn.UserID).
		Str("chat_id", chatID).
		Msg("user subscribed to chat")

	return nil
}

func (s *Service) handleUnsubscribe(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		return errors.New("invalid unsubscription data")
	}

	chatID, ok := data["chat_id"].(string)
	if !ok {
		return errors.New("chat_id required")
	}

	conn.mu.Lock()
	delete(conn.Subscriptions, chatID)
	conn.mu.Unlock()

	s.logger.Info().
		Str("user_id", conn.UserID).
		Str("chat_id", chatID).
		Msg("user unsubscribed from chat")

	return nil
}

func (s *Service) handleSendMessage(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		return errors.New("invalid message data")
	}
	chatID, ok := data["chat_id"].(string)
	if !ok || chatID == "" {
		return errors.New("chat_id required")
	}

	created, err := s.messageService.SendMessage(ctx, conn.UserID, chatID, data)
	if err != nil {
		return err
	}

	clientMessageID := ""
	if value, ok := data["client_message_id"].(string); ok {
		clientMessageID = value
	}
	if clientMessageID == "" {
		if value, ok := data["clientMessageId"].(string); ok {
			clientMessageID = value
		}
	}
	return s.enqueue(conn, WebSocketMessage{
		ID:     generateConnectionID(),
		AckFor: msg.ID,
		Type:   "ack",
		Data:   map[string]interface{}{"status": "accepted", "message": created, "client_message_id": clientMessageID},
	})
}

func (s *Service) handleReadReceipt(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		return errors.New("invalid read receipt data")
	}

	messageID, ok := data["message_id"].(string)
	if !ok || messageID == "" {
		return errors.New("message_id required")
	}
	chatID, ok := data["chat_id"].(string)
	if !ok || chatID == "" {
		return errors.New("chat_id required")
	}

	receipt, err := s.messageService.MarkAsRead(ctx, conn.UserID, chatID, messageID)
	if err != nil {
		return err
	}
	recipients, err := s.messageService.ListChatMemberIDs(ctx, conn.UserID, chatID)
	if err != nil {
		return err
	}
	event := realtimeEnvelope{
		EventID:        generateConnectionID(),
		Type:           "chat.read_receipt",
		ChatID:         chatID,
		SenderID:       conn.UserID,
		SenderDeviceID: conn.DeviceID,
		Data: map[string]interface{}{
			"receipt":            receipt,
			"recipient_user_ids": recipients,
		},
	}
	if err := s.publishEphemeral(ctx, event); err != nil {
		s.handleRealtimeEvent(ctx, event)
	}
	return s.enqueue(conn, WebSocketMessage{ID: generateConnectionID(), AckFor: msg.ID, Type: "read_receipt_ack", Data: receipt})
}

func (s *Service) handleDeliveryAck(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		return errors.New("invalid delivery ack data")
	}
	messageID, ok := data["message_id"].(string)
	if !ok || messageID == "" {
		if value, ok := data["messageId"].(string); ok {
			messageID = value
		}
	}
	chatID, ok := data["chat_id"].(string)
	if !ok || chatID == "" {
		if value, ok := data["chatId"].(string); ok {
			chatID = value
		}
	}
	if messageID == "" || chatID == "" {
		return errors.New("message_id and chat_id required")
	}
	receipt, err := s.messageService.MarkAsDelivered(ctx, conn.UserID, chatID, messageID)
	if err != nil {
		return err
	}
	return s.enqueue(conn, WebSocketMessage{ID: generateConnectionID(), AckFor: msg.ID, Type: "delivery_ack", Data: receipt})
}

func (s *Service) handleTyping(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		return errors.New("invalid typing data")
	}

	chatID, ok := data["chat_id"].(string)
	if !ok {
		return errors.New("chat_id required")
	}

	isTyping, ok := data["is_typing"].(bool)
	if !ok {
		return errors.New("is_typing required")
	}
	if err := s.messageService.AssertChatAccess(ctx, conn.UserID, chatID); err != nil {
		return err
	}
	recipients, err := s.messageService.ListChatMemberIDs(ctx, conn.UserID, chatID)
	if err != nil {
		return err
	}

	event := realtimeEnvelope{
		EventID:        generateConnectionID(),
		Type:           "chat.typing",
		ChatID:         chatID,
		SenderID:       conn.UserID,
		SenderDeviceID: conn.DeviceID,
		Data: map[string]interface{}{
			"user_id":            conn.UserID,
			"chat_id":            chatID,
			"is_typing":          isTyping,
			"recipient_user_ids": recipients,
		},
	}
	if err := s.publishEphemeral(ctx, event); err != nil {
		// Redis is transport only. Preserve local realtime when it is unavailable.
		s.handleRealtimeEvent(ctx, event)
	}
	return nil
}

func (s *Service) publishEphemeral(ctx context.Context, event realtimeEnvelope) error {
	if s.redis == nil {
		return errors.New("redis unavailable")
	}
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return s.redis.Publish(ctx, event.ChatIDChannel(), payload).Err()
}

func (e realtimeEnvelope) ChatIDChannel() string { return "chat:" + e.ChatID }

func (s *Service) enqueue(conn *Connection, msg WebSocketMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	if !s.enqueueRaw(conn, data) {
		return errors.New("connection send buffer full")
	}
	return nil
}

func (s *Service) enqueueRaw(conn *Connection, data []byte) bool {
	select {
	case <-conn.done:
		return false
	default:
	}
	select {
	case conn.Send <- data:
		return true
	default:
		return false
	}
}

func (c *Connection) close(code int, reason string) {
	c.closeOnce.Do(func() {
		close(c.done)
		_ = c.Conn.WriteControl(fastws.CloseMessage, fastws.FormatCloseMessage(code, reason), time.Now().Add(time.Second))
		_ = c.Conn.Close()
	})
}

func (cr *ConnectionRegistry) Register(conn *Connection) bool {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	count := 0
	for _, existing := range cr.connections {
		if existing.UserID == conn.UserID {
			count++
		}
	}
	if count >= maxConnectionsPerUser {
		return false
	}
	cr.connections[conn.ID] = conn
	return true
}

func (cr *ConnectionRegistry) Unregister(connectionID string) {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	if _, ok := cr.connections[connectionID]; ok {
		delete(cr.connections, connectionID)
	}
}

func (cr *ConnectionRegistry) Get(deviceID string) (*Connection, bool) {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	conn, ok := cr.connections[deviceID]
	return conn, ok
}

func parseSequence(value interface{}) (int64, bool) {
	switch v := value.(type) {
	case float64:
		if v != float64(int64(v)) {
			return 0, false
		}
		return int64(v), true
	case string:
		n, err := strconv.ParseInt(v, 10, 64)
		return n, err == nil
	case int64:
		return v, true
	default:
		return 0, false
	}
}

func generateConnectionID() string {
	return "conn_" + uuid.NewString()
}

func (c *Connection) allowInboundFrame() bool {
	now := time.Now()
	c.rateMu.Lock()
	defer c.rateMu.Unlock()
	if c.rateWindow.IsZero() || now.Sub(c.rateWindow) >= inboundRateWindow {
		c.rateWindow = now
		c.rateCount = 0
	}
	if c.rateCount >= inboundRateBurst {
		return false
	}
	c.rateCount++
	return true
}
