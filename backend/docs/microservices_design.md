# GAPAK Messaging System - Microservices Design

## Service Overview

The messaging system consists of 12 core microservices, each with a single responsibility and designed for horizontal scaling.

---

## 1. Gateway Service

**Responsibility**: API entry point, request routing, authentication validation

**Key Functions**:
- HTTP/gRPC request routing to appropriate services
- JWT token validation and refresh
- Rate limiting per user/IP
- Request logging and tracing
- CORS handling
- API versioning

**Endpoints**:
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/health`

**Dependencies**:
- Redis (rate limiting, session cache)
- Security Service (token validation)
- All downstream services (via gRPC)

**Scaling**: Stateless, can scale to N instances

---

## 2. WebSocket Service

**Responsibility**: Real-time bidirectional communication with clients

**Key Functions**:
- WebSocket connection management
- Connection authentication
- Message push to connected clients
- Presence updates
- Connection heartbeat/keepalive
- Reconnection handling
- Message ordering per connection

**WebSocket Events**:
- `connect`: Establish connection
- `message`: Client sends message
- `typing`: Typing indicator
- `read_receipt`: Message read confirmation
- `presence`: Online/offline status
- `ping/pong`: Keepalive

**Dependencies**:
- Redis (connection registry, presence)
- Message Service (message delivery)
- Kafka (publish events)

**Scaling**: Stateless, sticky sessions via Redis connection registry

---

## 3. Message Service

**Responsibility**: Core message processing and routing

**Key Functions**:
- Message validation and sanitization
- Message encryption envelope creation
- Message persistence to database
- Message routing to recipients
- Message deduplication
- Message ordering (per chat)
- Edit/delete message handling
- Message search indexing

**API (gRPC)**:
- `SendMessage(Message) -> MessageID`
- `GetMessage(MessageID) -> Message`
- `GetMessages(ChatID, Pagination) -> []Message`
- `EditMessage(MessageID, Content) -> Success`
- `DeleteMessage(MessageID) -> Success`
- `SearchMessages(Query) -> []Message`

**Dependencies**:
- PostgreSQL (message storage)
- Redis (cache, deduplication)
- Kafka (publish message events)
- Security Service (encryption)

**Scaling**: Stateless, partition by chat_id in Kafka

---

## 4. Presence Service

**Responsibility**: User online/offline status and activity tracking

**Key Functions**:
- Track user online/offline status
- Track last seen timestamp
- Manage typing indicators
- Broadcast presence changes
- Handle device-specific presence
- Presence aggregation across devices

**API (gRPC)**:
- `SetOnline(UserID, DeviceID)`
- `SetOffline(UserID, DeviceID)`
- `SetTyping(UserID, ChatID)`
- `GetPresence(UserID) -> PresenceInfo`
- `GetBulkPresence([]UserID) -> []PresenceInfo`

**Dependencies**:
- Redis (presence storage, pub/sub)
- Kafka (publish presence events)
- WebSocket Service (push updates)

**Scaling**: Stateless, Redis cluster for presence data

---

## 5. Push Service

**Responsibility**: Push notification delivery for offline users

**Key Functions**:
- Generate and queue push notifications
- Multi-platform push (APNs, FCM, Web Push)
- Push token management
- Push payload encryption
- Push delivery tracking
- Retry failed pushes
- Push preference handling

**API (gRPC)**:
- `SendPush(UserID, Payload) -> PushID`
- `RegisterPushToken(UserID, Token, Platform)`
- `UnregisterPushToken(UserID, Token)`
- `GetPushStatus(PushID) -> Status`

**Dependencies**:
- Kafka (consume message events)
- PostgreSQL (push token storage)
- Redis (push queue, rate limiting)
- External: APNs, FCM, Web Push services

**Scaling**: Stateless, can scale to N instances

---

## 6. Security Service

**Responsibility**: Cryptographic operations and key management

**Key Functions**:
- End-to-end encryption key generation
- X3DH key exchange protocol
- Double Ratchet algorithm implementation
- Message encryption/decryption
- Key storage and rotation
- Perfect Forward Secrecy
- Replay attack prevention
- HMAC signature generation/verification

**API (gRPC)**:
- `GenerateKeyPair() -> PublicKey, PrivateKey`
- `PerformX3DH(IdentityKey, SignedPreKey, OneTimePreKey) -> SharedSecret`
- `EncryptMessage(Plaintext, Key) -> Ciphertext, Nonce`
- `DecryptMessage(Ciphertext, Nonce, Key) -> Plaintext`
- `RotateKeys(UserID) -> NewKeys`
- `VerifySignature(Message, Signature, PublicKey) -> bool`

**Dependencies**:
- HashiCorp Vault or AWS KMS (key storage)
- Redis (key cache)
- PostgreSQL (key metadata)

**Scaling**: Stateless, HSM-backed key storage

---

## 7. Chat Service

**Responsibility**: Chat/conversation management

**Key Functions**:
- Create/delete chats
- Add/remove chat members
- Chat metadata management
- Chat permissions
- Group chat administration
- Direct chat management
- Chat archiving

**API (gRPC)**:
- `CreateChat(Type, Members) -> ChatID`
- `DeleteChat(ChatID) -> Success`
- `AddMember(ChatID, UserID) -> Success`
- `RemoveMember(ChatID, UserID) -> Success`
- `UpdateChatMetadata(ChatID, Metadata) -> Success`
- `GetChat(ChatID) -> Chat`
- `GetUserChats(UserID) -> []Chat`

**Dependencies**:
- PostgreSQL (chat storage)
- Redis (cache)
- Message Service (message history)
- Kafka (publish chat events)

**Scaling**: Stateless, can scale to N instances

---

## 8. Device Service

**Responsibility**: Multi-device synchronization and management

**Key Functions**:
- Device registration
- Device key management
- Device synchronization
- Device revocation
- Cross-device message delivery
- Device-specific settings
- Device fingerprinting

**API (gRPC)**:
- `RegisterDevice(UserID, DeviceInfo) -> DeviceID`
- `UnregisterDevice(DeviceID) -> Success`
- `GetUserDevices(UserID) -> []Device`
- `SyncDevice(DeviceID, Since) -> []Message`
- `RevokeDevice(DeviceID) -> Success`
- `UpdateDeviceKeys(DeviceID, Keys) -> Success`

**Dependencies**:
- PostgreSQL (device storage)
- Redis (device cache)
- Security Service (key management)
- Message Service (message sync)

**Scaling**: Stateless, can scale to N instances

---

## 9. Receipt Service

**Responsibility**: Message delivery and read receipts

**Key Functions**:
- Track message delivery status
- Track message read status
- Generate delivery receipts
- Generate read receipts
- Receipt aggregation
- Receipt expiration
- Receipt notification

**API (gRPC)**:
- `MarkDelivered(MessageID, UserID) -> Success`
- `MarkRead(MessageID, UserID) -> Success`
- `GetDeliveryStatus(MessageID) -> []DeliveryInfo`
- `GetReadStatus(MessageID) -> []ReadInfo`
- `GetReceipts(UserID) -> []Receipt`

**Dependencies**:
- PostgreSQL (receipt storage)
- Redis (receipt cache)
- Kafka (publish receipt events)
- WebSocket Service (push receipts)

**Scaling**: Stateless, can scale to N instances

---

## 10. Media Service

**Responsibility**: Media upload, processing, and delivery

**Key Functions**:
- Media upload handling
- Media validation
- Media transcoding (video, audio)
- Thumbnail generation
- Media encryption
- Media storage
- CDN integration
- Media delivery

**API (gRPC)**:
- `UploadMedia(File, Metadata) -> MediaID`
- `GetMedia(MediaID) -> MediaURL`
- `DeleteMedia(MediaID) -> Success`
- `GenerateThumbnail(MediaID) -> ThumbnailID`
- `TranscodeVideo(MediaID, Format) -> VideoID`

**Dependencies**:
- Object Storage (S3/GCS)
- PostgreSQL (media metadata)
- Redis (media cache)
- Kafka (publish media events)
- FFmpeg (transcoding)

**Scaling**: Stateless, can scale to N instances

---

## 11. Search Service

**Responsibility**: Message and user search

**Key Functions**:
- Full-text message search
- User search
- Chat search
- Search indexing
- Search ranking
- Search autocomplete
- Faceted search

**API (gRPC)**:
- `SearchMessages(Query, Filters) -> []Message`
- `SearchUsers(Query, Filters) -> []User`
- `SearchChats(Query, Filters) -> []Chat`
- `GetSuggestions(Query) -> []Suggestion`
- `IndexMessage(Message) -> Success`

**Dependencies**:
- Elasticsearch or OpenSearch
- PostgreSQL (source data)
- Kafka (consume message events for indexing)

**Scaling**: Stateless, Elasticsearch cluster for search

---

## 12. Audit Service

**Responsibility**: Security audit logging and monitoring

**Key Functions**:
- Audit log generation
- Security event tracking
- Suspicious activity detection
- Compliance reporting
- Log retention
- Log analysis
- Alert generation

**API (gRPC)**:
- `LogAuditEvent(Event) -> Success`
- `GetAuditLogs(Filters) -> []AuditEvent`
- `GetSecurityReport(UserID, TimeRange) -> Report`
- `DetectSuspiciousActivity(UserID) -> []Flag`

**Dependencies**:
- PostgreSQL (audit log storage)
- Elasticsearch (log search)
- Kafka (consume all events)
- Monitoring Service (alerts)

**Scaling**: Stateless, can scale to N instances

---

## Service Communication Patterns

### Synchronous Communication (gRPC)
- Gateway → All services
- Service → Service (when immediate response needed)
- Used for: API calls, authentication, validation

### Asynchronous Communication (Kafka)
- Message Service → Push Service
- Message Service → Receipt Service
- Presence Service → WebSocket Service
- All Services → Audit Service
- Used for: Event propagation, background processing

### Cache Layer (Redis)
- Session data
- Presence information
- Rate limiting
- Frequently accessed data
- Temporary state

---

## Service Deployment Strategy

### Containerization
- Each service in separate Docker container
- Kubernetes for orchestration
- Resource limits per service
- Health checks configured

### Service Discovery
- Kubernetes native service discovery
- DNS-based service resolution
- gRPC load balancing

### Configuration Management
- Environment variables per service
- ConfigMaps for non-sensitive config
- Secrets for sensitive data (via Vault)
- Hot-reload support

### Observability
- Structured logging (JSON format)
- Distributed tracing (OpenTelemetry)
- Metrics (Prometheus)
- Health endpoints per service

---

## Failure Handling

### Circuit Breakers
- Implemented between services
- Timeout configuration
- Fallback mechanisms
- Automatic recovery

### Retries
- Exponential backoff
- Max retry limits
- Idempotent operations
- Dead letter queues

### Graceful Degradation
- Non-critical features disabled under load
- Cache serving when database slow
- Queue-based processing for heavy operations

### Disaster Recovery
- Multi-region deployment
- Database replication
- Backup and restore procedures
- Failover automation
