package websocket

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

// Service handles WebSocket connections and real-time messaging
type Service struct {
	upgrader        websocket.Upgrader
	connections     *ConnectionRegistry
	redis           *redis.Client
	messageService  MessageService
	presenceService PresenceService
	authService     AuthService
	logger          *zerolog.Logger
}

// ConnectionRegistry manages active WebSocket connections
type ConnectionRegistry struct {
	connections map[string]*Connection // user_id -> Connection
	mu          sync.RWMutex
}

// Connection represents a WebSocket connection
type Connection struct {
	UserID        string
	DeviceID      string
	Conn          *websocket.Conn
	Send          chan []byte
	Subscriptions map[string]bool // chat_id -> subscribed
	CreatedAt     time.Time
	LastPing      time.Time
	mu            sync.Mutex
}

// MessageService interface for message operations
type MessageService interface {
	GetMessage(ctx context.Context, id string) (interface{}, error)
	GetMessages(ctx context.Context, chatID string, limit int, before *time.Time) ([]interface{}, error)
}

// PresenceService interface for presence operations
type PresenceService interface {
	SetOnline(ctx context.Context, userID, deviceID string) error
	SetOffline(ctx context.Context, userID, deviceID string) error
	IsOnline(ctx context.Context, userID string) (bool, error)
}

// AuthService interface for authentication
type AuthService interface {
	ValidateToken(ctx context.Context, token string) (string, error)
}

// WebSocketMessage represents a WebSocket message
type WebSocketMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// NewService creates a new WebSocket service
func NewService(
	redis *redis.Client,
	messageService MessageService,
	presenceService PresenceService,
	authService AuthService,
	logger *zerolog.Logger,
) *Service {
	return &Service{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return r.Header.Get("Origin") == ""
			},
		},
		connections:     &ConnectionRegistry{connections: make(map[string]*Connection)},
		redis:           redis,
		messageService:  messageService,
		presenceService: presenceService,
		authService:     authService,
		logger:          logger,
	}
}

// HandleConnection handles a new WebSocket connection
func (s *Service) HandleConnection(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to upgrade connection")
		return
	}
	defer conn.Close()

	// Wait for authentication message
	var authMsg WebSocketMessage
	if err := conn.ReadJSON(&authMsg); err != nil {
		s.logger.Error().Err(err).Msg("failed to read auth message")
		return
	}

	if authMsg.Type != "auth" {
		s.logger.Warn().Str("type", authMsg.Type).Msg("expected auth message first")
		conn.WriteJSON(WebSocketMessage{Type: "error", Data: "authentication required"})
		return
	}

	// Validate token
	authData, ok := authMsg.Data.(map[string]interface{})
	if !ok {
		conn.WriteJSON(WebSocketMessage{Type: "error", Data: "invalid auth data"})
		return
	}

	token, ok := authData["token"].(string)
	if !ok {
		conn.WriteJSON(WebSocketMessage{Type: "error", Data: "token required"})
		return
	}

	userID, err := s.authService.ValidateToken(r.Context(), token)
	if err != nil {
		s.logger.Error().Err(err).Msg("authentication failed")
		conn.WriteJSON(WebSocketMessage{Type: "error", Data: "authentication failed"})
		return
	}

	deviceID, _ := authData["device_id"].(string)
	if deviceID == "" {
		deviceID = generateDeviceID()
	}

	// Create connection
	connection := &Connection{
		UserID:        userID,
		DeviceID:      deviceID,
		Conn:          conn,
		Send:          make(chan []byte, 256),
		Subscriptions: make(map[string]bool),
		CreatedAt:     time.Now(),
		LastPing:      time.Now(),
	}

	// Register connection
	s.connections.Register(userID, connection)
	defer s.connections.Unregister(userID)

	// Set user online
	if err := s.presenceService.SetOnline(r.Context(), userID, deviceID); err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("failed to set online")
	}
	defer func() {
		s.presenceService.SetOffline(r.Context(), userID, deviceID)
	}()

	// Start read/write pumps
	go s.writePump(connection)
	s.readPump(r.Context(), connection)
}

