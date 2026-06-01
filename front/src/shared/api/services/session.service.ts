import { apiClient } from "@/shared/api/client";
import type { AcceptedResponse } from "@/shared/types/auth";
import type { SessionResponse } from "@/shared/types/session";

export const sessionService = {
  listSessions() {
    return apiClient<SessionResponse[]>({
      path: "/sessions",
    });
  },
  revokeSession(sessionId: string) {
    return apiClient<AcceptedResponse>({
      path: `/sessions/${sessionId}`,
      method: "DELETE",
    });
  },
  revokeOthers() {
    return apiClient<AcceptedResponse>({
      path: "/sessions/others",
      method: "DELETE",
    });
  },
};
