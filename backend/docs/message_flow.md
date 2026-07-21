# GAPAK Messaging System - Message Flow Documentation

## Message Sending Process

### Step-by-Step Flow

```
┌─────────────┐    1. User types message    ┌──────────────┐
│   Client    │──────────────────────────────▶│   Client     │
│  (Sender)   │                              │  Encryption  │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 2. Encrypt with E2EE
                                                   │    (Double Ratchet)
                                                   ▼
┌─────────────┐    3. Send encrypted payload    ┌──────────────┐
│   Client    │──────────────────────────────▶│  WebSocket   │
│  (Sender)   │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 4. Validate & deduplicate
                                                   ▼
┌─────────────┐    5. gRPC call                 ┌──────────────┐
│  WebSocket  │──────────────────────────────▶│  Message     │
│   Service   │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 6. Validate message
                                                   │ 7. Store in PostgreSQL
                                                   │ 8. Publish to Kafka
                                                   ▼
┌─────────────┐    9. Message event            ┌──────────────┐
│  Message    │──────────────────────────────▶│    Kafka     │
│   Service   │                              │   Cluster    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 10. Consume by services
                                                   ▼
┌─────────────┐    11. Push notification       ┌──────────────┐
│    Kafka    │──────────────────────────────▶│  Push        │
│   Cluster   │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 12. Send push to recipient
                                                   ▼
┌─────────────┐    13. Push notification       ┌──────────────┐
│  Push       │──────────────────────────────▶│   APNs/FCM   │
│   Service   │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 14. Deliver to device
                                                   ▼
┌─────────────┐    15. Push notification       ┌──────────────┐
│   APNs/FCM  │──────────────────────────────▶│   Client     │
│   Service   │                              │  (Recipient) │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 16. Fetch message via WebSocket
                                                   ▼
┌─────────────┐    17. Deliver encrypted        ┌──────────────┐
│   Client    │──────────────────────────────▶│   Client     │
│ (Recipient) │                              │  Decryption  │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 18. Decrypt with E2EE
                                                   │    (Double Ratchet)
                                                   ▼
┌─────────────┐    19. Display plaintext        ┌──────────────┐
│   Client    │──────────────────────────────▶│   Client UI  │
│ (Recipient) │                              │              │
└─────────────┘                              └──────────────┘
```

### Detailed Steps

#### Step 1: User Types Message
- User opens chat
- Types message content
- Clicks send button
- Client generates unique `client_message_id` (UUID v4)

#### Step 2: Client Encryption
```go
// Client-side encryption
func SendMessage(plaintext string, recipientID string, session *SessionState) error {
    // 1. Encrypt with Double Ratchet
    encrypted, err := session.DoubleRatchet.RatchetEncrypt([]byte(plaintext))
    if err != nil {
        return err
    }
    
    // 2. Create message envelope
    envelope := &MessageEnvelope{
        ClientMessageID: generateUUID(),
        Ciphertext:      encrypted.Ciphertext,
        Nonce:           encrypted.Nonce,
        SenderKeyID:     session.SenderKeyID,
        Timestamp:       time.Now().Unix(),
    }
    
    // 3. Send to server
    return sendToServer(envelope)
}
```

#### Step 3: Send to WebSocket Service
```http
POST /ws/send
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "chat_id": "uuid",
  "client_message_id": "uuid",
  "ciphertext": "base64_encoded",
  "nonce": "base64_encoded",
  "sender_key_id": "key_id",
  "attachments": [],
  "metadata": {}
}
```

#### Step 4: WebSocket Service Validation
```go
func (ws *WebSocketService) HandleSendMessage(ctx context.Context, req *SendMessageRequest) error {
    // 1. Validate JWT token
    userID, err := ws.auth.ValidateToken(ctx, req.Token)
    if err != nil {
        return err
    }
    
    // 2. Check rate limit
    if !ws.rateLimiter.Allow(userID, "send_message", 100, time.Minute) {
        return errors.New("rate limit exceeded")
    }
    
    // 3. Check deduplication
    if ws.deduplicator.IsDuplicate(req.ClientMessageID) {
        return errors.New("duplicate message")
    }
    
    // 4. Forward to Message Service
    return ws.messageService.SendMessage(ctx, req)
}
```

