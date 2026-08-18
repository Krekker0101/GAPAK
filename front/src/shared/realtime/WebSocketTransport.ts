import { env } from '../config/env';
import { telemetry } from '../telemetry/telemetry';
import type { BackendRealtimeMessage, RealtimeConnectionState, RealtimeEvent } from './types';
import { parseRealtimeFrame } from './EventParser';

export interface WebSocketTransportOptions {
  onEvent: (event: RealtimeEvent) => void;
  onStateChange: (state: RealtimeConnectionState) => void;
  onAuthFailure: (error: Error) => void;
  createAuthenticationFrame: () => Promise<BackendRealtimeMessage | null>;
}

export class WebSocketTransport {
  private socket: WebSocket | null = null;
  private state: RealtimeConnectionState = 'CLOSED';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stableConnectionTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private disposed = false;
  private generation = 0;
  private readonly maxReconnectAttempts = 12;
  private readonly stableConnectionMs = 15_000;
  private visibilityHandler?: () => void;
  private onlineHandler?: () => void;
  private offlineHandler?: () => void;

  constructor(private readonly options: WebSocketTransportOptions) {}

  getState(): RealtimeConnectionState {
    return this.state;
  }

  connect(): void {
    if (this.disposed || this.socket?.readyState === WebSocket.OPEN || this.state === 'CONNECTING' || this.state === 'AUTHENTICATING' || this.state === 'RECONNECTING') {
      return;
    }
    if (!env.wsBaseUrl) {
      telemetry.record('websocket', 'ws_missing_base_url', 'error');
      this.setState('CLOSED');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setState('CLOSED');
      return;
    }

    this.manuallyClosed = false;
    this.clearReconnectTimer();
    this.setState(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');
    this.bindBrowserNetworkEvents();
    void this.openSocket();
  }

  private async openSocket(): Promise<void> {
    this.setState('AUTHENTICATING');

    try {
      const authenticationFrame = await this.options.createAuthenticationFrame();
      if (!authenticationFrame) throw new Error('Realtime authentication unavailable');
      if (this.manuallyClosed || this.disposed) return;

      const generation = ++this.generation;

      // Native browser WebSocket; no subprotocol is negotiated. Authentication
      // is carried by the backend-issued HttpOnly `gapak_at` cookie. Never put
      // access/refresh tokens into the WebSocket URL or client-visible frames.
      const socket = new WebSocket(env.wsBaseUrl);
      this.socket = socket;

      socket.onopen = () => {
        if (!this.isCurrent(socket, generation)) return;
        // Always send the TLS-protected fallback frame. When the HttpOnly
        // access cookie authenticated the upgrade, the backend treats this as
        // an idempotent duplicate. When a browser blocks cross-site cookies,
        // the frame completes authentication without exposing a token in URLs.
        socket.send(JSON.stringify(authenticationFrame));
        this.handleOpen();
      };
      socket.onmessage = (event) => {
        if (!this.isCurrent(socket, generation)) return;
        this.handleMessage(event.data);
      };
      socket.onerror = () => {
        if (!this.isCurrent(socket, generation)) return;
        telemetry.record('websocket', 'ws_error', 'error');
      };
      socket.onclose = (event) => {
        if (!this.isCurrent(socket, generation)) return;
        this.handleClose(event);
      };
    } catch (error) {
      if (this.manuallyClosed || this.disposed) return;
      const normalized = error instanceof Error ? error : new Error('Realtime authentication failed');
      this.options.onAuthFailure(normalized);
      this.generation += 1;
      this.socket = null;
      this.setState('CLOSED');
      // Authentication/session failures are terminal. Do not start an endless
      // reconnect loop; the auth layer must establish a valid session first.
    }
  }

  private isCurrent(socket: WebSocket, generation: number): boolean {
    return !this.disposed && generation === this.generation && this.socket === socket;
  }

  disconnect(reason = 'client_logout'): void {
    this.manuallyClosed = true;
    this.clearReconnectTimer();
    this.clearStableConnectionTimer();
    this.generation += 1;
    this.unbindBrowserNetworkEvents();

    const socket = this.socket;
    this.socket = null;
    if (socket) {
      try {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(1000, reason.slice(0, 120));
        }
      } catch {
        // Browser can throw while a handshake is being aborted.
      }
    }
    this.setState('CLOSED');
  }

  send(message: BackendRealtimeMessage): boolean {
    if (this.state !== 'CONNECTED' || this.socket?.readyState !== WebSocket.OPEN) {
      telemetry.record('websocket', 'event_not_sent_while_disconnected', 'debug', { type: message.type });
      return false;
    }
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private handleOpen(): void {
    this.setState('CONNECTED');
    this.clearStableConnectionTimer();
    this.stableConnectionTimer = setTimeout(() => {
      if (this.state === 'CONNECTED') this.reconnectAttempts = 0;
      this.stableConnectionTimer = null;
    }, this.stableConnectionMs);
  }

  private handleMessage(raw: unknown): void {
    let value: unknown = raw;
    if (typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch {
        telemetry.record('websocket', 'invalid_json_frame', 'error');
        return;
      }
    }

    try {
      const event = parseRealtimeFrame(value);
      this.options.onEvent(event);
    } catch (error) {
      telemetry.trackError('Invalid backend realtime frame', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.socket = null;
    this.clearStableConnectionTimer();

    if (this.manuallyClosed || this.disposed) {
      this.setState('CLOSED');
      return;
    }

    // Backend closes slow consumers with 1013 and normal shutdowns with 1001/1012.
    // A RequireAuth rejection happens before upgrade and is not observable as a
    // reliable WebSocket close code in browsers, so reconnecting is bounded.
    if ([1000, 1008].includes(event.code)) {
      this.setState('CLOSED');
      if (event.code === 1008) {
        this.options.onAuthFailure(new Error('Realtime connection rejected by backend'));
      }
      return;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed || this.disposed) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setState('CLOSED');
      return;
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState('CLOSED');
      return;
    }

    this.clearReconnectTimer();
    this.setState('RECONNECTING');

    const base = Math.min(30_000, 750 * 2 ** this.reconnectAttempts);
    const jitter = Math.floor(Math.random() * Math.min(1_500, Math.max(250, base * 0.25)));
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, base + jitter);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearStableConnectionTimer(): void {
    if (this.stableConnectionTimer) clearTimeout(this.stableConnectionTimer);
    this.stableConnectionTimer = null;
  }

  private setState(state: RealtimeConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    telemetry.record('websocket', `ws_state_${state.toLowerCase()}`, 'info', { attempts: this.reconnectAttempts });
    this.options.onStateChange(state);
  }

  private bindBrowserNetworkEvents(): void {
    if (typeof window === 'undefined' || this.visibilityHandler) return;

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.state === 'CLOSED') this.connect();
    };
    this.onlineHandler = () => {
      if (this.state === 'CLOSED') this.connect();
    };
    this.offlineHandler = () => {
      this.disconnect('offline');
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  private unbindBrowserNetworkEvents(): void {
    if (typeof window === 'undefined') return;
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
    if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
    this.visibilityHandler = undefined;
    this.onlineHandler = undefined;
    this.offlineHandler = undefined;
  }

  dispose(): void {
    this.disposed = true;
    this.disconnect('dispose');
  }
}
