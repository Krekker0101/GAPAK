# Chat API Documentation

## Overview
The chat system provides direct messaging capabilities with end-to-end encryption support, file attachments, and real-time event streaming.

## Base URL
All endpoints are prefixed with `/api` and require authentication via JWT token.

## Authentication
All chat endpoints require authentication. Include the JWT access token in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

## Data Models

### ChatResponse
```typescript
{
  id: string;                    // UUID of the chat
  participantIds: string[];      // Array of user UUIDs in the chat
  lastMessageAt?: string;       // ISO 8601 timestamp of last message
  createdAt: string;            // ISO 8601 timestamp when chat was created
}
```

### MessageResponse
```typescript
{
  id: string;                    // UUID of the message
  chatId: string;                // UUID of the chat
  senderId: string;              // UUID of the sender
  envelopeType: "TEXT" | "ATTACHMENT" | "KEY_EXCHANGE" | "SYSTEM";
  ciphertext: string;            // Encrypted message content
  nonce: string;                 // Encryption nonce
  senderKeyId: string;           // Sender's key identifier
  attachmentManifest?: object;    // Attachment metadata
  metadata?: object;             // Additional message metadata
  clientMessageId: string;       // Client-generated message ID for deduplication
  sentAt: string;                // ISO 8601 timestamp
  editedAt?: string;             // ISO 8601 timestamp if edited
  attachments?: MessageAttachmentResponse[];
}
```

### MessageAttachmentResponse
```typescript
{
  mediaFileId: string;           // UUID of the media file
  kind: string;                  // Media kind (IMAGE, VIDEO, DOCUMENT, etc.)
  status: string;                // Media status (READY, PENDING, etc.)
  originalName?: string;         // Original filename
  mimeType: string;              // MIME type
  sizeBytes: number;            // Size in bytes
}
```

### ChatEventResponse
```typescript
{
  id: string;                    // UUID of the event
  sequence: number;              // Event sequence number for ordering
  channel: string;               // Event channel name
  chatId: string;                // UUID of the chat
  eventType: string;             // Event type (e.g., "chat.message.sent")
  payload: object;               // Event payload
  createdAt: string;            // ISO 8601 timestamp
  relayedAt?: string;            // ISO 8601 timestamp when relayed
}
```

## API Endpoints

### 1. List User Chats
**Endpoint:** `GET /chats`

**Description:** Retrieves all chats the authenticated user is a participant in, ordered by most recent activity.

**Authentication:** Required