#### Step 5-8: Message Service Processing
```go
func (ms *MessageService) SendMessage(ctx context.Context, req *SendMessageRequest) (*SendMessageResponse, error) {
    // 1. Validate request
    if err := ms.validateRequest(req); err != nil {
        return nil, err
    }
    
    // 2. Check chat membership
    if !ms.chatService.IsMember(ctx, req.ChatID, req.SenderID) {
        return nil, errors.New("not a chat member")
    }
    
    // 3. Generate server message ID
    messageID := generateUUID()
    
    // 4. Get next sequence number
    sequenceNumber, err := ms.getNextSequenceNumber(ctx, req.ChatID)
    if err != nil {
        return nil, err
    }
    
    // 5. Store message in PostgreSQL
    message := &Message{
        ID:               messageID,
        ChatID:           req.ChatID,
        SenderID:         req.SenderID,
        Ciphertext:       req.Ciphertext,
        Nonce:            req.Nonce,
        SenderKeyID:      req.SenderKeyID,
        ClientMessageID:  req.ClientMessageID,
        SequenceNumber:   sequenceNumber,
        SentAt:           time.Now(),
    }
    
    if err := ms.db.CreateMessage(ctx, message); err != nil {
        return nil, err
    }
    
    // 6. Store deduplication record
    ms.deduplicator.Record(req.ClientMessageID, messageID, req.SenderID, req.ChatID)
    
    // 7. Publish to Kafka
    event := &MessageEvent{
        EventID:      generateUUID(),
        EventType:    "created",
        Message:      message,
        Timestamp:    time.Now(),
        SourceService: "message_service",
    }
    
    if err := ms.kafka.Publish("messages", event); err != nil {
        // Log error but don't fail (message is already stored)
        ms.logger.Error("failed to publish message event", "error", err)
    }
    
    // 8. Return response
    return &SendMessageResponse{
        MessageID:      messageID,
        SentAt:         message.SentAt,
        SequenceNumber: sequenceNumber,
    }, nil
}
```

#### Step 9-10: Kafka Event Propagation
```go
// Kafka topics and partitions
// Topic: messages
// Partitions: 100 (partitioned by chat_id hash)
// Replication factor: 3

// Event consumed by:
// - Push Service (for offline users)
// - Receipt Service (for delivery tracking)
// - Search Service (for indexing)
// - Audit Service (for logging)
```

#### Step 11-14: Push Service Processing
```go
func (ps *PushService) HandleMessageEvent(ctx context.Context, event *MessageEvent) error {
    // 1. Get chat members
    members, err := ps.chatService.GetMembers(ctx, event.Message.ChatID)
    if err != nil {
        return err
    }
    
    // 2. For each member (except sender)
    for _, member := range members {
        if member.UserID == event.Message.SenderID {
            continue
        }
        
        // 3. Check if user is online
        isOnline := ps.presenceService.IsOnline(ctx, member.UserID)
        
        if !isOnline {
            // 4. Send push notification
            payload := &PushPayload{
                Title: "New Message",
                Body:  "You have a new message",
                Data: map[string]string{
                    "chat_id":     event.Message.ChatID,
                    "message_id":  event.Message.ID,
                    "sender_id":   event.Message.SenderID,
                },
            }
            
            if err := ps.sendPush(ctx, member.UserID, payload); err != nil {
                ps.logger.Error("failed to send push", "user_id", member.UserID, "error", err)
            }
        }
    }
    
    return nil
}
```

