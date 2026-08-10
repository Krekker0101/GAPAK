package websocket

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestConnectionRegistryEnforcesPerUserLimitConcurrently(t *testing.T) {
	registry := &ConnectionRegistry{connections: make(map[string]*Connection)}
	const attempts = 100
	var wg sync.WaitGroup
	results := make(chan bool, attempts)
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			results <- registry.Register(&Connection{ID: generateConnectionID(), UserID: "user-1", DeviceID: "device"})
		}(i)
	}
	wg.Wait()
	close(results)

	accepted := 0
	for ok := range results {
		if ok {
			accepted++
		}
	}
	if accepted != maxConnectionsPerUser {
		t.Fatalf("accepted %d connections, want %d", accepted, maxConnectionsPerUser)
	}
}

func TestConnectionRegistryUnregistersByConnectionID(t *testing.T) {
	registry := &ConnectionRegistry{connections: make(map[string]*Connection)}
	first := &Connection{ID: "conn-1", UserID: "user-1", DeviceID: "same-device"}
	second := &Connection{ID: "conn-2", UserID: "user-1", DeviceID: "same-device"}
	if !registry.Register(first) || !registry.Register(second) {
		t.Fatal("expected both connections to register")
	}
	registry.Unregister(first.ID)
	if _, ok := registry.connections[second.ID]; !ok {
		t.Fatal("unregistering first connection removed second connection")
	}
}

func TestParseSequence(t *testing.T) {
	cases := []struct {
		name string
		in   any
		want int64
		ok   bool
	}{
		{"float", float64(42), 42, true},
		{"string", "99", 99, true},
		{"fraction", 1.5, 0, false},
		{"invalid", "nope", 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := parseSequence(tc.in)
			if got != tc.want || ok != tc.ok {
				t.Fatalf("parseSequence(%v) = (%d, %v), want (%d, %v)", tc.in, got, ok, tc.want, tc.ok)
			}
		})
	}
}

type fakeMessageService struct{}

func (fakeMessageService) GetMessage(_ context.Context, userID, id string) (interface{}, error) {
	return map[string]string{"id": id, "viewer": userID}, nil
}
func (fakeMessageService) GetMessages(context.Context, string, string, int, *time.Time) ([]interface{}, error) {
	return nil, nil
}
func (fakeMessageService) GetMessagesAfterSequence(context.Context, string, string, int64, int) ([]interface{}, error) {
	return nil, nil
}
func (fakeMessageService) SendMessage(context.Context, string, string, map[string]interface{}) (interface{}, error) {
	return nil, nil
}
func (fakeMessageService) MarkAsRead(context.Context, string, string, string) (interface{}, error) {
	return nil, nil
}
func (fakeMessageService) MarkAsDelivered(context.Context, string, string, string) (interface{}, error) {
	return nil, nil
}
func (fakeMessageService) AssertChatAccess(context.Context, string, string) error { return nil }
func (fakeMessageService) ListChatMemberIDs(context.Context, string, string) ([]string, error) {
	return nil, nil
}

func TestRealtimeEventFanoutIsLocalAndDeduplicated(t *testing.T) {
	service := &Service{
		connections:    &ConnectionRegistry{connections: make(map[string]*Connection)},
		messageService: fakeMessageService{},
	}
	first := &Connection{ID: "c1", UserID: "u1", DeviceID: "d1", Send: make(chan []byte, 4), Subscriptions: map[string]bool{"chat-1": true}, done: make(chan struct{}), seenEvents: make(map[string]time.Time)}
	second := &Connection{ID: "c2", UserID: "u2", DeviceID: "d2", Send: make(chan []byte, 4), Subscriptions: map[string]bool{"chat-1": true}, done: make(chan struct{}), seenEvents: make(map[string]time.Time)}
	service.connections.Register(first)
	service.connections.Register(second)

	event := realtimeEnvelope{EventID: "evt-1", Type: "chat.message.created", ChatID: "chat-1", MessageID: "msg-1", SenderID: "u1", SenderDeviceID: "d1", Sequence: 10}
	service.handleRealtimeEvent(context.Background(), event)
	service.handleRealtimeEvent(context.Background(), event)

	if got := len(first.Send); got != 0 {
		t.Fatalf("sender connection received %d events, want 0", got)
	}
	if got := len(second.Send); got != 1 {
		t.Fatalf("recipient connection received %d events, want 1", got)
	}
}
