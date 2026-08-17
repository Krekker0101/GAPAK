import { httpClient } from '../../../shared/api/httpClient';
import type {
  AcceptedResponse,
  Connection,
  ConnectionSuggestion,
  CreateConnectionRequest,
  ToggleTrustedCircleRequest,
} from '../../../shared/api/backendContracts';

export const connectionsApi = {
  list: (signal?: AbortSignal) =>
    httpClient.get<Connection[]>('/connections', { signal }),

  /**
   * "People you may know" — accounts connected to the current user via mutual
   * followers/following (friend-of-a-friend). Server-computed and
   * privacy-filtered; the frontend never derives this from raw graph data.
   */
  suggestions: (limit = 10, signal?: AbortSignal) =>
    httpClient.get<ConnectionSuggestion[]>('/connections/suggestions', { params: { limit }, signal }),

  request: (targetUserId: string, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.post<AcceptedResponse>(
      '/connections/requests',
      { targetUserId } satisfies CreateConnectionRequest,
      { idempotencyKey, signal },
    ),

  accept: (connectionId: string, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.post<AcceptedResponse>(
      `/connections/${encodeURIComponent(connectionId)}/accept`,
      undefined,
      { idempotencyKey, signal },
    ),

  trustedCircle: (
    connectionId: string,
    enabled: boolean,
    idempotencyKey: string,
    signal?: AbortSignal,
  ) =>
    httpClient.put<AcceptedResponse>(
      `/connections/${encodeURIComponent(connectionId)}/trusted-circle`,
      { enabled } satisfies ToggleTrustedCircleRequest,
      { idempotencyKey, signal },
    ),

  remove: (connectionId: string, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.delete<AcceptedResponse>(
      `/connections/${encodeURIComponent(connectionId)}`,
      { idempotencyKey, signal },
    ),
};
