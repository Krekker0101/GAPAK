import type { PostPrivacy } from "@/shared/types/user";

export type StoryReactionType = "LIKE" | "FIRE" | "SUPPORT";

export type CreateStoryRequest = {
  mediaFileId: string;
  trustRoomId?: string | null;
  caption?: string | null;
  privacy: PostPrivacy;
  allowReplies: boolean;
  allowReactions: boolean;
  expiresAt?: string | null;
  customAudienceUserIds?: string[];
  highlightTitle?: string | null;
};

export type ReactStoryRequest = {
  reactionType: StoryReactionType;
};

export type StoryResponse = {
  id: string;
  authorId: string;
  mediaFileId: string;
  videoAssetId?: string | null;
  trustRoomId?: string | null;
  caption?: string | null;
  privacy: PostPrivacy;
  status: string;
  allowReplies: boolean;
  allowReactions: boolean;
  highlightTitle?: string | null;
  audienceUserIds?: string[];
  viewerCount: number;
  expiresAt: string;
  publishedAt: string;
};

export type StoryViewerResponse = {
  viewerUserId: string;
  reactionType?: StoryReactionType | null;
  viewedAt: string;
  reactedAt?: string | null;
};
