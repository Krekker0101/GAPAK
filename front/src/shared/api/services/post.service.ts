import { apiClient } from "@/shared/api/client";
import type { ListQuery } from "@/shared/types/api";
import type { AcceptedResponse } from "@/shared/types/auth";
import type { CreatePostRequest, PostResponse, UpdatePostRequest } from "@/shared/types/post";

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
  remove(postId: string) {
    return apiClient<AcceptedResponse>({
      path: `/posts/${postId}`,
      method: "DELETE",
    });
  },
};
