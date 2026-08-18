/**
 * GAPAK Frontend Platform Core Shared Types
 */

// --- Auth Machine States ---
export type AuthState =
  | 'UNKNOWN'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'REFRESHING'
  | 'UNAUTHENTICATED'
  | 'AUTH_ERROR';

export type UserRole =
  | 'guest'
  | 'user'
  | 'creator'
  | 'moderator'
  | 'security_analyst'
  | 'admin'
  | 'super_admin';

export type AccountStatus =
  | 'active'
  | 'unverified'
  | 'suspended'
  | 'banned';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'invisible' | 'offline';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  role: UserRole;
  status?: AccountStatus;
  presence?: PresenceStatus;
  trustScore?: number;
  permissions?: string[];
  isAnonymous?: boolean;
  twoFactorEnabled?: boolean;
  createdAt?: string;
}

export interface AuthSession {
  accessToken: string;
  expiresAt?: number;
  user: UserProfile;
  /** Server-managed refresh/session credential is intentionally not exposed to the browser. */
  refreshManagedByCookie?: true;
}

// --- API Architecture Types ---
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    pagination?: Record<string, unknown>;
  };
}

export interface ApiErrorDetail {
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: { requestId?: string; pagination?: Record<string, unknown> };
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequestConfig extends Omit<RequestInit, 'body'> {
  url: string;
  method?: HttpMethod;
  params?: Record<string, string | number | boolean | undefined>;
  data?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  retryCount?: number;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Client-side request deadline. 0 disables the deadline. */
  timeoutMs?: number;
  /** Internal guard preventing an infinite 401 -> refresh -> retry loop. */
  authRetry?: boolean;
  /** Internal guard preventing an infinite 403 -> CSRF bootstrap -> retry loop. */
  csrfRetry?: boolean;
  /** Return response metadata/headers to callers that need transport-level pagination such as X-Next-Cursor. */
  includeResponseMeta?: boolean;
}

export interface HttpResponse<T> {
  data: T;
  headers?: Headers;
  status: number;
  requestId: string;
  meta?: Record<string, unknown>;
}

// --- Theme Tokens & System ---
export type ThemeMode = 'light' | 'dark' | 'system';

// --- Domain & Shell Navigation ---
export type DomainKey =
  | 'auth'
  | 'users'
  | 'connections'
  | 'subscriptions'
  | 'posts'
  | 'stories'
  | 'chats'
  | 'media'
  | 'presence'
  | 'live'
  | 'trust-rooms'
  | 'battles'
  | 'moderation'
  | 'admin'
  | 'security';

export interface NavigationItem {
  id: string;
  domain: DomainKey;
  label: string;
  iconName: string;
  path: string;
  badge?: string | number;
  requiredPermission?: string;
  requiredRole?: UserRole;
  children?: NavigationItem[];
}

// --- Telemetry Types ---
export type TelemetrySeverity = 'debug' | 'info' | 'warn' | 'error';

export interface TelemetryEvent {
  id: string;
  timestamp: string;
  category: 'api' | 'auth' | 'navigation' | 'ux' | 'websocket' | 'performance' | 'error';
  name: string;
  severity: TelemetrySeverity;
  payload?: Record<string, unknown>;
}

// --- Social, Chat, Media & Live Domain Specs ---
export * from './social';
export * from './chat';
export * from './media';
export * from './security';