#### Step 15-19: Client Reception
```go
// Client receives push notification
func handlePushNotification(notification *PushNotification) {
    // 1. Connect to WebSocket if not connected
    if !ws.isConnected {
        ws.connect()
    }
    
    // 2. Fetch message via WebSocket
    message := ws.fetchMessage(notification.Data["message_id"])
    
    // 3. Decrypt message
    plaintext, err := session.DoubleRatchet.RatchetDecrypt(message)
    if err != nil {
        log.Error("failed to decrypt message", "error", err)
        return
    }
    
    // 4. Display in UI
    ui.displayMessage(plaintext)
    
    // 5. Send read receipt
    ws.sendReadReceipt(message.ID)
}
```

---

## Message Receiving Process

### Step-by-Step Flow

```
┌─────────────┐    1. WebSocket connection     ┌──────────────┐
│   Client    │──────────────────────────────▶│  WebSocket   │
│ (Recipient) │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 2. Authenticate
                                                   ▼
┌─────────────┐    3. Subscribe to chat         ┌──────────────┐
│  WebSocket  │──────────────────────────────▶│  Presence    │
│   Service   │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 4. Update presence
                                                   ▼
┌─────────────┐    5. New message event          ┌──────────────┐
│    Kafka    │──────────────────────────────▶│  WebSocket   │
│   Cluster   │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 6. Find user's connection
                                                   ▼
┌─────────────┐    7. Push encrypted message    ┌──────────────┐
│  WebSocket  │──────────────────────────────▶│   Client     │
│   Service   │                              │ (Recipient) │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 8. Decrypt message
                                                   ▼
┌─────────────┐    9. Display plaintext          ┌──────────────┐
│   Client    │──────────────────────────────▶│   Client UI  │
│ (Recipient) │                              │              │
└─────────────┘                              └──────────────┘
```

### Detailed Steps

#### Step 1-2: WebSocket Connection
```go
// Client connects to WebSocket
ws := newWebSocket("wss://api.gapak.com/ws")
ws.connect()

// Send authentication message
auth := &WebSocketMessage{
    Type: "auth",
    Data: map[string]string{
        "token": jwtToken,
    },
}
ws.send(auth)

// Server validates token
func (ws *WebSocketService) HandleAuth(ctx context.Context, msg *WebSocketMessage) error {
    token := msg.Data["token"]
    userID, err := ws.auth.ValidateToken(ctx, token)
    if err != nil {
        return err
    }
    
    // Store connection
    ws.connections.Store(userID, conn)
    
    // Update presence
    ws.presenceService.SetOnline(ctx, userID, deviceID)
    
    return nil
}
```

#### Step 3-4: Subscribe to Chat
```go
// Client subscribes to chat
subscribe := &WebSocketMessage{
    Type: "subscribe",
    Data: map[string]string{
        "chat_id": chatID,
    },
}
ws.send(subscribe)

// Server handles subscription
func (ws *WebSocketService) HandleSubscribe(ctx context.Context, userID string, chatID string) error {
    // 1. Verify chat membership
    if !ws.chatService.IsMember(ctx, chatID, userID) {
        return errors.New("not a chat member")
    }
    
    // 2. Add to subscription registry
    ws.subscriptions.Store(userID+":"+chatID, true)
    
    // 3. Send recent messages
    messages, err := ws.messageService.GetMessages(ctx, chatID, 50)
    if err != nil {
        return err
    }
    
    ws.send(&WebSocketMessage{
        Type: "history",
        Data: messages,
    })
    
    return nil
}
```

#### Step 5-7: Message Delivery
```go
// Kafka consumer in WebSocket Service
func (ws *WebSocketService) ConsumeMessageEvents(ctx context.Context) {
    consumer := ws.kafka.Subscribe("messages")
    
    for {
        select {
        case <-ctx.Done():
            return
        case event := <-consumer.Events():
            // 1. Get chat members
            members, err := ws.chatService.GetMembers(ctx, event.Message.ChatID)
            if err != nil {
                continue
            }
            
            // 2. For each member
            for _, member := range members {
                // 3. Check if user has active WebSocket connection
                conn, ok := ws.connections.Load(member.UserID)
                if ok {
                    // 4. Send message via WebSocket
                    wsMessage := &WebSocketMessage{
                        Type: "message",
                        Data: event.Message,
                    }
                    conn.Send(wsMessage)
                    
                    // 5. Mark as delivered
                    ws.receiptService.MarkDelivered(ctx, event.Message.ID, member.UserID)
                }
            }
        }
    }
}
```

