import { chatService } from "@/shared/api/services/chat.service";
import { connectionService } from "@/shared/api/services/connection.service";
import { postService } from "@/shared/api/services/post.service";
import { roomService } from "@/shared/api/services/room.service";
import { securityService } from "@/shared/api/services/security.service";
import { sessionService } from "@/shared/api/services/session.service";
import { storyService } from "@/shared/api/services/story.service";
import { userService } from "@/shared/api/services/user.service";
import { FEED_PAGE_SIZE, type HomeDashboard } from "@/features/feed/types/home-dashboard";

export async function loadHomeDashboard(): Promise<HomeDashboard> {
  const [profile, stories, posts, rooms, chats, connections, sessions, auditEvents, flags, alerts] = await Promise.all([
    userService.getMe(),
    storyService.getFeed({ page: 1, limit: 20 }),
    postService.getFeed({ page: 1, limit: FEED_PAGE_SIZE }),
    roomService.listRooms(),
    chatService.listChats(),
    connectionService.listConnections(),
    sessionService.listSessions(),
    securityService.getAuditEvents(),
    securityService.getFlags(),
    securityService.getAlerts(),
  ]);

  return { profile, stories, posts, rooms, chats, connections, sessions, auditEvents, flags, alerts };
}
