import { RealtimeAuthentication } from './RealtimeAuthentication';
import { WebSocketTransport } from './WebSocketTransport';
import { RealtimeConnectionState, RealtimeEnvelope, RealtimeEvent } from './types';

export class ConnectionManager {
  private transport: WebSocketTransport;
  private state: RealtimeConnectionState = 'DISCONNECTED';
  private listeners = new Set<(state: RealtimeConnectionState) => void>();

  constructor(private readonly auth: RealtimeAuthentication, onEvent: (event: RealtimeEvent) => void, onAuthFailure: (error: Error) => void) {
    this.transport = new WebSocketTransport({
      onEvent,
      onStateChange: (state) => { this.state = state; this.listeners.forEach((listener) => listener(state)); },
      onAuthFailure,
    });
  }

  async connect(): Promise<void> {
    await this.auth.ensureAuthenticated();
    this.transport.connect();
  }
  disconnect(reason?: string): void { this.transport.disconnect(reason); }
  send<T>(event: RealtimeEnvelope<T>): boolean { return this.transport.send(event); }
  getState(): RealtimeConnectionState { return this.state; }
  onStateChange(listener: (state: RealtimeConnectionState) => void): () => void { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }
  dispose(): void { this.transport.dispose(); this.listeners.clear(); }
}
