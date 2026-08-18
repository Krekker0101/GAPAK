import { httpClient } from '../../../shared/api/httpClient';
import type { BackendPrivacy, BackendProfile, BackendPublicProfile } from '../../../shared/api/backendContracts';

export type UpdateProfileRequest = Partial<Pick<BackendProfile, 'displayName' | 'bio' | 'avatarFileId' | 'statusMessage'>>;
// The backend validates privacy as one atomic settings document. Sending the
// full object prevents an omitted boolean from being mistaken for `false`.
export type UpdatePrivacyRequest = BackendPrivacy;

export interface UserDiscoveryParams {
  /** 'new' surfaces recently-joined public accounts, 'top' surfaces the most-followed/most-active public accounts. */
  sort: 'new' | 'top';
  limit?: number;
}

export const usersApi = {
  me: (signal?: AbortSignal) => httpClient.get<BackendProfile>('/users/me', { signal }),
  profile: (userId: string, signal?: AbortSignal) => httpClient.get<BackendPublicProfile>(`/users/${encodeURIComponent(userId)}`, { signal }),
  updateProfile: (payload: UpdateProfileRequest, idempotencyKey: string, signal?: AbortSignal) => httpClient.patch<BackendProfile>('/users/me', payload, { idempotencyKey, signal }),
  updatePrivacy: (payload: UpdatePrivacyRequest, idempotencyKey: string, signal?: AbortSignal) => httpClient.patch<BackendProfile>('/users/me/privacy', payload, { idempotencyKey, signal }),
  updateTheme: (theme: 'light' | 'dark' | 'auto', idempotencyKey: string, signal?: AbortSignal) => httpClient.patch<BackendProfile>('/users/me/theme', { theme }, { idempotencyKey, signal }),
  /** Username/display-name search. Server is expected to only return accounts the caller is permitted to see. */
  search: (query: string, limit = 20, signal?: AbortSignal) =>
    httpClient.get<BackendPublicProfile[]>('/users/search', { params: { q: query, limit }, signal }),
  /** Discovery feed of public accounts (new joiners or top/most-followed), used for chat "who to message" suggestions. */
  discover: (params: UserDiscoveryParams, signal?: AbortSignal) =>
    httpClient.get<BackendPublicProfile[]>('/users/discover', { params: { sort: params.sort, ...(params.limit != null ? { limit: params.limit } : {}) }, signal }),
};
