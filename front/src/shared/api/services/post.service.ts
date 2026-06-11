import { apiClient } from "@/shared/api/client";
import type { ListQuery } from "@/shared/types/api";
import type { AcceptedResponse } from "@/shared/types/auth";
import type { CommentResponse, CreateCommentRequest, CreatePostRequest, LikesListResponse, PostResponse, UpdatePostRequest } from "@/shared/types/post";

export const postService = {
  getFeed(query?: ListQuery) {
    return apiClient<PostResponse[]>({
      path: "/posts/feed",
      query,
    });
  },
  getClips(query?: ListQuery) {
    return apiClient<PostResponse[]>({
      path: "/posts/clips",
      query,
    });
  },
  getById(postId: string) {
    return apiClient<PostResponse>({
      path: `/posts/${postId}`,
    });
  },
  create(payload: CreatePostRequest) {
    return apiClient<PostResponse>({
      path: "/posts",
      method: "POST",
      body: payload,
    });
  },
  update(postId: string, payload: UpdatePostRequest) {
    return apiClient<PostResponse>({
      path: `/posts/${postId}`,
      method: "PATCH",
      body: payload,
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
  getLikes(postId: string, query?: ListQuery) {
    return apiClient<LikesListResponse[]>({
      path: `/posts/${postId}/likes`,
      query,
    });
  },
  getComments(postId: string, query?: ListQuery & { sortBy?: "recent" | "top" }) {
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
  remove(postId: string) {
    return apiClient<AcceptedResponse>({
      path: `/posts/${postId}`,
      method: "DELETE",
    });
  },
};