#### Step 8-9: Client Decryption
```go
// Client receives WebSocket message
ws.onMessage(func(msg *WebSocketMessage) {
    if msg.Type == "message" {
        // 1. Decrypt message
        plaintext, err := session.DoubleRatchet.RatchetDecrypt(msg.Data)
        if err != nil {
            log.Error("decryption failed", "error", err)
            return
        }
        
        // 2. Display in UI
        ui.displayMessage(plaintext)
        
        // 3. Send read receipt
        ws.send(&WebSocketMessage{
            Type: "read_receipt",
            Data: map[string]string{
                "message_id": msg.Data.ID,
            },
        })
    }
})
```

---

## Device Synchronization Algorithm

### Overview

Multi-device synchronization ensures messages are delivered to all user devices consistently, using a combination of server-side tracking and client-side sync.

### Synchronization Flow

```
┌─────────────┐    1. Register device            ┌──────────────┐
│  Device A   │──────────────────────────────▶│  Device      │
│  (Primary)  │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 2. Store device info
                                                   ▼
┌─────────────┐    3. Register device            ┌──────────────┐
│  Device B   │──────────────────────────────▶│  Device      │
│  (Secondary)│                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 4. Store device info
                                                   ▼
┌─────────────┐    5. Send message               ┌──────────────┐
│  Device A   │──────────────────────────────▶│  Message     │
│             │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 6. Store message
                                                   │ 7. Publish to Kafka
                                                   ▼
┌─────────────┐    8. Message event              ┌──────────────┐
│    Kafka    │──────────────────────────────▶│  Device      │
│   Cluster   │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 9. Get all user devices
                                                   ▼
┌─────────────┐    10. Push to all devices       ┌──────────────┐
│  Device     │──────────────────────────────▶│  Device A    │
│   Service   │                              │              │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 11. Deliver message
                                                   ▼
┌─────────────┐    12. Push to all devices       ┌──────────────┐
│  Device     │──────────────────────────────▶│  Device B    │
│   Service   │                              │              │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 13. Device B comes online
                                                   ▼
┌─────────────┐    14. Request sync              ┌──────────────┐
│  Device B   │──────────────────────────────▶│  Device      │
│             │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 15. Fetch missed messages
                                                   ▼
┌─────────────┐    16. Return missed messages    ┌──────────────┐
│  Device     │──────────────────────────────▶│  Device B    │
│   Service   │                              │              │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 17. Decrypt and display
                                                   ▼
┌─────────────┐    18. Update sync cursor        ┌──────────────┐
│  Device B   │──────────────────────────────▶│  Device      │
│             │                              │   Service    │
└─────────────┘                              └──────────────┘
```

### Implementation

#### Device Registration
```go
func (ds *DeviceService) RegisterDevice(ctx context.Context, req *RegisterDeviceRequest) (*RegisterDeviceResponse, error) {
    // 1. Generate device ID
    deviceID := generateUUID()
    
    // 2. Store device info
    device := &Device{
        ID:          deviceID,
        UserID:      req.UserID,
        Name:        req.DeviceInfo.Name,
        Type:        req.DeviceInfo.Type,
        OS:          req.DeviceInfo.OS,
        AppVersion:  req.DeviceInfo.AppVersion,
        IsActive:    true,
        CreatedAt:   time.Now(),
    }
    
    if err := ds.db.CreateDevice(ctx, device); err != nil {
        return nil, err
    }
    
    // 3. Store device keys
    for _, key := range req.Keys {
        deviceKey := &DeviceKey{
            DeviceID:           deviceID,
            KeyID:              key.KeyID,
            KeyType:            key.KeyType,
            PublicKey:          key.PublicKey,
            PrivateKeyCiphertext: encryptPrivateKey(key.PrivateKey),
            CreatedAt:          time.Now(),
        }
        
        if err := ds.db.CreateDeviceKey(ctx, deviceKey); err != nil {
            return nil, err
        }
    }
    
    // 4. Publish device event
    ds.kafka.Publish("devices", &DeviceEvent{
        EventType: "registered",
        Device:    device,
    })
    
    return &RegisterDeviceResponse{
        DeviceID:     deviceID,
        RegisteredAt: time.Now(),
    }, nil
}
```

