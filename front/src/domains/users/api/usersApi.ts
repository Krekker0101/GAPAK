import { httpClient } from '../../../shared/api/httpClient';
import { ExtendedUserProfile } from '../../../shared/types/social';
import { UserProfile } from '../../../shared/types';
export const usersApi = {
  me: () => httpClient.get<UserProfile>('/api/users/me'),
  profile: (userIdOrUsername: string, signal?: AbortSignal) => httpClient.get<ExtendedUserProfile>(`/api/users/${encodeURIComponent(userIdOrUsername)}`, { signal }),
  updateProfile: (payload: unknown, idempotencyKey: string) => httpClient.patch<UserProfile>('/api/users/me', payload, { idempotencyKey }),
};
