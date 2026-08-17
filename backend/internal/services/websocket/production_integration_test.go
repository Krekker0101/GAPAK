package websocket

import (
	"context"
	"errors"
	"io"
	"net"
	"sync"
	"testing"
	"time"

	fastws "github.com/fasthttp/websocket"
	"github.com/gofiber/fiber/v2"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/rs/zerolog"
)

// integrationServer is a minimal stand-in for httptest.Server, backed by a
// real TCP listener serving the fiber/fasthttp app directly (fasthttpadaptor
// only bridges net/http handlers onto fasthttp, not the other way around, so
// it cannot be used to expose a fasthttp app through httptest.Server).
type integrationServer struct {
	URL string
}

func testLogger() zerolog.Logger {
	return zerolog.New(io.Discard)
}

type integrationMessageService struct {
	mu       sync.Mutex
	deviceOK bool
	history  map[int64][]interface{}
	access   bool
}

func (m *integrationMessageService) GetMessage(_ context.Context, _ string, id string) (interface{}, error) {
	return map[string]interface{}{"id": id, "chatId": "chat-1", "sequenceNumber": 1, "ciphertext": "cipher", "nonce": "nonce", "senderKeyId": "key", "encryptionProtocol": "SIGNAL", "sentAt": time.Now().UTC().Format(time.RFC3339Nano)}, nil
}
func (m *integrationMessageService) ValidateSession(context.Context, string, string) error {
	return nil
}
func (m *integrationMessageService) GetMessages(_ context.Context, _ string, chatID string, _ int, _ *time.Time) ([]interface{}, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.history[0], nil
}
func (m *integrationMessageService) GetMessagesAfterSequence(_ context.Context, _ string, _ string, seq int64, _ int) ([]interface{}, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.history[seq], nil
}
func (m *integrationMessageService) SendMessage(context.Context, string, string, map[string]interface{}) (interface{}, error) {
	return map[string]interface{}{"id": "server-message-1"}, nil
}
func (m *integrationMessageService) MarkAsRead(context.Context, string, string, string) (interface{}, error) {
	return map[string]interface{}{"messageId": "message-1"}, nil
}
func (m *integrationMessageService) MarkAsDelivered(context.Context, string, string, string) (interface{}, error) {
	return map[string]interface{}{"messageId": "message-1"}, nil
}
func (m *integrationMessageService) AssertChatAccess(context.Context, string, string) error {
	if m.access {
		return nil
	}
	return errors.New("forbidden")
}
func (m *integrationMessageService) ListChatMemberIDs(context.Context, string, string) ([]string, error) {
	return []string{"user-1"}, nil
}
func (m *integrationMessageService) ValidateDevice(context.Context, string, string) error {
	if m.deviceOK {
		return nil
	}
	return errors.New("invalid device")
}

type integrationPresenceService struct{}

func (integrationPresenceService) SetOnline(context.Context, string, string) error  { return nil }
func (integrationPresenceService) SetOffline(context.Context, string, string) error { return nil }
func (integrationPresenceService) IsOnline(context.Context, string) (bool, error)   { return true, nil }

type integrationAuthService struct{}

func (integrationAuthService) ValidateToken(_ context.Context, token string) (string, error) {
	if token == "valid-token" {
		return "user-1", nil
	}
	return "", errors.New("invalid token")
}

func newIntegrationServer(t *testing.T, service *Service) (*integrationServer, *ConnectionRegistry) {
	t.Helper()
	app := fiber.New()
	app.Get("/ws", fiberws.New(service.HandleConnection))

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	go func() {
		_ = app.Listener(ln)
	}()
	t.Cleanup(func() { _ = app.Shutdown() })

	return &integrationServer{URL: "http://" + ln.Addr().String()}, service.connections
}

