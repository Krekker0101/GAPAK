import { QueryClient } from '@tanstack/react-query';
import { telemetry } from '../telemetry/telemetry';
import { ConnectionManager } from './ConnectionManager';
import { RealtimeAuthentication } from './RealtimeAuthentication';
import { RealtimeEventRouter } from './EventRouter';
import { RealtimeConnectionState, RealtimeEnvelope, RealtimeEvent } from './types';
import { deviceKeyStore } from '../security/deviceKeyStore';
import { authManager } from '../api/authManager';

class RealtimeManager {
  private connection: ConnectionManager | null = null;
  private router: RealtimeEventRouter | null = null;
  private queryClient: QueryClient | null = null;
  private state: RealtimeConnectionState = 'DISCONNECTED';
  private stateListeners = new Set<(state: RealtimeConnectionState) => void>();
  private authFailureListeners = new Set<(error: Error) => void>();
  private tabChannel: BroadcastChannel | null = null;
  private subscribedChats = new Set<string>();

  initialize(queryClient: QueryClient): void {
    if (this.connection) return;
    this.queryClient = queryClient;
    this.router = new RealtimeEventRouter(queryClient);
    this.connection = new ConnectionManager(new RealtimeAuthentication(), (event) => this.handleEvent(event), (error) => this.handleAuthFailure(error));
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
          void deviceKeyStore.clear();
          window.dispatchEvent(new CustomEvent('gapak:cross-tab-logout'));
          telemetry.record('websocket', 'cross_tab_logout', 'info');
        }
        if (message.data?.type === 'notification.read') {
          this.queryClient?.invalidateQueries({ queryKey: ['notifications'] });
          this.queryClient?.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        }
      };
    }
  }

  async connect(): Promise<void> {
    try { await this.connection?.connect(); }
    catch (error) { this.handleAuthFailure(error instanceof Error ? error : new Error('Realtime authentication failed')); }
  }
  disconnect(reason?: string): void { this.connection?.disconnect(reason); }
  getState(): RealtimeConnectionState { return this.state; }
  subscribe(type: string, handler: (event: RealtimeEvent) => void): () => void { return this.router?.subscribe(type, handler) ?? (() => undefined); }
  onStateChange(listener: (state: RealtimeConnectionState) => void): () => void { this.stateListeners.add(listener); listener(this.state); return () => this.stateListeners.delete(listener); }
  onAuthFailure(listener: (error: Error) => void): () => void { this.authFailureListeners.add(listener); return () => this.authFailureListeners.delete(listener); }
  send<T>(event: RealtimeEnvelope<T>): boolean { return this.connection?.send(event) ?? false; }
  subscribeToChat(chatId: string): boolean { this.subscribedChats.add(chatId); return this.send({ id: crypto.randomUUID(), type: 'chat.subscribe', chatId, timestamp: new Date().toISOString(), payload: { chatId } }); }
  unsubscribeFromChat(chatId: string): boolean { this.subscribedChats.delete(chatId); return this.send({ id: crypto.randomUUID(), type: 'chat.unsubscribe', chatId, timestamp: new Date().toISOString(), payload: { chatId } }); }
  clearChatSubscriptions(): void { this.subscribedChats.clear(); }
  broadcastNotificationRead(notificationId: string): void { this.tabChannel?.postMessage({ type: 'notification.read', notificationId }); }
  broadcastLogout(): void { this.tabChannel?.postMessage({ type: 'session.logout', timestamp: Date.now() }); }
  dispose(): void { this.connection?.dispose(); this.tabChannel?.close(); this.router?.clearHistory(); this.connection = null; this.router = null; this.tabChannel = null; this.subscribedChats.clear(); }

  private resubscribeChats(): void { this.subscribedChats.forEach((chatId) => this.send({ id: crypto.randomUUID(), type: 'chat.subscribe', chatId, timestamp: new Date().toISOString(), payload: { chatId } })); }
  private handleEvent(event: RealtimeEvent): void { this.router?.route(event); }
  private handleAuthFailure(error: Error): void { this.authFailureListeners.forEach((listener) => listener(error)); }
}

export const realtimeManager = new RealtimeManager();
