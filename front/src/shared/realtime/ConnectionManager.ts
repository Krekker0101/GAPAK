import { RealtimeAuthentication } from './RealtimeAuthentication';
import { WebSocketTransport } from './WebSocketTransport';
import type { BackendRealtimeMessage, RealtimeConnectionState, RealtimeEvent } from './types';

export class ConnectionManager {
  private readonly transport: WebSocketTransport;
  private state: RealtimeConnectionState = 'CLOSED';
  private listeners = new Set<(state: RealtimeConnectionState) => void>();

  constructor(
    private readonly auth: RealtimeAuthentication,
    onEvent: (event: RealtimeEvent) => void,
    onAuthFailure: (error: Error) => void,
  ) {
    this.transport = new WebSocketTransport({
      onEvent,
      onStateChange: (state) => {
        this.state = state;
        this.listeners.forEach((listener) => listener(state));
      },
      onAuthFailure,
      ensureAuthenticated: () => this.auth.ensureAuthenticated(),
    });
  }

  connect(): void {
    this.transport.connect();
  }

  disconnect(reason?: string): void {
    this.transport.disconnect(reason);
  }

  send(message: BackendRealtimeMessage): boolean {
    return this.transport.send(message);
  }

  getState(): RealtimeConnectionState {
    return this.state;
  }

  onStateChange(listener: (state: RealtimeConnectionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.transport.dispose();
    this.listeners.clear();
  }
}
