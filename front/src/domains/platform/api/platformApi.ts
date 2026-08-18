import { httpClient } from '../../../shared/api/httpClient';
import type {
  AdminOverview,
  AdminManagedPage,
  AdminPageSummary,
  AdminUser,
  AdminUsersPage,
  Battle,
  CreateBattleRequest,
  CreateTrustRoomRequest,
  ModerationReport,
  PendingSubscriptionRequests,
  PresenceResponse,
  SubscriptionCreator,
  SubscriptionNotificationPreferences,
  SubscriptionStats,
  TrustRoom,
  TrustRoomDetail,
  TrustRoomMember,
} from '../../../shared/api/backendContracts';

export const trustRoomsApi = {
  list: (signal?: AbortSignal) => httpClient.get<TrustRoom[]>('/trust-rooms', { signal }),
  get: (roomId: string, signal?: AbortSignal) => httpClient.get<TrustRoomDetail>(`/trust-rooms/${encodeURIComponent(roomId)}`, { signal }),
  create: (input: CreateTrustRoomRequest, idempotencyKey: string) => httpClient.post<TrustRoom>('/trust-rooms', input, { idempotencyKey }),
  addMember: (roomId: string, input: { userId: string; role: TrustRoomMember['role'] }, idempotencyKey: string) =>
    httpClient.post<{ accepted: boolean }>(`/trust-rooms/${encodeURIComponent(roomId)}/members`, input, { idempotencyKey }),
};

export const battlesApi = {
  list: (page = 1, signal?: AbortSignal) => httpClient.get<Battle[]>('/battles', { params: { page, limit: 30 }, signal }),
  get: (battleId: string, signal?: AbortSignal) => httpClient.get<Battle>(`/battles/${encodeURIComponent(battleId)}`, { signal }),
  create: (input: CreateBattleRequest, idempotencyKey: string) => httpClient.post<Battle>('/battles', input, { idempotencyKey }),
  respond: (battleId: string, accept: boolean, idempotencyKey: string) => httpClient.post<Battle>(`/battles/${encodeURIComponent(battleId)}/respond`, { accept }, { idempotencyKey }),
  vote: (battleId: string, vote: 'HOST_A' | 'HOST_B' | 'DRAW', idempotencyKey: string) =>
    httpClient.post<Battle>(`/battles/${encodeURIComponent(battleId)}/votes`, { vote, weight: 1 }, { idempotencyKey }),
};

export const presenceApi = {
  me: (signal?: AbortSignal) => httpClient.get<PresenceResponse>('/presence/me', { signal }),
  get: (userId: string, signal?: AbortSignal) => httpClient.get<PresenceResponse>(`/presence/users/${encodeURIComponent(userId)}`, { signal }),
  query: (userIds: string[], signal?: AbortSignal) => httpClient.post<PresenceResponse[]>('/presence/query', { userIds }, { signal, idempotencyKey: crypto.randomUUID() }),
  heartbeat: (connectionId: string, state: 'ACTIVE' | 'IDLE', pagePath?: string) =>
    httpClient.post<PresenceResponse>('/presence/heartbeat', { connectionId, state, pagePath }, { idempotencyKey: crypto.randomUUID() }),
  disconnect: (connectionId: string, reason: string) =>
    httpClient.post<PresenceResponse>('/presence/disconnect', { connectionId, reason }, { idempotencyKey: crypto.randomUUID() }),
};

export const moderationApi = {
  own: (signal?: AbortSignal) => httpClient.get<ModerationReport[]>('/moderation/reports', { signal }),
  all: (signal?: AbortSignal) => httpClient.get<ModerationReport[]>('/admin/moderation/reports', { signal }),
  create: (input: Pick<ModerationReport, 'targetType' | 'targetId' | 'reason'> & { description: string }, idempotencyKey: string) =>
    httpClient.post<ModerationReport>('/moderation/reports', input, { idempotencyKey }),
  resolve: (reportId: string, status: 'RESOLVED' | 'DISMISSED', resolutionNote: string, idempotencyKey: string) =>
    httpClient.post<ModerationReport>(`/admin/moderation/reports/${encodeURIComponent(reportId)}/resolve`, { status, resolutionNote }, { idempotencyKey }),
};

