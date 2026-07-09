import { apiClient } from "@/shared/api/client";
import type { ListQuery } from "@/shared/types/api";
import type { AcceptedResponse } from "@/shared/types/auth";
import type { CommentResponse, CreateCommentRequest, CreatePostRequest, PostResponse, UpdatePostRequest } from "@/shared/types/post";

function normalizePost(post: PostResponse): PostResponse {
  return {
    ...post,
    mediaFileIds: post.mediaFileIds ?? post.mediaFileIDs ?? [],
    likeCount: post.likeCount ?? 0,
    commentCount: post.commentCount ?? 0,
    isLiked: Boolean(post.isLiked),
  };
}

function normalizePosts(posts: PostResponse[]): PostResponse[] {
  return posts.map(normalizePost);
}

export const postService = {
  getFeed(query?: ListQuery) {
    return apiClient<PostResponse[]>({
      path: "/posts/feed",
      query,
    }).then(normalizePosts);
  },
  getClips(query?: ListQuery) {
    return apiClient<PostResponse[]>({
      path: "/posts/clips",
      query,
    }).then(normalizePosts);
  },
  getById(postId: string) {
    return apiClient<PostResponse>({
      path: `/posts/${postId}`,
    }).then(normalizePost);
  },
  create(payload: CreatePostRequest) {
    return apiClient<PostResponse>({
      path: "/posts",
      method: "POST",
      body: payload,
    }).then(normalizePost);
  },
  update(postId: string, payload: UpdatePostRequest) {
    return apiClient<PostResponse>({
      path: `/posts/${postId}`,
      method: "PATCH",
      body: payload,
    }).then(normalizePost);
  },
  remove(postId: string) {
    return apiClient<AcceptedResponse>({
      path: `/posts/${postId}`,
      method: "DELETE",
    });
  },
  like(postId: string) {
    return apiClient<AcceptedResponse>({
      path: `/posts/${postId}/like`,
      method: "POST",
    });
  },
  unlike(postId: string) {
    return apiClient<AcceptedResponse>({
      path: `/posts/${postId}/like`,
      method: "DELETE",
    });
  },
  getComments(postId: string, query?: { page?: number; limit?: number; sortBy?: "recent" | "top" }) {
    return apiClient<CommentResponse[]>({
      path: `/posts/${postId}/comments`,
      query,
    });
  },
  createComment(postId: string, payload: CreateCommentRequest) {
    return apiClient<CommentResponse>({
      path: `/posts/${postId}/comments`,
      method: "POST",
      body: payload,
    });
  },
};
