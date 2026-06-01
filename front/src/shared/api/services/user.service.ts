import { apiClient } from "@/shared/api/client";
import type {
  ProfileResponse,
  UpdatePrivacyRequest,
  UpdateProfileRequest,
} from "@/shared/types/user";

export const userService = {
  getMe() {
    return apiClient<ProfileResponse>({
      path: "/users/me",
    });
  },
  updateMe(payload: UpdateProfileRequest) {
    return apiClient<ProfileResponse>({
      path: "/users/me",
      method: "PATCH",
      body: payload,
    });
  },
  updatePrivacy(payload: UpdatePrivacyRequest) {
    return apiClient<ProfileResponse>({
      path: "/users/me/privacy",
      method: "PATCH",
      body: payload,
    });
  },
};
