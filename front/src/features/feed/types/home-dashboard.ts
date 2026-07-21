import type { ChatResponse } from "@/shared/types/chat";
import type { ConnectionResponse } from "@/shared/types/connection";
import type { PostResponse } from "@/shared/types/post";
import type { TrustRoomResponse } from "@/shared/types/room";
import type { AuditEventResponse, DeviceAlertResponse, SuspiciousFlagResponse } from "@/shared/types/security";
import type { SessionResponse } from "@/shared/types/session";
import type { StoryResponse } from "@/shared/types/story";
import type { ProfileResponse } from "@/shared/types/user";

export const FEED_PAGE_SIZE = 10;

export type HomeDashboard = {
  profile: ProfileResponse;
  stories: StoryResponse[];
  posts: PostResponse[];
  rooms: TrustRoomResponse[];
  chats: ChatResponse[];
  connections: ConnectionResponse[];
  sessions: SessionResponse[];
  auditEvents: AuditEventResponse[];
  flags: SuspiciousFlagResponse[];
  alerts: DeviceAlertResponse[];
};

export type HomeDashboardViewModel = Omit<HomeDashboard, "posts" | "rooms"> & {
  posts: PostResponse[];
  rooms: TrustRoomResponse[];
};
