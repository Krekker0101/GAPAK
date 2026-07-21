package chats

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

type WebSocketHub struct {
	clients    map[string]map[string]*websocket.Conn // chatID -> userID -> connection
	register   chan *WebSocketClient
	unregister chan *WebSocketClient
	broadcast  chan *WebSocketMessage
	mu         sync.RWMutex
}

type WebSocketClient struct {
	ChatID string
	UserID string
	Conn  *websocket.Conn
}

func NewWebSocketHub() *WebSocketHub {
	return &WebSocketHub{
		clients:    make(map[string]map[string]*websocket.Conn),
		register:   make(chan *WebSocketClient, 100),
		unregister: make(chan *WebSocketClient, 100),
		broadcast:  make(chan *WebSocketMessage, 1000),
	}
}

func (hub *WebSocketHub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case client := <-hub.register:
			hub.registerClient(client)
		case client := <-hub.unregister:
			hub.unregisterClient(client)
		case message := <-hub.broadcast:
			hub.broadcastMessage(message)
		}
	}
}

func (hub *WebSocketHub) registerClient(client *WebSocketClient) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	if _, exists := hub.clients[client.ChatID]; !exists {
		hub.clients[client.ChatID] = make(map[string]*websocket.Conn)
	}
	hub.clients[client.ChatID][client.UserID] = client.Conn
}

func (hub *WebSocketHub) unregisterClient(client *WebSocketClient) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	if chatClients, exists := hub.clients[client.ChatID]; exists {
		delete(chatClients, client.UserID)
		if len(chatClients) == 0 {
			delete(hub.clients, client.ChatID)
		}
	}
}

func (hub *WebSocketHub) broadcastMessage(message *WebSocketMessage) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()

	if chatClients, exists := hub.clients[message.ChatID]; exists {
		for userID, conn := range chatClients {
			if message.UserID != "" && message.UserID == userID {
				continue // Skip sender
			}
			if err := conn.WriteJSON(message); err != nil {
				// Connection error, will be cleaned up by unregister
				continue
			}
		}
	}
}

func (hub *WebSocketHub) BroadcastToChat(chatID string, event string, payload interface{}) {
	hub.broadcast <- &WebSocketMessage{
		Event:   event,
		Payload: payload.(map[string]interface{}),
		ChatID:  chatID,
	}
}

func (hub *WebSocketHub) BroadcastToUser(chatID, userID string, event string, payload interface{}) {
	hub.broadcast <- &WebSocketMessage{
		Event:   event,
		Payload: payload.(map[string]interface{}),
		ChatID:  chatID,
		UserID:  userID,
	}
}

func (hub *WebSocketHub) HandleWebSocket(c *websocket.Conn, chatID, userID string) {
	client := &WebSocketClient{
		ChatID: chatID,
		UserID: userID,
		Conn:   c,
	}

	hub.register <- client
	defer func() {
		hub.unregister <- client
		c.Close()
	}()

	for {
		messageType, message, err := c.ReadMessage()
		if err != nil {
			break
		}

		if messageType == websocket.TextMessage {
			var wsMsg WebSocketMessage
			if err := json.Unmarshal(message, &wsMsg); err != nil {
				continue
			}
			// Handle incoming WebSocket messages if needed
		}
	}
}

func (hub *WebSocketHub) Upgrade(c *fiber.Ctx) error {
	return websocket.New(func(c *websocket.Conn) {
		chatID := c.Params("chatId")
		userID := c.Locals("userId").(string)
		hub.HandleWebSocket(c, chatID, userID)
	})(c)
}
