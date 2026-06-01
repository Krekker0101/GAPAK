import { apiClient } from "@/shared/api/client";
import type {
  AdminOverview,
  AdminUser,
  ListAdminUsersResponse,
  ListPagesResponse,
  PageResponse,
  UpdateAdminUserRequest,
  UpdatePageRequest,
} from "@/shared/types/admin";

export const adminService = {
  overview() {
    return apiClient<AdminOverview>({
      path: "/admin/overview",
    });
  },
  users(query: { search?: string; role?: string; status?: string; limit?: number; offset?: number } = {}) {
    return apiClient<ListAdminUsersResponse>({
      path: "/admin/users",
      query,
    });
  },
  updateUser(userId: string, payload: UpdateAdminUserRequest) {
    return apiClient<AdminUser>({
      path: `/admin/users/${userId}`,
      method: "PATCH",
      body: payload,
    });
  },
  pages(locale?: string) {
    return apiClient<ListPagesResponse>({
      path: "/admin/content/pages",
      query: { locale },
    });
  },
  page(slug: string, locale: string) {
    return apiClient<PageResponse>({
      path: `/admin/content/pages/${slug}`,
      query: { locale },
    });
  },
  updatePage(slug: string, payload: UpdatePageRequest) {
    return apiClient<PageResponse>({
      path: `/admin/content/pages/${slug}`,
      method: "PUT",
      body: payload,
    });
  },
};
