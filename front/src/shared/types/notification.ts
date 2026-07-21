export type MentionType =
  | "chat"
  | "comment"
  | "post"
  | "story"
  | "room"
  | "community"
  | "project"
  | "ai_collaboration";

export interface Mention {
  id: string;
  mentionedUserId: string;
  mentionedByUsername: string;
  mentionedByDisplayName: string;
  mentionedByAvatar?: string;
  type: MentionType;
  content: string;
  contextId: string;
  contextType: string;
  createdAt: string;
  isRead: boolean;
  metadata?: {
    postId?: string;
    commentId?: string;
    roomId?: string;
    communityId?: string;
    projectId?: string;
    storyId?: string;
    chatId?: string;
  };
}

export interface Notification {
  id: string;
  userId: string;
  type: "mention" | "like" | "comment" | "follow" | "system";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface MentionSuggestion {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  isVerified: boolean;
}
