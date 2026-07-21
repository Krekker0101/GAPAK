package websocket

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	fastws "github.com/fasthttp/websocket"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

// Service handles WebSocket connections and real-time messaging.
type Service struct {
	connections     *ConnectionRegistry
	redis           *redis.Client
	messageService  MessageService
	presenceService PresenceService
	authService     AuthService
	logger          zerolog.Logger
}

// ConnectionRegistry manages active WebSocket connections keyed by device ID.
type ConnectionRegistry struct {
	connections map[string]*Connection // device_id -> Connection
	mu          sync.RWMutex
}

// Connection represents a WebSocket connection.
type Connection struct {
	UserID        string
	DeviceID      string
	Conn          *fiberws.Conn
	Send          chan []byte
	Subscriptions map[string]bool // chat_id -> subscribed
	CreatedAt     time.Time
	LastPing      time.Time
	mu            sync.Mutex
}

// MessageService interface for message operations.
type MessageService interface {
	GetMessage(ctx context.Context, userID, id string) (interface{}, error)
	GetMessages(ctx context.Context, userID, chatID string, limit int, before *time.Time) ([]interface{}, error)
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
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// NewService creates a new WebSocket service.
func NewService(
	redis *redis.Client,
	messageService MessageService,
	presenceService PresenceService,
	authService AuthService,
	logger zerolog.Logger,
) *Service {
	return &Service{
		connections:     &ConnectionRegistry{connections: make(map[string]*Connection)},
		redis:           redis,
		messageService:  messageService,
		presenceService: presenceService,
		authService:     authService,
		logger:          logger,
	}
}

// HandleConnection handles a new WebSocket connection.
func (s *Service) HandleConnection(c *fiberws.Conn) {
	ctx := context.Background()
	defer c.Close()

	// Wait for authentication message.
	var authMsg WebSocketMessage
	if err := c.ReadJSON(&authMsg); err != nil {
		s.logger.Error().Err(err).Msg("failed to read auth message")
		return
	}

	if authMsg.Type != "auth" {
		s.logger.Warn().Str("type", authMsg.Type).Msg("expected auth message first")
		_ = c.WriteJSON(WebSocketMessage{Type: "error", Data: "authentication required"})
		return
	}

	authData, ok := authMsg.Data.(map[string]interface{})
	if !ok {
		_ = c.WriteJSON(WebSocketMessage{Type: "error", Data: "invalid auth data"})
		return
	}

	token, ok := authData["token"].(string)
	if !ok {
		_ = c.WriteJSON(WebSocketMessage{Type: "error", Data: "token required"})
		return
	}

	userID, err := s.authService.ValidateToken(ctx, token)
	if err != nil {
		s.logger.Error().Err(err).Msg("authentication failed")
		_ = c.WriteJSON(WebSocketMessage{Type: "error", Data: "authentication failed"})
		return
	}

	deviceID, _ := authData["device_id"].(string)
	if deviceID == "" {
		deviceID = generateDeviceID()
	}

	connection := &Connection{
		UserID:        userID,
		DeviceID:      deviceID,
		Conn:          c,
		Send:          make(chan []byte, 256),
		Subscriptions: make(map[string]bool),
		CreatedAt:     time.Now(),
		LastPing:      time.Now(),
	}

	s.connections.Register(connection)
	defer s.connections.Unregister(connection.DeviceID)

	if err := s.presenceService.SetOnline(ctx, userID, deviceID); err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("failed to set online")
	}
	defer func() {
		if err := s.presenceService.SetOffline(ctx, userID, deviceID); err != nil {
			s.logger.Error().Err(err).Str("user_id", userID).Msg("failed to set offline")
		}
	}()

	go s.writePump(connection)
	s.readPump(ctx, connection)
}