#### Message Sync
```go
func (ds *DeviceService) SyncDevice(ctx context.Context, req *SyncDeviceRequest) (*SyncDeviceResponse, error) {
    // 1. Get device
    device, err := ds.db.GetDevice(ctx, req.DeviceID)
    if err != nil {
        return nil, err
    }
    
    // 2. Get user's chats
    chats, err := ds.chatService.GetUserChats(ctx, device.UserID)
    if err != nil {
        return nil, err
    }
    
    // 3. Fetch messages since last sync
    var syncMessages []*SyncMessage
    for _, chat := range chats {
        messages, err := ds.messageService.GetMessagesSince(ctx, chat.ID, req.Since)
        if err != nil {
            continue
        }
        
        for _, msg := range messages {
            syncMessages = append(syncMessages, &SyncMessage{
                MessageID:      msg.ID,
                ChatID:        msg.ChatID,
                Ciphertext:    msg.Ciphertext,
                Nonce:         msg.Nonce,
                SentAt:        msg.SentAt,
                SequenceNumber: msg.SequenceNumber,
                Operation:     SYNC_OPERATION_ADD,
            })
        }
    }
    
    // 4. Update last synced timestamp
    if err := ds.db.UpdateDeviceSyncTime(ctx, req.DeviceID, time.Now()); err != nil {
        return nil, err
    }
    
    return &SyncDeviceResponse{
        Messages:   syncMessages,
        NextCursor: generateNextCursor(req.Since),
    }, nil
}
```

---

## Offline Delivery Mechanism

### Overview

Offline delivery ensures users receive messages even when they're not connected, using push notifications and message queuing.

### Offline Delivery Flow

```
┌─────────────┐    1. User goes offline         ┌──────────────┐
│   Client    │──────────────────────────────▶│  Presence    │
│             │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 2. Update presence
                                                   ▼
┌─────────────┐    3. Message sent               ┌──────────────┐
│   Sender    │──────────────────────────────▶│  Message     │
│             │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 4. Store message
                                                   ▼
┌─────────────┐    5. Message event              ┌──────────────┐
│    Kafka    │──────────────────────────────▶│  Push        │
│   Cluster   │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 6. Check recipient presence
                                                   ▼
┌─────────────┐    7. User is offline            ┌──────────────┐
│  Push       │──────────────────────────────▶│  Queue push  │
│   Service   │                              │  notification │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 8. Store in queue
                                                   ▼
┌─────────────┐    9. Send to APNs/FCM          ┌──────────────┐
│  Push       │──────────────────────────────▶│  APNs/FCM    │
│   Service   │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 10. Deliver to device
                                                   ▼
┌─────────────┐    11. User comes online         ┌──────────────┐
│   Client    │──────────────────────────────▶│  Presence    │
│             │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 12. Update presence
                                                   ▼
┌─────────────┐    13. Fetch offline messages    ┌──────────────┐
│   Client    │──────────────────────────────▶│  Message     │
│             │                              │   Service    │
└─────────────┘                              └──────┬───────┘
                                                   │
                                                   │ 14. Return messages
                                                   ▼
┌─────────────┐    15. Display messages          ┌──────────────┐
│   Client    │──────────────────────────────▶│   Client UI  │
│             │                              │              │
└─────────────┘                              └──────────────┘
```

