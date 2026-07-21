import { apiClient } from "@/shared/api/client";

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  isVerified: boolean;
}

export interface UserSearchParams {
  q: string;
  limit?: number;
}

export const userSearchService = {
  /**
   * Search users by username or display name
   * Used for mention autocomplete
   */
  async searchUsers(params: UserSearchParams): Promise<UserSearchResult[]> {
    return apiClient<UserSearchResult[]>({
      path: "/users/search",
      method: "GET",
      query: params as unknown as Record<string, string | number | boolean | null | undefined>,
    });
  },

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<UserSearchResult> {
    return apiClient<UserSearchResult>({
      path: `/users/@${username}`,
      method: "GET",
    });
  },
};
