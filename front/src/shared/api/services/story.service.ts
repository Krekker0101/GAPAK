import { apiClient } from "@/shared/api/client";
import type { ListQuery } from "@/shared/types/api";
import type { AcceptedResponse } from "@/shared/types/auth";
import type { CreateStoryRequest, ReactStoryRequest, StoryResponse, StoryViewerResponse } from "@/shared/types/story";

export const storyService = {
  getFeed(query?: ListQuery) {
    return apiClient<StoryResponse[]>({
      path: "/stories/feed",
      query,
    });
  },
  getById(storyId: string) {
    return apiClient<StoryResponse>({
      path: `/stories/${storyId}`,
    });
  },
  viewers(storyId: string) {
    return apiClient<StoryViewerResponse[]>({
      path: `/stories/${storyId}/viewers`,
    });
  },
  create(payload: CreateStoryRequest) {
    return apiClient<StoryResponse>({
      path: "/stories",
      method: "POST",
      body: payload,
    });
  },
  react(storyId: string, payload: ReactStoryRequest) {
    return apiClient<AcceptedResponse>({
      path: `/stories/${storyId}/reactions`,
      method: "POST",
      body: payload,
    });
  },
};
