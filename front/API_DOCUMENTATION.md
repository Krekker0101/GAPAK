# Chat API Documentation

## Overview
This document describes the chat system API endpoints for the Gapak application. The chat system allows users to create direct chats, send messages, and retrieve message history.

## Base URL
```
http://localhost:8080/api
```

## Authentication
All chat endpoints require authentication using JWT Bearer tokens:
- **Header**: `Authorization: Bearer <access_token>`
- **CSRF Protection**: Mutating endpoints require CSRF token in `X-CSRF-Token` header

## Data Models

### ChatResponse
```typescript
{
  id: string;              // UUID of the chat
  participantIds: string[]; // Array of participant user IDs
  lastMessageAt?: string | null; // ISO 8601 timestamp of last message
  createdAt: string;       // ISO 8601 timestamp
  type?: string;          // "DIRECT" or "GROUP" (optional)
}
```

### MessageResponse
```typescript
{
  id: string;              // UUID of the message
  chatId: string;          // UUID of the chat
  senderId: string;        // UUID of the sender
  envelopeType: "TEXT" | "ATTACHMENT" | "KEY_EXCHANGE" | "SYSTEM";
  ciphertext: string;      // Encrypted message content
  nonce: string;           // Encryption nonce
  senderKeyId: string;     // Sender's encryption key ID
  attachmentManifest?: Record<string, unknown>; // Attachment metadata
  metadata?: Record<string, unknown>; // Additional metadata
  clientMessageId: string; // Client-generated message ID for deduplication
  sentAt: string;          // ISO 8601 timestamp
  editedAt?: string | null; // ISO 8601 timestamp if edited
  attachments?: MessageAttachmentResponse[]; // File attachments
}
```

### MessageAttachmentResponse
```typescript
{
  mediaFileId: string;      // UUID of the media file
  kind: string;            // "IMAGE", "VIDEO", "DOCUMENT", etc.
  status: string;          // "READY", "PROCESSING", "FAILED"
  originalName?: string | null; // Original filename
  mimeType: string;        // MIME type
  sizeBytes: number;      // File size in bytes
}
```

### ChatEventResponse
```typescript
{
  id: string;              // UUID of the event
  sequence: number;       // Event sequence number
  channel: string;         // Event channel name
  chatId: string;          // UUID of the chat
  eventType: string;       // "chat.message.sent", etc.
  payload: Record<string, unknown>; // Event payload
  createdAt: string;       // ISO 8601 timestamp
  relayedAt?: string | null; // ISO 8601 timestamp when relayed
}
```

## Endpoints

### 1. List User's Chats
**GET** `/chats`

Retrieves all chats the authenticated user is a member of.

**Authentication**: Required

**Query Parameters**: None

**Response**: `ChatResponse[]`

**Example Request**:
```http
GET /api/chats
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "participantIds": ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"],
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "requestId": "req_1234567890"
  }
}
```

---

### 2. Create Direct Chat
**POST** `/chats/direct`

Creates a new direct chat between the authenticated user and another user. If a direct chat already exists between the two users, it returns the existing chat.

**Authentication**: Required
**CSRF Protection**: Required

**Request Body**:
```typescript
{
  participantUserId: string; // UUID of the other user
}
```

**Response**: `ChatResponse`

**Example Request**:
```http
POST /api/chats/direct
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-CSRF-Token: csrf_token_here
Content-Type: application/json

{
  "participantUserId": "550e8400-e29b-41d4-a716-446655440002"
}
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "participantIds": ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"],
    "lastMessageAt": null,
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "requestId": "req_1234567890"
  }
}
```

**Error Responses**:
- `400`: Cannot create chat with yourself
- `404`: Participant user not found

---

### 3. Get Chat Messages
**GET** `/chats/:chatId/messages`

Retrieves messages for a specific chat. Messages are paginated and ordered chronologically.

**Authentication**: Required

**Path Parameters**:
- `chatId` (string): UUID of the chat

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 50, max: 100)

**Response**: `MessageResponse[]`

**Example Request**:
```http
GET /api/chats/550e8400-e29b-41d4-a716-446655440000/messages?page=1&limit=50
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "msg_1234567890",
      "chatId": "550e8400-e29b-41d4-a716-446655440000",
      "senderId": "550e8400-e29b-41d4-a716-446655440001",
      "envelopeType": "TEXT",
      "ciphertext": "encrypted_message_content",
      "nonce": "encryption_nonce",
      "senderKeyId": "key_id_123",
      "attachmentManifest": null,
      "metadata": null,
      "clientMessageId": "client_msg_123",
      "sentAt": "2024-01-15T10:30:00Z",
      "editedAt": null,
      "attachments": []
    }
  ],
  "meta": {
    "requestId": "req_1234567890"
  }
}
```

**Error Responses**:
- `403`: User is not a member of the chat
- `404`: Chat not found

---

### 4. Send Message
**POST** `/chats/:chatId/messages`