func dialIntegration(t *testing.T, srv *integrationServer) *fastws.Conn {
	t.Helper()
	url := "ws" + srv.URL[len("http"):] + "/ws"
	conn, _, err := fastws.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func TestWebSocketAuthSuccessAndSubscriptionHistory(t *testing.T) {
	msg := &integrationMessageService{deviceOK: true, access: true, history: map[int64][]interface{}{0: {map[string]interface{}{"id": "m1", "chatId": "chat-1", "sequenceNumber": 1, "ciphertext": "cipher", "nonce": "nonce", "senderKeyId": "key", "encryptionProtocol": "SIGNAL", "sentAt": "2026-08-12T10:00:00Z"}}}}
	service := NewService(nil, msg, integrationPresenceService{}, integrationAuthService{}, testLogger(), nil)
	srv, _ := newIntegrationServer(t, service)
	conn := dialIntegration(t, srv)

	if err := conn.WriteJSON(WebSocketMessage{Type: "auth", Data: map[string]interface{}{"token": "valid-token", "device_id": "device-1"}}); err != nil {
		t.Fatal(err)
	}
	if err := conn.WriteJSON(WebSocketMessage{Type: "subscribe", Data: map[string]interface{}{"chat_id": "chat-1"}}); err != nil {
		t.Fatal(err)
	}
	var frame WebSocketMessage
	if err := conn.ReadJSON(&frame); err != nil {
		t.Fatal(err)
	}
	if frame.Type != "history" {
		t.Fatalf("type=%q, want history", frame.Type)
	}
}

func TestWebSocketAuthFailureClosesWithPolicyViolation(t *testing.T) {
	msg := &integrationMessageService{deviceOK: true}
	service := NewService(nil, msg, integrationPresenceService{}, integrationAuthService{}, testLogger(), nil)
	srv, _ := newIntegrationServer(t, service)
	conn := dialIntegration(t, srv)
	if err := conn.WriteJSON(WebSocketMessage{Type: "auth", Data: map[string]interface{}{"token": "wrong", "device_id": "device-1"}}); err != nil {
		t.Fatal(err)
	}
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Fatal("expected close")
	}
	closeErr, ok := err.(*fastws.CloseError)
	if !ok || closeErr.Code != fastws.ClosePolicyViolation {
		t.Fatalf("close=%v, want 1008", err)
	}
}

func TestWebSocketSubscriptionIsIdempotent(t *testing.T) {
	msg := &integrationMessageService{deviceOK: true, access: true, history: map[int64][]interface{}{0: {map[string]interface{}{"id": "m1", "chatId": "chat-1", "sequenceNumber": 1, "ciphertext": "cipher", "nonce": "nonce", "senderKeyId": "key", "encryptionProtocol": "SIGNAL", "sentAt": "2026-08-12T10:00:00Z"}}}}
	service := NewService(nil, msg, integrationPresenceService{}, integrationAuthService{}, testLogger(), nil)
	srv, _ := newIntegrationServer(t, service)
	conn := dialIntegration(t, srv)
	_ = conn.WriteJSON(WebSocketMessage{Type: "auth", Data: map[string]interface{}{"token": "valid-token", "device_id": "device-1"}})
	sub := WebSocketMessage{Type: "subscribe", Data: map[string]interface{}{"chat_id": "chat-1"}}
	_ = conn.WriteJSON(sub)
	_ = conn.WriteJSON(sub)
	var first WebSocketMessage
	if err := conn.ReadJSON(&first); err != nil {
		t.Fatal(err)
	}
	if first.Type != "history" {
		t.Fatalf("first type=%q", first.Type)
	}
	conn.SetReadDeadline(time.Now().Add(150 * time.Millisecond))
	var second WebSocketMessage
	if err := conn.ReadJSON(&second); err == nil {
		t.Fatal("duplicate subscribe unexpectedly produced another history frame")
	}
}

func TestWebSocketAuthTimeout(t *testing.T) {
	old := authTimeout
	authTimeout = 75 * time.Millisecond
	defer func() { authTimeout = old }()

	service := NewService(nil, &integrationMessageService{deviceOK: true}, integrationPresenceService{}, integrationAuthService{}, testLogger(), nil)
	srv, _ := newIntegrationServer(t, service)
	conn := dialIntegration(t, srv)
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Fatal("expected authentication timeout close")
	}
	closeErr, ok := err.(*fastws.CloseError)
	if !ok || closeErr.Code != fastws.ClosePolicyViolation {
		t.Fatalf("close=%v, want 1008", err)
	}
}

func TestWebSocketFirstFrameMustBeAuth(t *testing.T) {
	service := NewService(nil, &integrationMessageService{deviceOK: true}, integrationPresenceService{}, integrationAuthService{}, testLogger(), nil)
	srv, _ := newIntegrationServer(t, service)
	conn := dialIntegration(t, srv)
	if err := conn.WriteJSON(WebSocketMessage{Type: "subscribe", Data: map[string]interface{}{"chat_id": "chat-1"}}); err != nil {
		t.Fatal(err)
	}
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Fatal("expected authentication close")
	}
	closeErr, ok := err.(*fastws.CloseError)
	if !ok || closeErr.Code != fastws.ClosePolicyViolation {
		t.Fatalf("close=%v, want 1008", err)
	}
}

func TestWebSocketMalformedFirstFrameIsProtocolError(t *testing.T) {
	service := NewService(nil, &integrationMessageService{deviceOK: true}, integrationPresenceService{}, integrationAuthService{}, testLogger(), nil)
	srv, _ := newIntegrationServer(t, service)
	conn := dialIntegration(t, srv)
	if err := conn.WriteMessage(fastws.TextMessage, []byte(`{"type":`)); err != nil {
		t.Fatal(err)
	}
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Fatal("expected protocol close")
	}
	closeErr, ok := err.(*fastws.CloseError)
	if !ok || closeErr.Code != fastws.CloseProtocolError {
		t.Fatalf("close=%v, want 1002", err)
	}
}

