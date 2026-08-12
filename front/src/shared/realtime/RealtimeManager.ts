import { QueryClient } from '@tanstack/react-query';
import { telemetry } from '../telemetry/telemetry';
import { ConnectionManager } from './ConnectionManager';
import { RealtimeAuthentication } from './RealtimeAuthentication';
import type {
  BackendChatMessage,
  BackendRealtimeMessage,
  RealtimeConnectionState,
  RealtimeEvent,
} from './types';
import { authManager } from '../api/authManager';
import { RealtimeEventRouter } from './EventRouter';

class RealtimeManager {
  private connection: ConnectionManager | null = null;
  private router: RealtimeEventRouter | null = null;
  private queryClient: QueryClient | null = null;
  private state: RealtimeConnectionState = 'CLOSED';
  private stateListeners = new Set<(state: RealtimeConnectionState) => void>();
  private authFailureListeners = new Set<(error: Error) => void>();
  private tabChannel: BroadcastChannel | null = null;

  private readonly subscribedChats = new Set<string>();
  private readonly activeChatSubscriptions = new Set<string>();
  private readonly lastAppliedSequence = new Map<string, number>();

  initialize(queryClient: QueryClient): void {
    if (this.connection) return;

    this.queryClient = queryClient;
    this.router = new RealtimeEventRouter(queryClient);
    this.connection = new ConnectionManager(
      new RealtimeAuthentication(),
      (event) => this.handleEvent(event),
      (error) => this.handleAuthFailure(error),
    );

    this.connection.onStateChange((state) => {
      this.state = state;
      this.stateListeners.forEach((listener) => listener(state));
      if (state === 'CONNECTED') this.resubscribeChats();
    });

    if (typeof BroadcastChannel !== 'undefined') {
      this.tabChannel = new BroadcastChannel('gapak-realtime');
      this.tabChannel.onmessage = (message) => {
        if (message.data?.type === 'session.logout') {
          this.disconnect('cross_tab_logout');
          authManager.clearSession();
          this.queryClient?.clear();
          window.dispatchEvent(new CustomEvent('gapak:cross-tab-logout'));
        }
        if (message.data?.type === 'notification.read') {
          this.queryClient?.invalidateQueries({ queryKey: ['notifications'] });
          this.queryClient?.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        }
      };
    }
  }

  connect(): void {
    this.connection?.connect();
  }

  disconnect(reason?: string): void {
    this.connection?.disconnect(reason);
    this.activeChatSubscriptions.clear();
  }

  getState(): RealtimeConnectionState {
    return this.state;
  }

  subscribe(type: string, handler: (event: RealtimeEvent) => void): () => void {
    return this.router?.subscribe(type, handler) ?? (() => undefined);
  }

  onStateChange(listener: (state: RealtimeConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  onAuthFailure(listener: (error: Error) => void): () => void {
    this.authFailureListeners.add(listener);
    return () => this.authFailureListeners.delete(listener);
  }

  subscribeToChat(chatId: string): boolean {
    if (!chatId) return false;
    this.subscribedChats.add(chatId);

    if (this.state !== 'CONNECTED' || this.activeChatSubscriptions.has(chatId)) return true;

    return this.sendChatSubscription(chatId);
  }

  unsubscribeFromChat(chatId: string): boolean {
    const existed = this.subscribedChats.delete(chatId);
    if (!existed) return false;

    this.activeChatSubscriptions.delete(chatId);
    if (this.state !== 'CONNECTED') return true;

    // Backend subscription commands use snake_case and do not require a client
    // event ID. This is a control mutation, not a durable message mutation.
    return this.connection?.send({
      type: 'unsubscribe',
      data: { chat_id: chatId },
    }) ?? false;
  }

  clearChatSubscriptions(): void {
    this.subscribedChats.clear();
    this.activeChatSubscriptions.clear();
    this.lastAppliedSequence.clear();
  }

  broadcastNotificationRead(notificationId: string): void {
    this.tabChannel?.postMessage({ type: 'notification.read', notificationId });
  }

  broadcastLogout(): void {
    this.tabChannel?.postMessage({ type: 'session.logout', timestamp: Date.now() });
  }

  dispose(): void {
    this.connection?.dispose();
    this.tabChannel?.close();
    this.router?.clearHistory();
    this.connection = null;
    this.router = null;
    this.tabChannel = null;
    this.subscribedChats.clear();
    this.activeChatSubscriptions.clear();
    this.lastAppliedSequence.clear();
  }

  private sendChatSubscription(chatId: string): boolean {
    if (this.activeChatSubscriptions.has(chatId)) return true;

    const afterSequence = this.lastAppliedSequence.get(chatId);
    const data: Record<string, unknown> = { chat_id: chatId };
    if (afterSequence !== undefined) data.after_sequence = afterSequence;

    const sent = this.connection?.send({ type: 'subscribe', data }) ?? false;
    if (sent) this.activeChatSubscriptions.add(chatId);
    return sent;
  }

  private resubscribeChats(): void {
    if (this.state !== 'CONNECTED') return;
    this.activeChatSubscriptions.clear();

    this.subscribedChats.forEach((chatId) => {
      this.sendChatSubscription(chatId);
    });
  }

  private handleEvent(event: RealtimeEvent): void {
    this.updateSequence(event);
    if (event.kind === 'error') {
      if (event.code === 'UNAUTHORIZED' || event.code === 'AUTHENTICATION_FAILED' || event.code === 'INVALID_TOKEN') {
        this.handleAuthFailure(new Error(event.message));
        return;
      }
    }
    this.router?.route(event);
  }

  private updateSequence(event: RealtimeEvent): void {
    if (event.kind === 'history') {
      for (const message of event.messages) this.recordMessageSequence(message);
      return;
    }
    if (event.kind === 'event' && event.type.startsWith('chat.message.')) {
      if (typeof event.sequence === 'number' && event.chatId) {
        this.recordSequence(event.chatId, event.sequence);
      }
    }
  }

  private recordMessageSequence(message: BackendChatMessage): void {
    this.recordSequence(message.chatId, message.sequenceNumber);
  }

  private recordSequence(chatId: string, sequence: number): void {
    const current = this.lastAppliedSequence.get(chatId);
    if (current === undefined || sequence > current) this.lastAppliedSequence.set(chatId, sequence);
  }

  private handleAuthFailure(error: Error): void {
    telemetry.record('websocket', 'ws_auth_failure', 'warn');
    this.authFailureListeners.forEach((listener) => listener(error));
  }
}

export const realtimeManager = new RealtimeManager();