func (s *Service) readPump(ctx context.Context, conn *Connection) {
	defer conn.Conn.Close()

	conn.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.Conn.SetPongHandler(func(string) error {
		conn.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		conn.LastPing = time.Now()
		return nil
	})

	for {
		_, message, err := conn.Conn.ReadMessage()
		if err != nil {
			if fastws.IsUnexpectedCloseError(err, fastws.CloseGoingAway, fastws.CloseAbnormalClosure) {
				s.logger.Error().Err(err).Str("user_id", conn.UserID).Msg("unexpected close error")
			}
			break
		}

		var wsMsg WebSocketMessage
		if err := json.Unmarshal(message, &wsMsg); err != nil {
			s.logger.Error().Err(err).Msg("failed to unmarshal message")
			continue
		}

		if err := s.handleMessage(ctx, conn, &wsMsg); err != nil {
			s.logger.Error().Err(err).Str("type", wsMsg.Type).Msg("failed to handle message")
			conn.Send <- []byte(fmt.Sprintf(`{"type":"error","data":"%s"}`, err.Error()))
		}
	}
}

func (s *Service) writePump(conn *Connection) {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		conn.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-conn.Send:
			conn.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = conn.Conn.WriteMessage(fiberws.CloseMessage, []byte{})
				return
			}

			if err := conn.Conn.WriteMessage(fiberws.TextMessage, message); err != nil {
				s.logger.Error().Err(err).Str("user_id", conn.UserID).Msg("failed to write message")
				return
			}

		case <-ticker.C:
			conn.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.Conn.WriteMessage(fiberws.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (s *Service) handleMessage(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	switch msg.Type {
	case "subscribe":
		return s.handleSubscribe(ctx, conn, msg)
	case "unsubscribe":
		return s.handleUnsubscribe(ctx, conn, msg)
	case "message":
		return s.handleSendMessage(ctx, conn, msg)
	case "read_receipt":
		return s.handleReadReceipt(ctx, conn, msg)
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

	conn.mu.Lock()
	conn.Subscriptions[chatID] = true
	conn.mu.Unlock()

	messages, err := s.messageService.GetMessages(ctx, conn.UserID, chatID, 50, nil)
	if err != nil {
		s.logger.Error().Err(err).Str("chat_id", chatID).Msg("failed to get messages")
		return err
	}

	response := WebSocketMessage{
		Type: "history",
		Data: messages,
	}

	dataBytes, err := json.Marshal(response)
	if err != nil {
		return err
	}

	conn.Send <- dataBytes

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
	// For now, just acknowledge. Sending messages through WebSocket will be
	// wired to the chat service in a follow-up.
	response := WebSocketMessage{
		Type: "ack",
		Data: map[string]string{"status": "received"},
	}

	dataBytes, err := json.Marshal(response)
	if err != nil {
		return err
	}

	conn.Send <- dataBytes
	return nil
}

func (s *Service) handleReadReceipt(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		return errors.New("invalid read receipt data")
	}

	messageID, ok := data["message_id"].(string)
	if !ok {
		return errors.New("message_id required")
	}

	s.logger.Info().
		Str("user_id", conn.UserID).
		Str("message_id", messageID).
		Msg("read receipt received")

	return nil
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

	s.broadcastToChat(ctx, chatID, WebSocketMessage{
		Type: "typing",
		Data: map[string]interface{}{
			"user_id":   conn.UserID,
			"chat_id":   chatID,
			"is_typing": isTyping,
		},
	}, conn.UserID)

	return nil
}

func (s *Service) broadcastToChat(ctx context.Context, chatID string, msg WebSocketMessage, excludeUserID string) {
	dataBytes, err := json.Marshal(msg)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to marshal broadcast message")
		return
	}

	s.connections.mu.RLock()
	defer s.connections.mu.RUnlock()

	for _, conn := range s.connections.connections {
		if conn.UserID == excludeUserID {
			continue
		}

		conn.mu.Lock()
		subscribed := conn.Subscriptions[chatID]
		conn.mu.Unlock()

		if subscribed {
			select {
			case conn.Send <- dataBytes:
			default:
				s.logger.Warn().Str("user_id", conn.UserID).Msg("connection send buffer full")
			}
		}
	}
}

func (cr *ConnectionRegistry) Register(conn *Connection) {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	cr.connections[conn.DeviceID] = conn
}

func (cr *ConnectionRegistry) Unregister(deviceID string) {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	if conn, ok := cr.connections[deviceID]; ok {
		close(conn.Send)
		delete(cr.connections, deviceID)
	}
}

func (cr *ConnectionRegistry) Get(deviceID string) (*Connection, bool) {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	conn, ok := cr.connections[deviceID]
	return conn, ok
}

func generateDeviceID() string {
	return fmt.Sprintf("device_%d", time.Now().UnixNano())
}