export const subscriptionsPlatformApi = {
  following: (signal?: AbortSignal) => httpClient.get<SubscriptionCreator[]>('/subscriptions/following', { signal }),
  pending: (signal?: AbortSignal) => httpClient.get<PendingSubscriptionRequests>('/subscriptions/requests/pending', { params: { page: 1, limit: 100 }, signal }),
  stats: (userId: string, signal?: AbortSignal) => httpClient.get<SubscriptionStats>(`/subscriptions/${encodeURIComponent(userId)}/stats`, { signal }),
  unsubscribe: (creatorId: string, idempotencyKey: string) => httpClient.delete<void>(`/subscriptions/${encodeURIComponent(creatorId)}`, { idempotencyKey }),
  changeType: (creatorId: string, subscriptionType: 'VISIBLE' | 'SILENT', idempotencyKey: string) =>
    httpClient.patch<unknown>(`/subscriptions/${encodeURIComponent(creatorId)}/type`, { subscriptionType }, { idempotencyKey }),
  approve: (requestId: string, idempotencyKey: string) => httpClient.post<unknown>(`/subscriptions/requests/${encodeURIComponent(requestId)}/approve`, undefined, { idempotencyKey }),
  reject: (requestId: string, idempotencyKey: string) => httpClient.post<void>(`/subscriptions/requests/${encodeURIComponent(requestId)}/reject`, undefined, { idempotencyKey }),
  subscribe: (creatorId: string, idempotencyKey: string) => httpClient.post<unknown>(`/subscriptions/${encodeURIComponent(creatorId)}`, undefined, { idempotencyKey }),
  request: (creatorId: string, message: string, idempotencyKey: string) => httpClient.post<unknown>('/subscriptions/requests', { creatorId, message }, { idempotencyKey }),
  block: (userId: string, idempotencyKey: string) => httpClient.post<void>('/subscriptions/block', { userId }, { idempotencyKey }),
  unblock: (userId: string, idempotencyKey: string) => httpClient.delete<void>(`/subscriptions/block/${encodeURIComponent(userId)}`, { idempotencyKey }),
  notificationPreferences: (creatorId: string, signal?: AbortSignal) => httpClient.get<SubscriptionNotificationPreferences>(`/subscriptions/${encodeURIComponent(creatorId)}/notifications`, { signal }),
  setNotificationPreferences: (creatorId: string, input: { notifyOnPost?: boolean; notifyOnStory?: boolean; notifyOnLive?: boolean; notifyOnClip?: boolean; muteMinutes?: number | null }, idempotencyKey: string) =>
    httpClient.put<void>(`/subscriptions/${encodeURIComponent(creatorId)}/notifications`, input, { idempotencyKey }),
};

export const adminApi = {
  overview: (signal?: AbortSignal) => httpClient.get<AdminOverview>('/admin/overview', { signal }),
  users: (params: { search?: string; role?: string; status?: string; limit?: number; offset?: number }, signal?: AbortSignal) =>
    httpClient.get<AdminUsersPage>('/admin/users', { params, signal }),
  updateUser: (userId: string, input: { displayName?: string; role?: string; accountStatus?: string }, idempotencyKey: string) =>
    httpClient.patch<AdminUser>(`/admin/users/${encodeURIComponent(userId)}`, input, { idempotencyKey }),
  pages: (locale?: 'en' | 'ru' | 'tj', signal?: AbortSignal) =>
    httpClient.get<{ pages: AdminPageSummary[] }>('/admin/content/pages', { params: { locale }, signal }),
  page: (slug: string, locale: 'en' | 'ru' | 'tj', signal?: AbortSignal) =>
    httpClient.get<AdminManagedPage>(`/admin/content/pages/${encodeURIComponent(slug)}`, { params: { locale }, signal }),
  updatePage: (slug: string, input: { locale: 'en' | 'ru' | 'tj'; title: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; content: { blocks: Array<{ id: string; type: string; props: Record<string, unknown> }> } }, idempotencyKey: string) =>
    httpClient.put<AdminManagedPage>(`/admin/content/pages/${encodeURIComponent(slug)}`, input, { idempotencyKey }),
};
