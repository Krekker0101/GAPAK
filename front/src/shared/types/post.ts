import type { PostPrivacy } from "@/shared/types/user";

export type CreatePostRequest = {
  contentType?: "POST" | "CLIP";
  body: string;
  privacy: PostPrivacy;
  expiresAt?: string | null;
  oneTimeViewLimit?: number | null;
  audienceUserIds?: string[];
  mediaFileIds?: string[];
};

export type UpdatePostRequest = Partial<CreatePostRequest>;

export type PostResponse = {
  id: string;
  authorId: string;
  contentType: "POST" | "CLIP";
  body: string;
  privacy: PostPrivacy;
  expiresAt?: string | null;
  oneTimeViewLimit?: number | null;
  audienceUserIds?: string[];
  mediaFileIds?: string[];
  mediaFileIDs?: string[];
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  publishedAt: string;
  editedAt?: string | null;
};


export type CreateCommentRequest = {
  content: string;
  parentCommentId?: string | null;
};

export type CommentResponse = {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId?: string | null;
  content: string;
  likeCount: number;
  replyCount: number;
  isLiked: boolean;
  replies?: CommentResponse[];
  createdAt: string;
  updatedAt: string;
};

export type LikesListResponse = {
  userId: string;
  username: string;
};
