/**
 * GAPAK Frontend Telemetry Abstraction
 * Logs errors, performance marks, API failures, WS events, and UX interactions.
 * Automatically redacts sensitive fields like passwords, tokens, and authorization headers.
 */

import { TelemetryEvent, TelemetrySeverity } from '../types';

class TelemetryService {
  private events: TelemetryEvent[] = [];
  private listeners: Array<(event: TelemetryEvent) => void> = [];
  private readonly maxLogs = 200;

  private sanitize(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return obj
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]')
        .replace(/\b(?:\+?\d[\d .()-]{7,}\d)\b/g, '[PHONE_REDACTED]');
    }
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.sanitize(item));

    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = ['password', 'token', 'accessToken', 'refreshToken', 'authorization', 'secret', 'privateKey', 'sessionKey', 'messageContent', 'plaintext', 'email', 'phone', 'key'];

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  public record(
    category: TelemetryEvent['category'],
    name: string,
    severity: TelemetrySeverity = 'info',
    payload?: Record<string, unknown>
  ): TelemetryEvent {
    const event: TelemetryEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      category,
      name,
      severity,
      payload: this.sanitize(payload) as Record<string, unknown>,
    };

    this.events.unshift(event);
    if (this.events.length > this.maxLogs) {
      this.events.pop();
    }

    // Console output for development only; sanitized payload never contains secrets.
    if (import.meta.env.DEV) {
      const color = severity === 'error' ? 'color: #ef4444' : severity === 'warn' ? 'color: #f59e0b' : 'color: #6366f1';
      console.log(`%c[GAPAK Telemetry:${category.toUpperCase()}] ${name}`, color, event);
    }

    this.listeners.forEach((listener) => listener(event));
    return event;
  }

  public trackError(name: string, error: Error | unknown, context?: Record<string, unknown>) {
    const errObj = error instanceof Error ? { message: error.message, stack: error.stack } : { raw: error };
    return this.record('error', name, 'error', { ...errObj, ...context });
  }

  public trackApiFailure(endpoint: string, status: number, message: string, requestId?: string) {
    return this.record('api', `API Failure: ${endpoint}`, 'warn', {
      endpoint,
      status,
      message,
      requestId,
    });
  }

  public trackPerfMark(name: string, durationMs: number, extra?: Record<string, unknown>) {
    return this.record('performance', `Perf: ${name}`, 'info', {
      name,
      durationMs,
      ...extra,
    });
  }

  public trackWsState(state: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error', details?: Record<string, unknown>) {
    return this.record('websocket', `WebSocket State: ${state}`, state === 'error' ? 'error' : 'info', details);
  }

  public trackUxEvent(name: string, payload?: Record<string, unknown>) {
    return this.record('ux', name, 'info', payload);
  }

  public subscribe(listener: (event: TelemetryEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  public clear() {
    this.events = [];
  }
}

export const telemetry = new TelemetryService();
