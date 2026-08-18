import type {
  AckRealtimeEvent,
  BackendChatMessage,
  BackendRealtimeMessage,
  ChatRealtimeEvent,
  ErrorRealtimeEvent,
  HistoryRealtimeEvent,
  RealtimeEvent,
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing ${field}`);
  return value;
};

const parseMessage = (value: unknown): BackendChatMessage => {
  if (!isRecord(value)) throw new Error('Realtime chat message must be an object');
  const message = value as Partial<BackendChatMessage>;
  requireString(message.id, 'message.id');
  requireString(message.chatId, 'message.chatId');
  requireString(message.senderId, 'message.senderId');
  if (typeof message.sequenceNumber !== 'number' || !Number.isSafeInteger(message.sequenceNumber) || message.sequenceNumber < 0) {
    throw new Error('Invalid message.sequenceNumber');
  }
  requireString(message.ciphertext, 'message.ciphertext');
  requireString(message.nonce, 'message.nonce');
  requireString(message.senderKeyId, 'message.senderKeyId');
  requireString(message.encryptionProtocol, 'message.encryptionProtocol');
  requireString(message.sentAt, 'message.sentAt');
  return message as BackendChatMessage;
};

export function parseRealtimeFrame(raw: unknown): RealtimeEvent {
  if (!isRecord(raw)) throw new Error('WebSocket frame must be an object');

  const frame = raw as unknown as BackendRealtimeMessage;
  const type = requireString(frame.type, 'type');

  if (type === 'history') {
    if (!Array.isArray(frame.data)) throw new Error('history.data must be an array');
    const messages = frame.data.map(parseMessage);
    const result: HistoryRealtimeEvent = { kind: 'history', requestId: frame.id, messages };
    return result;
  }

  if (
    type === 'chat.message.created' ||
    type === 'chat.message.edited' ||
    type === 'chat.message.deleted' ||
    type === 'chat.read_receipt' ||
    type === 'chat.typing'
  ) {
    const eventId = requireString(frame.eventId ?? frame.id, 'eventId');
    if (frame.data === undefined) throw new Error(`Missing data for ${type}`);

    const data = isRecord(frame.data) ? frame.data : undefined;
    const chatId = typeof frame.chatId === 'string'
      ? frame.chatId
      : typeof data?.chatId === 'string'
      ? data.chatId
      : typeof data?.chat_id === 'string'
        ? data.chat_id
        : undefined;
    const messageId = typeof frame.messageId === 'string'
      ? frame.messageId
      : typeof data?.id === 'string'
        ? data.id
        : typeof data?.messageId === 'string'
          ? data.messageId
          : undefined;

    let sequence: number | undefined;
    if (type.startsWith('chat.message.')) {
      const message = parseMessage(frame.data);
      sequence = typeof frame.sequence === 'number' ? frame.sequence : message.sequenceNumber;
      const event: ChatRealtimeEvent = {
        kind: 'event',
        eventId,
        type,
        chatId: message.chatId,
        messageId: message.id,
        sequence,
        data: message,
      };
      return event;
    }

    const event: ChatRealtimeEvent = { kind: 'event', eventId, type, chatId, messageId, data: frame.data };
    return event;
  }

  if (type === 'ack' || type === 'read_receipt_ack' || type === 'delivery_ack') {
    const event: AckRealtimeEvent = {
      kind: 'ack',
      id: frame.id,
      ackFor: frame.ackFor,
      type,
      data: frame.data,
    };
    return event;
  }

  if (type === 'error') {
    const payload = isRecord(frame.data) ? frame.data : {};
    const event: ErrorRealtimeEvent = {
      kind: 'error',
      code: typeof payload.code === 'string' ? payload.code : undefined,
      message: typeof payload.message === 'string' ? payload.message : 'WebSocket request failed',
      details: payload.details,
    };
    return event;
  }

  throw new Error(`Unsupported backend WebSocket event: ${type}`);
}
