import { env, resolveWebSocketUrl } from '../config/env';
import { tokenManager } from '../api/tokenManager';
import { telemetry } from '../telemetry/telemetry';
import { RealtimeConnectionState, RealtimeEnvelope, RealtimeEvent } from './types';
import { parseRealtimeEvent } from './EventParser';

export interface WebSocketTransportOptions {
  onEvent: (event: RealtimeEvent) => void;
  onStateChange: (state: RealtimeConnectionState) => void;
  onAuthFailure: (error: Error) => void;
}

export class WebSocketTransport {
  private socket: WebSocket | null = null;
  private state: RealtimeConnectionState = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private disposed = false;
  private readonly maxReconnectAttempts = 12;
  private readonly heartbeatEveryMs = 20000;
  private readonly heartbeatTimeoutMs = 10000;
  private readonly maxQueue = 250;
  private outboundQueue: RealtimeEnvelope[] = [];
  private visibilityHandler?: () => void;
  private onlineHandler?: () => void;
  private offlineHandler?: () => void;

  constructor(private readonly options: WebSocketTransportOptions) {}

  getState() { return this.state; }

  connect() {
    if (this.disposed || ['CONNECTED', 'CONNECTING', 'RECONNECTING'].includes(this.state)) return;
    const wsUrl = resolveWebSocketUrl();
    if (!wsUrl) {
      this.setState('DISCONNECTED');
      telemetry.record('websocket', 'ws_missing_base_url', 'error');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setState('OFFLINE');
      return;
    }

    this.manuallyClosed = false;
    this.clearReconnectTimer();
    this.setState(this.reconnectAttempts ? 'RECONNECTING' : 'CONNECTING');
    this.bindBrowserNetworkEvents();

    try {
      this.socket = new WebSocket(this.withAccessToken(wsUrl), 'gapak.realtime.v1');
      this.socket.onopen = () => this.handleOpen();
      this.socket.onmessage = (event) => this.handleMessage(event.data);
      this.socket.onerror = () => telemetry.record('websocket', 'ws_error', 'error');
      this.socket.onclose = (event) => this.handleClose(event);
    } catch (error) {
      telemetry.trackError('WebSocket construction failed', error);
      this.scheduleReconnect();
    }
  }

  disconnect(reason = 'client_logout') {
    this.manuallyClosed = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.unbindBrowserNetworkEvents();
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState === WebSocket.OPEN) socket.close(1000, reason.slice(0, 120));
    else if (socket) socket.close();
    this.setState('DISCONNECTED');
    this.outboundQueue = [];
  }

  send<T>(event: RealtimeEnvelope<T>) {
    if (this.state === 'CONNECTED' && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
      return true;
    }
    if (['AUTHENTICATION_FAILED', 'SERVER_SHUTDOWN'].includes(this.state)) return false;
    if (this.outboundQueue.length >= this.maxQueue) this.outboundQueue.shift();
    this.outboundQueue.push(event);
    return false;
  }

  private withAccessToken(rawUrl: string): string {
    const token = tokenManager.getAccessToken();
    if (!token) return rawUrl;
    const url = new URL(rawUrl);
    url.searchParams.set('access_token', token);
    return url.toString();
  }

  private handleOpen() {
    const token = tokenManager.getAccessToken();
    if (token && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ id: crypto.randomUUID(), type: 'auth', timestamp: new Date().toISOString(), data: { token } }));
    }
    this.reconnectAttempts = 0;
    this.setState('CONNECTED');
    this.startHeartbeat();
    this.flushQueue();
  }

  private handleMessage(raw: unknown) {
    let value: unknown = raw;
    if (typeof raw === 'string') {
      try { value = JSON.parse(raw); }
      catch { telemetry.record('websocket', 'invalid_json_frame', 'error'); return; }
    }
    try {
      const event = parseRealtimeEvent(value);
      if (event.type === 'system.ping') {
        this.send({ id: crypto.randomUUID(), type: 'system.pong', timestamp: new Date().toISOString(), payload: {} });
        return;
      }
      if (event.type === 'system.pong') {
        if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = null;
        return;
      }
      if (event.type === 'error') {
        const payload = event.payload as { code?: string; message?: string } | undefined;
        if (payload?.code === 'AUTHENTICATION_FAILED' || payload?.code === 'UNAUTHORIZED') {
          this.setState('AUTHENTICATION_FAILED');
          this.socket?.close(1008, 'realtime_auth_failed');
          return;
        }
      }
      this.options.onEvent(event);
    } catch (error) {
      telemetry.trackError('Invalid realtime event', error);
    }
  }

  private clearReconnectTimer() { if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

  private handleClose(event: CloseEvent) {
    this.stopHeartbeat();
    this.socket = null;
    if (this.manuallyClosed || this.disposed) { this.setState('DISCONNECTED'); return; }
    if ([1008, 4001, 4401].includes(event.code)) {
      this.setState('AUTHENTICATION_FAILED');
      this.options.onAuthFailure(new Error('Realtime authentication rejected by server'));
      return;
    }
    if ([1001, 1012, 1013].includes(event.code)) this.setState('SERVER_SHUTDOWN');
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.manuallyClosed || this.disposed) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) { this.setState('OFFLINE'); return; }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) { this.setState('DISCONNECTED'); return; }
    this.clearReconnectTimer();
    this.setState('RECONNECTING');
    const base = Math.min(30000, 750 * 2 ** this.reconnectAttempts);
    const jitter = Math.floor(Math.random() * Math.min(1000, base * 0.25));
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), base + jitter);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.state !== 'CONNECTED') return;
      this.send({ id: crypto.randomUUID(), type: 'system.ping', timestamp: new Date().toISOString(), payload: {} });
      if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = setTimeout(() => this.socket?.close(4000, 'heartbeat_timeout'), this.heartbeatTimeoutMs);
    }, this.heartbeatEveryMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    this.heartbeatTimer = null;
    this.heartbeatTimeout = null;
  }

  private flushQueue() { if (this.state !== 'CONNECTED') return; const queue = this.outboundQueue; this.outboundQueue = []; queue.forEach((event) => this.send(event)); }
  private setState(state: RealtimeConnectionState) { if (this.state === state) return; this.state = state; telemetry.record('websocket', `ws_state_${state.toLowerCase()}`, 'info', { attempts: this.reconnectAttempts }); this.options.onStateChange(state); }

  private bindBrowserNetworkEvents() {
    if (typeof window === 'undefined' || this.visibilityHandler) return;
    this.visibilityHandler = () => { if (document.visibilityState === 'visible' && this.state === 'DISCONNECTED') this.connect(); };
    this.onlineHandler = () => { this.reconnectAttempts = 0; this.connect(); };
    this.offlineHandler = () => { this.socket?.close(1001, 'offline'); this.setState('OFFLINE'); };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  private unbindBrowserNetworkEvents() {
    if (typeof window === 'undefined') return;
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
    if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
    this.visibilityHandler = undefined;
    this.onlineHandler = undefined;
    this.offlineHandler = undefined;
  }

  dispose() { this.disposed = true; this.disconnect('dispose'); this.outboundQueue = []; }
}