### Implementation

#### Push Queue
```go
func (ps *PushService) QueuePushNotification(ctx context.Context, userID string, payload *PushPayload) error {
    // 1. Create push notification record
    notification := &PushNotification{
        ID:         generateUUID(),
        UserID:     userID,
        Payload:    payload,
        Status:     "pending",
        CreatedAt:  time.Now(),
    }
    
    // 2. Store in database
    if err := ps.db.CreatePushNotification(ctx, notification); err != nil {
        return err
    }
    
    // 3. Add to Redis queue
    queueKey := fmt.Sprintf("push_queue:%s", userID)
    if err := ps.redis.LPush(ctx, queueKey, notification.ID); err != nil {
        return err
    }
    
    // 4. Set TTL (24 hours)
    ps.redis.Expire(ctx, queueKey, 24*time.Hour)
    
    return nil
}

func (ps *PushService) ProcessPushQueue(ctx context.Context) {
    ticker := time.NewTicker(1 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            // Process queue
            ps.processBatch(ctx)
        }
    }
}

func (ps *PushService) processBatch(ctx context.Context) {
    // 1. Get all queue keys
    keys, err := ps.redis.Keys(ctx, "push_queue:*")
    if err != nil {
        return
    }
    
    // 2. Process each queue (batch of 100)
    for _, key := range keys {
        for i := 0; i < 100; i++ {
            // Pop from queue
            notificationID, err := ps.redis.RPop(ctx, key)
            if err != nil {
                break
            }
            
            // Get notification
            notification, err := ps.db.GetPushNotification(ctx, notificationID)
            if err != nil {
                continue
            }
            
            // Send push
            if err := ps.sendPush(ctx, notification); err != nil {
                // Retry later
                ps.redis.LPush(ctx, key, notificationID)
                notification.RetryCount++
                ps.db.UpdatePushNotification(ctx, notification)
                
                if notification.RetryCount >= notification.MaxRetries {
                    notification.Status = "failed"
                    ps.db.UpdatePushNotification(ctx, notification)
                }
            } else {
                notification.Status = "sent"
                notification.SentAt = time.Now()
                ps.db.UpdatePushNotification(ctx, notification)
            }
        }
    }
}
```

---

## Message Deduplication Mechanism

### Overview

Message deduplication prevents duplicate messages from being stored or delivered, using client-generated message IDs and server-side tracking.

### Deduplication Strategy

#### 1. Client-Side Deduplication
- Client generates unique `client_message_id` for each message
- Client tracks sent messages locally
- Client ignores messages with duplicate IDs

#### 2. Server-Side Deduplication
- Server tracks `client_message_id` in Redis
- TTL: 24 hours (sufficient for retry window)
- Check before storing message

### Implementation

#### Deduplication Service
```go
type DeduplicationService struct {
    redis  *redis.Client
    db     *Database
}

func (ds *DeduplicationService) IsDuplicate(clientMessageID string) bool {
    // 1. Check Redis cache
    key := fmt.Sprintf("dedup:%s", clientMessageID)
    exists, err := ds.redis.Exists(ctx, key)
    if err != nil || exists > 0 {
        return true
    }
    
    // 2. Check database (fallback)
    _, err = ds.db.GetMessageByClientID(ctx, clientMessageID)
    if err == nil {
        return true
    }
    
    return false
}

func (ds *DeduplicationService) Record(clientMessageID, serverMessageID, userID, chatID string) error {
    // 1. Store in Redis
    key := fmt.Sprintf("dedup:%s", clientMessageID)
    value := fmt.Sprintf("%s:%s:%s", serverMessageID, userID, chatID)
    
    if err := ds.redis.Set(ctx, key, value, 24*time.Hour); err != nil {
        return err
    }
    
    // 2. Store in database
    record := &MessageDeduplication{
        ClientMessageID: clientMessageID,
        ServerMessageID: serverMessageID,
        UserID:          userID,
        ChatID:          chatID,
        CreatedAt:       time.Now(),
        ExpiresAt:       time.Now().Add(24 * time.Hour),
    }
    
    return ds.db.CreateDeduplicationRecord(ctx, record)
}

func (ds *DeduplicationService) Cleanup(ctx context.Context) error {
    // Clean up expired records
    return ds.db.DeleteExpiredDeduplicationRecords(ctx, time.Now())
}
```

