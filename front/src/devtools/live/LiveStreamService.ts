/**
 * GAPAK Live Stream Platform Service
 * Phase 4 - Live Domain Service Layer
 *
 * Manages stream lifecycles (SCHEDULED, LIVE, ENDING, ENDED, REPLAY, ERROR),
 * live chat rate limiting, viewer stats, and event broadcasts.
 */

import { LiveStream, LiveChatMessage, LiveStreamEvent, LiveStreamState } from '../../shared/types';
import { INITIAL_LIVE_STREAMS, INITIAL_LIVE_CHAT_MESSAGES, INITIAL_LIVE_EVENTS } from '../mocks/live/mockLiveData';
import { CURRENT_USER } from '../mocks/api/socialMockData';

type StreamListener = (streams: LiveStream[]) => void;
type ChatListener = (messages: LiveChatMessage[]) => void;
type EventListener = (events: LiveStreamEvent[]) => void;

export class LiveStreamService {
  private static streams: LiveStream[] = [...INITIAL_LIVE_STREAMS];
  private static chatMap: Record<string, LiveChatMessage[]> = { ...INITIAL_LIVE_CHAT_MESSAGES };
  private static eventsMap: Record<string, LiveStreamEvent[]> = { ...INITIAL_LIVE_EVENTS };

  private static streamListeners: Set<StreamListener> = new Set();
  private static chatListeners: Map<string, Set<ChatListener>> = new Map();
  private static eventListeners: Map<string, Set<EventListener>> = new Map();

  private static lastSentTimestamp: Map<string, number> = new Map(); // Rate limiting per user

  public static getStreams(): LiveStream[] {
    return [...this.streams];
  }

  public static getStreamById(id: string): LiveStream | undefined {
    return this.streams.find((s) => s.id === id);
  }

  public static subscribeStreams(listener: StreamListener): () => void {
    this.streamListeners.add(listener);
    listener(this.getStreams());
    return () => this.streamListeners.delete(listener);
  }

  public static subscribeChat(streamId: string, listener: ChatListener): () => void {
    if (!this.chatListeners.has(streamId)) {
      this.chatListeners.set(streamId, new Set());
    }
    const set = this.chatListeners.get(streamId)!;
    set.add(listener);
    listener(this.chatMap[streamId] || []);

    return () => set.delete(listener);
  }

  public static subscribeEvents(streamId: string, listener: EventListener): () => void {
    if (!this.eventListeners.has(streamId)) {
      this.eventListeners.set(streamId, new Set());
    }
    const set = this.eventListeners.get(streamId)!;
    set.add(listener);
    listener(this.eventsMap[streamId] || []);

    return () => set.delete(listener);
  }

  private static notifyStreams() {
    const list = this.getStreams();
    this.streamListeners.forEach((fn) => fn(list));
  }

  private static notifyChat(streamId: string) {
    const list = this.chatMap[streamId] || [];
    const set = this.chatListeners.get(streamId);
    if (set) set.forEach((fn) => fn(list));
  }

  private static notifyEvents(streamId: string) {
    const list = this.eventsMap[streamId] || [];
    const set = this.eventListeners.get(streamId);
    if (set) set.forEach((fn) => fn(list));
  }

  /**
   * Create or Schedule a new stream
   */
  public static createStream(payload: {
    title: string;
    description?: string;
    isScheduled: boolean;
    scheduledAt?: string;
    allowReplay: boolean;
    tags?: string[];
  }): LiveStream {
    const newStream: LiveStream = {
      id: `stream_${Date.now()}`,
      title: payload.title,
      description: payload.description,
      host: CURRENT_USER,
      state: payload.isScheduled ? 'SCHEDULED' : 'LIVE',
      scheduledAt: payload.scheduledAt,
      startedAt: payload.isScheduled ? undefined : new Date().toISOString(),
      currentViewersCount: payload.isScheduled ? 0 : 1,
      peakViewersCount: payload.isScheduled ? 0 : 1,
      likesCount: 0,
      coverImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
      allowReplay: payload.allowReplay,
      replayStatus: payload.allowReplay ? 'PROCESSING' : 'UNAVAILABLE',
      tags: payload.tags || ['GAPAK', 'Live'],
      latencyMs: 340,
      createdAt: new Date().toISOString(),
    };

    this.streams.unshift(newStream);
    this.chatMap[newStream.id] = [
      {
        id: `msg_init_${Date.now()}`,
        streamId: newStream.id,
        sender: CURRENT_USER,
        text: payload.isScheduled ? 'Stream scheduled!' : 'Live broadcast started!',
        isSystem: true,
        createdAt: new Date().toISOString(),
      },
    ];
    this.eventsMap[newStream.id] = [];

    this.notifyStreams();
    return newStream;
  }

