export type PresenceState = "ONLINE" | "IDLE" | "OFFLINE" | "HIDDEN";
export type PresenceSignalState = "ACTIVE" | "IDLE";

export type PresenceResponse = {
  userId: string;
  state: PresenceState;
  isOnline: boolean;
  lastSeenAt?: string | null;
  lastHeartbeatAt?: string | null;
  canViewOnlineStatus: boolean;
  canViewLastSeen: boolean;
};

export type PresenceHeartbeatRequest = {
  connectionId: string;
  state: PresenceSignalState;
  pagePath?: string;
};

export type PresenceDisconnectRequest = {
  connectionId: string;
  reason?: string;
};

export type PresenceQueryRequest = {
  userIds: string[];
};