func TestWebSocketHeartbeatUsesNativePingPong(t *testing.T) {
	old := pingInterval
	pingInterval = 20 * time.Millisecond
	defer func() { pingInterval = old }()

	service := NewService(nil, &integrationMessageService{deviceOK: true, access: true, history: map[int64][]interface{}{0: nil}}, integrationPresenceService{}, integrationAuthService{}, testLogger(), nil)
	srv, _ := newIntegrationServer(t, service)
	conn := dialIntegration(t, srv)
	if err := conn.WriteJSON(WebSocketMessage{Type: "auth", Data: map[string]interface{}{"token": "valid-token", "device_id": "device-1"}}); err != nil {
		t.Fatal(err)
	}
	pong := make(chan struct{}, 1)
	conn.SetPongHandler(func(string) error {
		select {
		case pong <- struct{}{}:
		default:
		}
		return nil
	})
	conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
		select {
		case <-pong:
			return
		default:
		}
	}
	select {
	case <-pong:
		return
	default:
		t.Fatal("did not observe native WebSocket pong")
	}
}

func TestWebSocketReconnectRecoversAfterSequence(t *testing.T) {
	msg := &integrationMessageService{deviceOK: true, access: true, history: map[int64][]interface{}{42: {map[string]interface{}{"id": "m43", "chatId": "chat-1", "sequenceNumber": 43, "ciphertext": "cipher", "nonce": "nonce", "senderKeyId": "key", "encryptionProtocol": "SIGNAL", "sentAt": "2026-08-12T10:00:00Z"}}}}
	service := NewService(nil, msg, integrationPresenceService{}, integrationAuthService{}, testLogger(), nil)
	srv, _ := newIntegrationServer(t, service)
	for i := 0; i < 2; i++ {
		conn := dialIntegration(t, srv)
		if err := conn.WriteJSON(WebSocketMessage{Type: "auth", Data: map[string]interface{}{"token": "valid-token", "device_id": "device-1"}}); err != nil {
			t.Fatal(err)
		}
		if err := conn.WriteJSON(WebSocketMessage{Type: "subscribe", Data: map[string]interface{}{"chat_id": "chat-1", "after_sequence": float64(42)}}); err != nil {
			t.Fatal(err)
		}
		var frame WebSocketMessage
		if err := conn.ReadJSON(&frame); err != nil {
			t.Fatal(err)
		}
		if frame.Type != "history" {
			t.Fatalf("type=%q", frame.Type)
		}
		_ = conn.Close()
	}
}

func TestWebSocketReplayUsesAfterSequence(t *testing.T) {
	msg := &integrationMessageService{deviceOK: true, access: true, history: map[int64][]interface{}{42: {map[string]interface{}{"id": "m43", "chatId": "chat-1", "sequenceNumber": 43, "ciphertext": "cipher", "nonce": "nonce", "senderKeyId": "key", "encryptionProtocol": "SIGNAL", "sentAt": "2026-08-12T10:00:00Z"}}}}
	service := NewService(nil, msg, integrationPresenceService{}, integrationAuthService{}, testLogger(), nil)
	srv, _ := newIntegrationServer(t, service)
	conn := dialIntegration(t, srv)
	_ = conn.WriteJSON(WebSocketMessage{Type: "auth", Data: map[string]interface{}{"token": "valid-token", "device_id": "device-1"}})
	_ = conn.WriteJSON(WebSocketMessage{Type: "subscribe", Data: map[string]interface{}{"chat_id": "chat-1", "after_sequence": float64(42)}})
	var frame WebSocketMessage
	if err := conn.ReadJSON(&frame); err != nil {
		t.Fatal(err)
	}
	if frame.Type != "history" {
		t.Fatalf("type=%q", frame.Type)
	}
}

func TestWebSocketConcurrentClients(t *testing.T) {
	msg := &integrationMessageService{deviceOK: true, access: true, history: map[int64][]interface{}{0: nil}}
	service := NewService(nil, msg, integrationPresenceService{}, integrationAuthService{}, testLogger(), nil)
	srv, registry := newIntegrationServer(t, service)
	const clients = 5
	var wg sync.WaitGroup
	for i := 0; i < clients; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			conn := dialIntegration(t, srv)
			_ = conn.WriteJSON(WebSocketMessage{Type: "auth", Data: map[string]interface{}{"token": "valid-token", "device_id": "device-1"}})
			_ = conn.WriteJSON(WebSocketMessage{Type: "subscribe", Data: map[string]interface{}{"chat_id": "chat-1"}})
			var frame WebSocketMessage
			_ = conn.ReadJSON(&frame)
			_ = conn.Close()
		}()
	}
	wg.Wait()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if len(registry.snapshot()) == 0 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("connections did not clean up; remaining=%d", len(registry.snapshot()))
}