**Query Parameters:** None

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "participantIds": ["user-uuid-1", "user-uuid-2"],
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-01T08:00:00Z"
    }
  ],
  "meta": {
    "requestId": "uuid"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication token
- `500 Internal Server Error`: Server error

---

### 2. Create Direct Chat
**Endpoint:** `POST /chats/direct`

**Description:** Creates a new direct chat with another user. If a direct chat already exists between the two users, returns the existing chat.

**Authentication:** Required

**Request Body:**
```json
{
  "participantUserId": "uuid"  // Required: UUID of the other user
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "participantIds": ["current-user-uuid", "participant-user-uuid"],
    "lastMessageAt": null,
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid participant ID or attempting to chat with self
- `401 Unauthorized`: Invalid or missing authentication token
- `404 Not Found`: Participant user does not exist
- `500 Internal Server Error`: Server error

---

### 3. Get Chat Messages
**Endpoint:** `GET /chats/:chatId/messages`

**Description:** Retrieves messages from a specific chat with pagination support.

**Authentication:** Required

**Path Parameters:**
- `chatId` (string, required): UUID of the chat

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1, min: 1)
- `limit` (integer, optional): Items per page (default: 50, min: 1, max: 100)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "chatId": "uuid",
      "senderId": "uuid",
      "envelopeType": "TEXT",
      "ciphertext": "encrypted-content",
      "nonce": "nonce-value",
      "senderKeyId": "key-id",
      "attachmentManifest": null,
      "metadata": {},
      "clientMessageId": "client-uuid",
      "sentAt": "2024-01-15T10:30:00Z",
      "editedAt": null,
      "attachments": []
    }
  ],
  "meta": {
    "requestId": "uuid"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid chat ID or query parameters
- `401 Unauthorized`: Invalid or missing authentication token
- `403 Forbidden`: User is not a participant in the chat
- `404 Not Found`: Chat does not exist
- `500 Internal Server Error`: Server error

---

### 4. Send Message
**Endpoint:** `POST /chats/:chatId/messages`

**Description:** Sends a new message to a chat. Supports text messages and file attachments.

**Authentication:** Required

**Path Parameters:**
- `chatId` (string, required): UUID of the chat

**Request Body:**
```json
{
  "clientMessageId": "uuid",           // Required: Client-generated unique ID (8-128 chars)
  "envelopeType": "TEXT",               // Required: One of TEXT, ATTACHMENT, KEY_EXCHANGE, SYSTEM
  "ciphertext": "encrypted-content",    // Required: Encrypted message content (1-50000 chars)
  "nonce": "nonce-value",               // Required: Encryption nonce (8-255 chars)
  "senderKeyId": "key-id",              // Required: Sender's key identifier (3-255 chars)
  "attachmentManifest": {               // Optional: Attachment metadata
    "mediaId": "uuid",                  // or
    "mediaIds": ["uuid1", "uuid2"],     // or
    "attachments": [
      {
        "mediaId": "uuid",
        "fileName": "file.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 1024
      }
    ]
  },
  "metadata": {                         // Optional: Additional metadata
    "source": "web.chat",
    "transport": "durable-events"
  }
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "chatId": "uuid",
    "senderId": "uuid",
    "envelopeType": "TEXT",
    "ciphertext": "encrypted-content",
    "nonce": "nonce-value",
    "senderKeyId": "key-id",
    "attachmentManifest": {},
    "metadata": {},
    "clientMessageId": "client-uuid",
    "sentAt": "2024-01-15T10:30:00Z",
    "editedAt": null,
    "attachments": []
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request body, attachment not ready, or validation error
- `401 Unauthorized`: Invalid or missing authentication token
- `403 Forbidden`: User is not a participant in the chat
- `404 Not Found`: Chat does not exist
- `500 Internal Server Error`: Server error

---

### 5. Get Chat Events
**Endpoint:** `GET /chats/:chatId/events`

**Description:** Retrieves real-time events for a chat, used for live message updates. Supports cursor-based pagination.

**Authentication:** Required

**Path Parameters:**
- `chatId` (string, required): UUID of the chat

**Query Parameters:**
- `after` (integer, optional): Sequence number to fetch events after (default: 0, min: 0)
- `limit` (integer, optional): Number of events to fetch (default: 50, min: 1, max: 100)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "sequence": 123,
      "channel": "realtime:direct-chat:uuid",
      "chatId": "uuid",
      "eventType": "chat.message.sent",
      "payload": {
        "chatId": "uuid",
        "message": {
          "id": "uuid",
          "chatId": "uuid",
          "senderId": "uuid",
          "envelopeType": "TEXT",
          "ciphertext": "encrypted-content",
          "nonce": "nonce-value",
          "senderKeyId": "key-id",
          "attachmentManifest": {},
          "attachments": [],
          "metadata": {},
          "clientMessageId": "client-uuid",
          "sentAt": "2024-01-15T10:30:00Z",
          "editedAt": null
        }
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "relayedAt": "2024-01-15T10:30:01Z"
    }
  ],
  "meta": {
    "requestId": "uuid",
    "pagination": {
      "after": 0,
      "limit": 50,
      "hasMore": true,
      "nextCursor": 173
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid chat ID or query parameters
- `401 Unauthorized`: Invalid or missing authentication token
- `403 Forbidden`: User is not a participant in the chat
- `404 Not Found`: Chat does not exist
- `500 Internal Server Error`: Server error

## Event Types

### chat.message.sent
Emitted when a new message is sent to the chat. The payload contains the full message object.

## Rate Limiting
All chat endpoints are subject to global rate limiting configured on the server.

## Encryption
The chat system supports end-to-end encryption:
- `ciphertext`: Contains the encrypted message content
- `nonce`: Used for encryption/decryption
- `senderKeyId`: Identifies which sender key was used
- `envelopeType`: Indicates the type of message (TEXT, ATTACHMENT, KEY_EXCHANGE, SYSTEM)

## File Attachments
To send file attachments:
1. Upload the file using the media upload API
2. Get the `mediaFileId` from the upload response
3. Include the `mediaFileId` in the `attachmentManifest` when sending the message
4. The attachment must be in `READY` status before it can be attached

## Pagination
- Messages use offset-based pagination (`page` and `limit`)
- Events use cursor-based pagination (`after` sequence number and `limit`)
- Both support a maximum of 100 items per request

## Error Handling
All error responses follow this format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "meta": {
    "requestId": "uuid"
  }
}
```
