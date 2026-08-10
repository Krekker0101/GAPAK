/**
 * GAPAK Social Domain Specifications & Data Contracts
 * Phase 2 - Social Experience Engine
 */

import { UserProfile, PresenceStatus } from './index';

// --- Profile Relationship & Visibility States ---
export type ProfileRelationshipState =
  | 'owner'
  | 'visitor'
  | 'following'
  | 'requested'
  | 'blocked'
  | 'private'
  | 'restricted';

export type ConnectionState = 'none' | 'requested_sent' | 'requested_received' | 'connected';

export interface UserPrivacySettings {
  isPrivateAccount: boolean;
  allowDirectMessages: 'everyone' | 'connections' | 'none';
  showPresence: boolean;
  showTrustedCircleBadge: boolean;
  allowStoryReplies: 'everyone' | 'connections' | 'none';
}

export interface ExtendedUserProfile extends UserProfile {
  bio?: string;
  location?: string;
  websiteUrl?: string;
  coverUrl?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  connectionsCount: number;
  trustedCircleCount: number;
  relationshipState: ProfileRelationshipState;
  connectionState: ConnectionState;
  isSubscribed: boolean;
  isMuted: boolean;
  isNotificationsEnabled: boolean;
  isInTrustedCircle: boolean;
  isSilentSubscription?: boolean;
  privacySettings: UserPrivacySettings;
  badges?: string[];
}

// --- Post & Content Privacy Policy ---
export type ContentPrivacyLevel =
  | 'PUBLIC'
  | 'FRIENDS'
  | 'TRUSTED_CIRCLE'
  | 'PRIVATE'
  | 'ONE_TIME'
  | 'TIMED';

export type PostContentType = 'standard' | 'clip' | 'story' | 'live_archive';

export interface PostMediaAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
  aspectRatio?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  altText?: string;
}

export interface Comment {
  id: string;
  postId: string;
  parentId?: string; // For nested comments
  author: UserProfile;
  body: string;
  likesCount: number;
  likedByMe: boolean;
  createdAt: string;
  replies?: Comment[];
}

export interface Post {
  id: string;
  author: UserProfile;
  body: string;
  media: PostMediaAsset[];
  contentType: PostContentType;
  privacy: ContentPrivacyLevel;
  isInTrustedCircle?: boolean;
  oneTimeViewed?: boolean;
  expiresAt?: string; // For TIMED content
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
  sharesCount: number;
  bookmarksCount?: number;
  bookmarkedByMe?: boolean;
  createdAt: string;
  comments: Comment[];
  audienceTags?: string[];
  pinned?: boolean;
}

// --- Stories & Highlights ---
export interface Story {
  id: string;
  author: UserProfile;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  durationSeconds: number;
  privacy: ContentPrivacyLevel;
  createdAt: string;
  expiresAt: string;
  hasViewed?: boolean;
  viewsCount: number;
  viewers?: UserProfile[];
  reactions?: {
    emoji: string;
    count: number;
    reactedByMe?: boolean;
  }[];
}

export interface UserStoryGroup {
  user: UserProfile;
  hasUnseenStories: boolean;
  stories: Story[];
}

export interface Highlight {
  id: string;
  title: string;
  coverUrl: string;
  stories: Story[];
  createdAt: string;
}

// --- Media Pipeline States ---
export type MediaUploadStage =
  | 'select'
  | 'validating'
  | 'preparing'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'failed';

export interface MediaUploadItem {
  id: string;
  file?: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
  stage: MediaUploadStage;
  progress: number; // 0 to 100
  uploadedBytes: number;
  totalBytes: number;
  currentChunk?: number;
  totalChunks?: number;
  previewUrl?: string;
  mediaUrl?: string;
  error?: string;
  canRetry?: boolean;
}

// --- Connection & Subscription Management ---
export interface ConnectionRequest {
  id: string;
  sender: UserProfile;
  receiver: UserProfile;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  mutualConnectionsCount?: number;
  fromUser?: UserProfile;
  note?: string;
}

export interface SubscriptionItem {
  id: string;
  targetUser: UserProfile;
  status: 'subscribed' | 'requested' | 'blocked' | 'muted';
  isSilent: boolean;
  notificationsEnabled: boolean;
  createdAt: string;
}
