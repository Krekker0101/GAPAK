import { httpClient } from '../../../shared/api/httpClient';
import type { BackendPrivacy, BackendProfile, BackendPublicProfile } from '../../../shared/api/backendContracts';

export type UpdateProfileRequest = Partial<Pick<BackendProfile, 'displayName' | 'bio' | 'avatarFileId' | 'statusMessage'>>;
export type UpdatePrivacyRequest = Partial<BackendPrivacy>;

export const usersApi = {
  me: (signal?: AbortSignal) => httpClient.get<BackendProfile>('/users/me', { signal }),
  profile: (userId: string, signal?: AbortSignal) => httpClient.get<BackendPublicProfile>(`/users/${encodeURIComponent(userId)}`, { signal }),
  updateProfile: (payload: UpdateProfileRequest, idempotencyKey: string, signal?: AbortSignal) => httpClient.patch<BackendProfile>('/users/me', payload, { idempotencyKey, signal }),
  updatePrivacy: (payload: UpdatePrivacyRequest, idempotencyKey: string, signal?: AbortSignal) => httpClient.patch<BackendProfile>('/users/me/privacy', payload, { idempotencyKey, signal }),
  updateTheme: (theme: 'light' | 'dark' | 'auto', idempotencyKey: string, signal?: AbortSignal) => httpClient.patch<BackendProfile>('/users/me/theme', { theme }, { idempotencyKey, signal }),
};
