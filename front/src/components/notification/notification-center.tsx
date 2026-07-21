"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, AtSign, MessageSquare, FileText, Users, Hash, Check, CheckCheck } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import type { Notification, Mention } from "@/shared/types/notification";
import { formatRelativeTime } from "@/shared/lib/utils";

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  mention: <AtSign className="w-5 h-5 text-blue-500" />,
  like: <Hash className="w-5 h-5 text-pink-500" />,
  comment: <MessageSquare className="w-5 h-5 text-green-500" />,
  follow: <Users className="w-5 h-5 text-purple-500" />,
  system: <FileText className="w-5 h-5 text-slate-500" />,
};

const MENTION_TYPE_LABELS: Record<string, string> = {
  chat: "in a chat",
  comment: "in a comment",
  post: "in a post",
  story: "in a story",
  room: "in a room",
  community: "in a community",
  project: "in a project",
  ai_collaboration: "in AI collaboration",
};

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  async function loadNotifications() {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch("/api/notifications");
      // const data = await response.json();
      // setNotifications(data.notifications);
      // setMentions(data.mentions);
      // setUnreadCount(data.unreadCount);

      // Mock data for now
      const mockNotifications: Notification[] = [
        {
          id: "1",
          userId: "user-1",
          type: "mention",
          title: "Alex mentioned you",
          body: "Alex mentioned you in a comment",
          isRead: false,
          createdAt: new Date(Date.now() - 300000).toISOString(),
          actionUrl: "/posts/123#comment-456",
        },
        {
          id: "2",
          userId: "user-1",
          type: "like",
          title: "Your post was liked",
          body: "Jordan liked your post",
          isRead: false,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          actionUrl: "/posts/789",
        },
        {
          id: "3",
          userId: "user-1",
          type: "comment",
          title: "New comment on your post",
          body: "Sarah commented on your post",
          isRead: true,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          actionUrl: "/posts/789#comment-789",
        },
      ];

      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.filter((n) => !n.isRead).length);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      // TODO: Replace with actual API call
      // await fetch(`/api/notifications/${notificationId}/read`, { method: "POST" });
      
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  async function markAllAsRead() {
    try {
      // TODO: Replace with actual API call
      // await fetch("/api/notifications/read-all", { method: "POST" });
      
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Notification Panel */}
          <motion.div
            initial={{ opacity: 0, x: 300, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-4 top-4 bottom-4 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Bell className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">{unreadCount}</span>
                    </div>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Notifications</h2>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead} className="gap-2">
                    <CheckCheck className="w-4 h-4" />
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                  <Bell className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No notifications yet</p>
                  <p className="text-sm">You'll see notifications here</p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => handleNotificationClick(notification)}
                      className={`group relative p-4 rounded-2xl cursor-pointer transition-all ${
                        notification.isRead
                          ? "bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                          : "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
                          {NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.system}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="flex-shrink-0 w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            {notification.body}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                            <span>{formatRelativeTime(notification.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Hover effect */}
                      <div className="absolute inset-0 rounded-2xl ring-2 ring-transparent group-hover:ring-blue-500/20 transition-all pointer-events-none" />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <Button variant="outline" className="w-full" onClick={onClose}>
                Close
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