#### Deduplication in Message Service
```go
func (ms *MessageService) SendMessage(ctx context.Context, req *SendMessageRequest) (*SendMessageResponse, error) {
    // 1. Check deduplication
    if ms.deduplicator.IsDuplicate(req.ClientMessageID) {
        // Return existing message ID
        existingID, err := ms.deduplicator.GetServerID(req.ClientMessageID)
        if err == nil {
            return &SendMessageResponse{
                MessageID: existingID,
                SentAt:    time.Now(),
            }, nil
        }
        return nil, errors.New("duplicate message")
    }
    
    // 2. Process message...
    // ... (message processing logic)
    
    // 3. Record deduplication
    ms.deduplicator.Record(req.ClientMessageID, messageID, req.SenderID, req.ChatID)
    
    return response, nil
}
```

---

## Scaling Strategy to 100+ Million Users

### Horizontal Scaling

#### 1. Stateless Services
- All application services are stateless
- Can scale to N instances
- Auto-scaling based on CPU/memory/custom metrics
- Load balancer distributes traffic

#### 2. Database Sharding
- **User data**: Shard by user_id hash (100 shards)
- **Message data**: Shard by chat_id hash (1000 shards)
- **Presence data**: Shard by user_id hash (50 shards)
- Each shard can be on separate physical server

#### 3. Redis Clustering
- Redis Cluster with 16384 slots
- Consistent hashing for key distribution
- Master-slave replication per shard
- Automatic failover

#### 4. Kafka Partitioning
- 100 partitions per topic
- Partition by chat_id hash
- Each partition on separate broker
- Consumer groups for parallel processing

### Vertical Scaling

#### 1. Database Optimization
- Read replicas for read-heavy workloads
- Connection pooling (PgBouncer)
- Query optimization and indexing
- Materialized views for complex queries

#### 2. Caching Strategy
- Multi-level caching (L1: in-memory, L2: Redis)
- Cache warming for hot data
- Cache invalidation on updates
- CDN for static assets

### Geographic Scaling

#### 1. Multi-Region Deployment
- Primary region: US East
- Secondary regions: EU West, AP East
- GeoDNS for routing
- Cross-region replication

#### 2. Data Replication
- Async replication between regions
- Conflict resolution: last-write-wins
- Regional read preference
- Global write coordination

### Capacity Planning

#### 1. Resource Requirements (100M Users)

| Component | Instances | CPU | RAM | Storage |
|-----------|-----------|-----|-----|---------|
| API Gateway | 50 | 8 vCPU | 16 GB | - |
| WebSocket Service | 200 | 16 vCPU | 32 GB | - |
| Message Service | 100 | 8 vCPU | 16 GB | - |
| PostgreSQL (Primary) | 10 | 64 vCPU | 256 GB | 10 TB SSD |
| PostgreSQL (Replica) | 20 | 32 vCPU | 128 GB | 10 TB SSD |
| Redis Cluster | 30 | 16 vCPU | 64 GB | 2 TB SSD |
| Kafka Cluster | 15 | 32 vCPU | 128 GB | 50 TB SSD |
| Object Storage | - | - | - | 1 PB |

#### 2. Throughput Targets

| Metric | Target | Calculation |
|--------|--------|-------------|
| Concurrent Users | 10M | 10% of total users |
| Messages/Second | 1M | 0.1 msg/user/sec avg |
| Peak Messages/Second | 10M | 10x average |
| API Requests/Second | 100M | 10 req/user/sec avg |
| Storage Growth | 10 TB/day | 100 KB/msg avg |

### Auto-Scaling Configuration

