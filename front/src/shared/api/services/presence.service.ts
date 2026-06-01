import { apiClient } from "@/shared/api/client";
import type {
  PresenceDisconnectRequest,
  PresenceHeartbeatRequest,
  PresenceQueryRequest,
  PresenceResponse,
} from "@/shared/types/presence";

export const presenceService = {
  me() {
    return apiClient<PresenceResponse>({
      path: "/presence/me",
    });
  },
  get(userId: string) {
    return apiClient<PresenceResponse>({
      path: `/presence/users/${userId}`,
    });
  },
  query(payload: PresenceQueryRequest) {
    return apiClient<PresenceResponse[]>({
      path: "/presence/query",
      method: "POST",
      body: payload,
    });
  },
  heartbeat(payload: PresenceHeartbeatRequest) {
    return apiClient<PresenceResponse>({
      path: "/presence/heartbeat",
      method: "POST",
      body: payload,
    });
  },
  disconnect(payload: PresenceDisconnectRequest) {
    return apiClient<PresenceResponse>({
      path: "/presence/disconnect",
      method: "POST",
      body: payload,
    });
  },
};
