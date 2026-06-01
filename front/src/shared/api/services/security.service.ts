import { apiClient } from "@/shared/api/client";
import type {
  AuditEventResponse,
  DeviceAlertResponse,
  PanicModeRequest,
  PanicModeResponse,
  SuspiciousFlagResponse,
} from "@/shared/types/security";

export const securityService = {
  getAuditEvents() {
    return apiClient<AuditEventResponse[]>({
      path: "/security/audit-events",
    });
  },
  getFlags() {
    return apiClient<SuspiciousFlagResponse[]>({
      path: "/security/flags",
    });
  },
  getAlerts() {
    return apiClient<DeviceAlertResponse[]>({
      path: "/security/alerts",
    });
  },
  panicMode(payload: PanicModeRequest) {
    return apiClient<PanicModeResponse>({
      path: "/security/panic-mode",
      method: "POST",
      body: payload,
    });
  },
};