```yaml
# Kubernetes Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: websocket-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: websocket-service
  minReplicas: 50
  maxReplicas: 500
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: active_connections
      target:
        type: AverageValue
        averageValue: "10000"
```

---

## Monitoring, Logging, and Fault Tolerance

### Monitoring Stack

#### 1. Metrics Collection
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and notification

#### 2. Key Metrics

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| API Latency (P95) | Histogram | > 100ms |
| Error Rate | Counter | > 1% |
| Message Throughput | Gauge | < 90% of target |
| Database Connections | Gauge | > 80% of max |
| Redis Memory | Gauge | > 80% of max |
| Kafka Lag | Gauge | > 10000 messages |
| WebSocket Connections | Gauge | < 90% of capacity |

#### 3. Dashboards

- **System Overview**: CPU, memory, network, disk
- **API Performance**: Latency, throughput, error rate
- **Database Performance**: Queries, connections, locks
- **Message Flow**: Throughput, queue depth, processing time
- **User Metrics**: Active users, messages per user, retention

### Logging Strategy

#### 1. Structured Logging
```go
import "github.com/rs/zerolog"

log := zerolog.New(os.Stdout).With().
    Timestamp().
    Str("service", "message_service").
    Str("version", "1.0.0").
    Logger()

log.Info().
    Str("user_id", userID).
    Str("chat_id", chatID).
    Str("message_id", messageID).
    Msg("message sent successfully")
```

#### 2. Log Levels
- **ERROR**: Errors requiring attention
- **WARN**: Warning conditions
- **INFO**: Normal operations
- **DEBUG**: Detailed debugging (dev only)

#### 3. Log Aggregation
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **Loki**: Lightweight log aggregation
- **Retention**: 30 days hot, 1 year cold

### Fault Tolerance

#### 1. Circuit Breakers
```go
import "github.com/sony/gobreaker"

cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
    Name:        "message_service",
    MaxRequests: 100,
    Interval:    time.Minute,
    Timeout:     30 * time.Second,
    ReadyToTrip: func(counts gobreaker.Counts) bool {
        return counts.ConsecutiveFailures > 5
    },
})

result, err := cb.Execute(func() (interface{}, error) {
    return ms.sendMessage(ctx, req)
})
```

#### 2. Retries with Exponential Backoff
```go
import "github.com/sethvargo/go-retry"

retry.Backoff(ctx, retry.WithMaxRetries(5, retry.NewExponential(100*time.Millisecond)), func(ctx context.Context) error {
    err := ms.sendMessage(ctx, req)
    if err != nil {
        return retry.RetryableError(err)
    }
    return nil
})
```

#### 3. Dead Letter Queues
```go
// Failed messages go to DLQ for manual inspection
dlqTopic := "messages_dlq"
if err := kafka.Publish(dlqTopic, failedMessage); err != nil {
    log.Error("failed to publish to DLQ", "error", err)
}
```

#### 4. Graceful Degradation
- Disable non-critical features under load
- Serve cached data when database slow
- Queue requests instead of rejecting
- Fallback to secondary region

### Disaster Recovery

#### 1. Backup Strategy
- **Database**: Daily full backups + continuous WAL archiving
- **Redis**: Daily RDB snapshots + AOF
- **Kafka**: Log compaction + retention
- **Object Storage**: Versioning + cross-region replication

#### 2. Failover Procedure
1. Detect failure (health checks)
2. Promote replica to primary
3. Update DNS/load balancer
4. Verify service health
5. Monitor for issues

#### 3. Recovery Time Objectives
- **RTO** (Recovery Time Objective): 15 minutes
- **RPO** (Recovery Point Objective): 5 minutes

### Security Monitoring

#### 1. Intrusion Detection
- Failed login attempts
- Unusual API usage patterns
- Data access anomalies
- Privilege escalation attempts

#### 2. Compliance Logging
- All data access logged
- Key usage tracked
- Audit trail for sensitive operations
- Regular security reviews