// readPump reads messages from the WebSocket connection
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
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				s.logger.Error().Err(err).Str("user_id", conn.UserID).Msg("unexpected close error")
			}
			break
		}

		var wsMsg WebSocketMessage
		if err := json.Unmarshal(message, &wsMsg); err != nil {
			s.logger.Error().Err(err).Msg("failed to unmarshal message")
			continue
		}

		// Handle message
		if err := s.handleMessage(ctx, conn, &wsMsg); err != nil {
			s.logger.Error().Err(err).Str("type", wsMsg.Type).Msg("failed to handle message")
			conn.Send <- []byte(fmt.Sprintf(`{"type":"error","data":"%s"}`, err.Error()))
		}
	}
}

// writePump writes messages to the WebSocket connection
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
				conn.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := conn.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				s.logger.Error().Err(err).Str("user_id", conn.UserID).Msg("failed to write message")
				return
			}

		case <-ticker.C:
			conn.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage handles incoming WebSocket messages
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

// handleSubscribe handles subscription to a chat
func (s *Service) handleSubscribe(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		return errors.New("invalid subscription data")
	}

	chatID, ok := data["chat_id"].(string)
	if !ok {
		return errors.New("chat_id required")
	}

	// Add subscription
	conn.mu.Lock()
	conn.Subscriptions[chatID] = true
	conn.mu.Unlock()

	// Send recent messages
	messages, err := s.messageService.GetMessages(ctx, chatID, 50, nil)
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

// handleUnsubscribe handles unsubscription from a chat
func (s *Service) handleUnsubscribe(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		return errors.New("invalid unsubscription data")
	}

	chatID, ok := data["chat_id"].(string)
	if !ok {
		return errors.New("chat_id required")
	}

	// Remove subscription
	conn.mu.Lock()
	delete(conn.Subscriptions, chatID)
	conn.mu.Unlock()

	s.logger.Info().
		Str("user_id", conn.UserID).
		Str("chat_id", chatID).
		Msg("user unsubscribed from chat")

	return nil
}

// handleSendMessage handles sending a message
func (s *Service) handleSendMessage(ctx context.Context, conn *Connection, msg *WebSocketMessage) error {
	// This would delegate to the message service
	// For now, just acknowledge
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

// handleReadReceipt handles read receipts
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

// handleTyping handles typing indicators
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

	// Broadcast typing indicator to other chat members
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

// broadcastToChat broadcasts a message to all subscribers of a chat
func (s *Service) broadcastToChat(ctx context.Context, chatID string, msg WebSocketMessage, excludeUserID string) {
	dataBytes, err := json.Marshal(msg)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to marshal broadcast message")
		return
	}

	// Get all connections subscribed to this chat
	s.connections.mu.RLock()
	defer s.connections.mu.RUnlock()

	for userID, conn := range s.connections.connections {
		if userID == excludeUserID {
			continue
		}

		conn.mu.Lock()
		subscribed := conn.Subscriptions[chatID]
		conn.mu.Unlock()

		if subscribed {
			select {
			case conn.Send <- dataBytes:
			default:
				s.logger.Warn().Str("user_id", userID).Msg("connection send buffer full")
			}
		}
	}
}

// Register registers a connection
func (cr *ConnectionRegistry) Register(userID string, conn *Connection) {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	cr.connections[userID] = conn
}

// Unregister unregisters a connection
func (cr *ConnectionRegistry) Unregister(userID string) {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	if conn, ok := cr.connections[userID]; ok {
		close(conn.Send)
		delete(cr.connections, userID)
	}
}

// Get retrieves a connection
func (cr *ConnectionRegistry) Get(userID string) (*Connection, bool) {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	conn, ok := cr.connections[userID]
	return conn, ok
}

// generateDeviceID generates a unique device ID
func generateDeviceID() string {
	return fmt.Sprintf("device_%d", time.Now().UnixNano())
}
