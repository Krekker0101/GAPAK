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
  publishedAt: string;
  editedAt?: string | null;
};