  /**
   * Transition Stream State Machine: SCHEDULED -> LIVE -> ENDING -> ENDED -> REPLAY
   */
  public static transitionState(streamId: string, newState: LiveStreamState): LiveStream {
    let updatedStream: LiveStream | null = null;

    this.streams = this.streams.map((s) => {
      if (s.id !== streamId) return s;

      const patch: Partial<LiveStream> = { state: newState };
      if (newState === 'LIVE') {
        patch.startedAt = new Date().toISOString();
        patch.currentViewersCount = Math.max(1, s.currentViewersCount);
      } else if (newState === 'ENDED') {
        patch.endedAt = new Date().toISOString();
        patch.currentViewersCount = 0;
        if (s.allowReplay) {
          patch.replayStatus = 'PROCESSING';
          // Simulate background transcoding -> REPLAY
          setTimeout(() => {
            this.transitionState(streamId, 'REPLAY');
          }, 3000);
        }
      } else if (newState === 'REPLAY') {
        patch.replayStatus = 'READY';
        patch.replayMediaId = `med_replay_${streamId}`;
      }

      updatedStream = { ...s, ...patch };
      return updatedStream;
    });

    // Add system chat message for state transition
    if (updatedStream) {
      const sysMsg: LiveChatMessage = {
        id: `sys_${Date.now()}`,
        streamId,
        sender: CURRENT_USER,
        text: `Stream status changed to ${newState}`,
        isSystem: true,
        createdAt: new Date().toISOString(),
      };
      this.chatMap[streamId] = [...(this.chatMap[streamId] || []), sysMsg];
      this.notifyChat(streamId);
    }

    this.notifyStreams();
    return updatedStream!;
  }

  /**
   * Send Rate-Limited Live Chat Message
   * Rate limit: max 1 msg per 2 seconds per user.
   *
   * `clientMessageId` is a client-generated idempotency key. If a message
   * with the same key was already accepted for this stream, the existing
   * message is returned instead of creating a duplicate: this mirrors the
   * `clientMessageId` contract used by src/domains/chats (see chatsApi.sendMessage)
   * and is what the real backend endpoint (see docs/REALTIME.md TODO) must
   * also honor once live chat moves off this local mock.
   *
   * NOTE: this service has no real network transport, so a send here cannot
   * actually fail or need a retry-with-backoff — that behavior is exercised
   * end-to-end only once the backend WebSocket/HTTP endpoint for live chat
   * exists. Messages are marked 'sent' immediately, and `status`/`clientMessageId`
   * are populated now so the UI and retry plumbing (`retryChatMessage`) do not
   * need to change again when that backend contract lands.
   */
  public static sendChatMessage(
    streamId: string,
    text: string,
    clientMessageId: string = crypto.randomUUID(),
  ): { success: boolean; message?: LiveChatMessage; error?: string; cooldownSec?: number } {
    const existing = (this.chatMap[streamId] || []).find((m) => m.clientMessageId === clientMessageId);
    if (existing) return { success: true, message: existing };

    const now = Date.now();
    const lastSent = this.lastSentTimestamp.get(CURRENT_USER.id) || 0;
    const cooldownMs = 2000;

    if (now - lastSent < cooldownMs) {
      const remainingSec = Math.ceil((cooldownMs - (now - lastSent)) / 1000);
      return {
        success: false,
        error: `Rate limit active. Please wait ${remainingSec}s before sending another message.`,
        cooldownSec: remainingSec,
      };
    }

    this.lastSentTimestamp.set(CURRENT_USER.id, now);

    const newMsg: LiveChatMessage = {
      id: `lc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      streamId,
      sender: CURRENT_USER,
      text,
      clientMessageId,
      status: 'sent',
      createdAt: new Date().toISOString(),
    };

    this.chatMap[streamId] = [...(this.chatMap[streamId] || []), newMsg];
    this.notifyChat(streamId);

    return { success: true, message: newMsg };
  }

  /**
   * Re-attempts a failed outbound live-chat message using the same
   * idempotency key. The text the user typed is preserved by the caller
   * (the message object itself) regardless of outcome; this never mutates
   * or clears `text` on failure.
   */
  public static retryChatMessage(streamId: string, clientMessageId: string): { success: boolean; message?: LiveChatMessage; error?: string } {
    const current = (this.chatMap[streamId] || []).find((m) => m.clientMessageId === clientMessageId);
    if (!current) return { success: false, error: 'Message no longer available for retry in this session.' };
    if (current.status !== 'failed') return { success: true, message: current };

    const result = this.sendChatMessage(streamId, current.text, clientMessageId);
    if (!result.success) return { success: false, error: result.error };
    this.chatMap[streamId] = (this.chatMap[streamId] || []).map((m) => (m.clientMessageId === clientMessageId ? { ...m, status: 'sent' as const } : m));
    this.notifyChat(streamId);
    return { success: true, message: result.message };
  }

  /**
   * Like / Heart action
   */
  public static sendLike(streamId: string) {
    this.streams = this.streams.map((s) =>
      s.id === streamId ? { ...s, likesCount: s.likesCount + 1 } : s
    );
    this.notifyStreams();

    const evt: LiveStreamEvent = {
      id: `evt_like_${Date.now()}`,
      streamId,
      type: 'like',
      user: CURRENT_USER,
      timestamp: new Date().toISOString(),
    };
    this.eventsMap[streamId] = [...(this.eventsMap[streamId] || []), evt];
    this.notifyEvents(streamId);
  }
}
