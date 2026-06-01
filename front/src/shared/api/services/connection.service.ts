import { apiClient } from "@/shared/api/client";
import type { AcceptedResponse } from "@/shared/types/auth";
import type { ConnectionResponse } from "@/shared/types/connection";

export const connectionService = {
  listConnections() {
    return apiClient<ConnectionResponse[]>({
      path: "/connections",
    });
  },
  accept(connectionId: string) {
    return apiClient<AcceptedResponse>({
      path: `/connections/${connectionId}/accept`,
      method: "POST",
    });
  },
};