Sends a new message to a chat. Supports text messages and file attachments.

**Authentication**: Required
**CSRF Protection**: Required

**Path Parameters**:
- `chatId` (string): UUID of the chat

**Request Body**:
```typescript
{
  clientMessageId: string;      // Client-generated unique ID (8-128 chars)
  envelopeType: "TEXT" | "ATTACHMENT" | "KEY_EXCHANGE" | "SYSTEM";
  ciphertext: string;            // Encrypted message content (1-50000 chars)
  nonce: string;                // Encryption nonce (8-255 chars)
  senderKeyId: string;          // Sender's encryption key ID (3-255 chars)
  attachmentManifest?: Record<string, unknown>; // Attachment metadata
  metadata?: Record<string, unknown>; // Additional metadata
}
```

**Response**: `MessageResponse`

**Example Request**:
```http
POST /api/chats/550e8400-e29b-41d4-a716-446655440000/messages
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-CSRF-Token: csrf_token_here
Content-Type: application/json

{
  "clientMessageId": "client_msg_456",
  "envelopeType": "TEXT",
  "ciphertext": "encrypted_hello_world",
  "nonce": "nonce_123456",
  "senderKeyId": "key_id_123",
  "metadata": {
    "source": "web.chat",
    "transport": "durable-events"
  }
}
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "id": "msg_9876543210",
    "chatId": "550e8400-e29b-41d4-a716-446655440000",
    "senderId": "550e8400-e29b-41d4-a716-446655440001",
    "envelopeType": "TEXT",
    "ciphertext": "encrypted_hello_world",
    "nonce": "nonce_123456",
    "senderKeyId": "key_id_123",
    "attachmentManifest": null,
    "metadata": {
      "source": "web.chat",
      "transport": "durable-events"
    },
    "clientMessageId": "client_msg_456",
    "sentAt": "2024-01-15T10:35:00Z",
    "editedAt": null,
    "attachments": []
  },
  "meta": {
    "requestId": "req_1234567890"
  }
}
```

**Error Responses**:
- `400`: Invalid request data or attachment not ready
- `403`: User is not a member of the chat
- `404`: Chat not found

---

### 5. Get Chat Events
**GET** `/chats/:chatId/events`

Retrieves real-time events for a chat, used for polling updates. Events are ordered by sequence number.

**Authentication**: Required

**Path Parameters**:
- `chatId` (string): UUID of the chat

**Query Parameters**:
- `after` (number, optional): Sequence number to fetch events after (default: 0)
- `limit` (number, optional): Number of events to fetch (default: 50, max: 100)

**Response**: `ChatEventResponse[]` with pagination metadata

**Example Request**:
```http
GET /api/chats/550e8400-e29b-41d4-a716-446655440000/events?after=0&limit=50
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "evt_1234567890",
      "sequence": 1,
      "channel": "realtime:direct-chat:550e8400-e29b-41d4-a716-446655440000",
      "chatId": "550e8400-e29b-41d4-a716-446655440000",
      "eventType": "chat.message.sent",
      "payload": {
        "chatId": "550e8400-e29b-41d4-a716-446655440000",
        "message": {
          "id": "msg_9876543210",
          "chatId": "550e8400-e29b-41d4-a716-446655440000",
          "senderId": "550e8400-e29b-41d4-a716-446655440001",
          "envelopeType": "TEXT",
          "ciphertext": "encrypted_hello_world",
          "nonce": "nonce_123456",
          "senderKeyId": "key_id_123",
          "clientMessageId": "client_msg_456",
          "sentAt": "2024-01-15T10:35:00Z"
        }
      },
      "createdAt": "2024-01-15T10:35:00Z",
      "relayedAt": null
    }
  ],
  "meta": {
    "requestId": "req_1234567890",
    "pagination": {
      "after": 0,
      "limit": 50,
      "hasMore": false,
      "nextCursor": 1
    }
  }
}
```

**Error Responses**:
- `403`: User is not a member of the chat
- `404`: Chat not found

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "error_code",
    "message": "Human-readable error message",
    "details": {
      // Additional error details (optional)
    }
  },
  "meta": {
    "requestId": "req_1234567890"
  }
}
```

### Common Error Codes
- `http.unauthorized`: Authentication required or invalid token
- `http.forbidden`: User lacks permission for this resource
- `http.not_found`: Resource not found
- `http.validation_error`: Request validation failed
- `chats.self_chat_forbidden`: Cannot create chat with yourself
- `chats.attachment_not_ready`: Attachment is missing, not ready, or doesn't belong to sender

---

## Rate Limiting
- Auth endpoints have rate limiting configured
- Chat endpoints may have rate limiting for message sending to prevent spam

---

## Security Notes
1. **Message Encryption**: All message content is encrypted client-side before sending
2. **CSRF Protection**: All mutating endpoints require valid CSRF tokens
3. **Authorization**: Users can only access chats they are members of
4. **Attachment Validation**: Attachments must be uploaded and marked as READY before use in messages
