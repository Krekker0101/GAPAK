import { apiClient } from "@/shared/api/client";
import type { Notification, Mention } from "@/shared/types/notification";

export interface NotificationListResponse {
  notifications: Notification[];
  mentions: Mention[];
  unreadCount: number;
}

export const notificationService = {
  /**
   * Get all notifications for the current user
   */
  async getNotifications(): Promise<NotificationListResponse> {
    return apiClient<NotificationListResponse>({
      path: "/notifications",
      method: "GET",
    });
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    return apiClient<void>({
      path: `/notifications/${notificationId}/read`,
      method: "POST",
    });
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    return apiClient<void>({
      path: "/notifications/read-all",
      method: "POST",
    });
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    return apiClient<void>({
      path: `/notifications/${notificationId}`,
      method: "DELETE",
    });
  },

  /**
   * Get mention analytics
   */
  async getMentionAnalytics(): Promise<{
    totalMentions: number;
    mentionsThisWeek: number;
    topMentioners: Array<{ username: string; displayName: string; count: number }>;
    topCommunities: Array<{ communityId: string; name: string; count: number }>;
  }> {
    return apiClient({
      path: "/notifications/mention-analytics",
      method: "GET",
    });
  },
};
