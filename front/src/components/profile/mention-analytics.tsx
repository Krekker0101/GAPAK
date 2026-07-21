"use client";

import { motion } from "framer-motion";
import { AtSign, TrendingUp, Users, Hash } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { notificationService } from "@/shared/api/services/notification.service";

interface MentionAnalyticsData {
  totalMentions: number;
  mentionsThisWeek: number;
  topMentioners: Array<{ username: string; displayName: string; count: number }>;
  topCommunities: Array<{ communityId: string; name: string; count: number }>;
}

export function MentionAnalytics() {
  const { data, isLoading, isError } = useAsyncResource(async () => {
    try {
      return await notificationService.getMentionAnalytics();
    } catch (error) {
      console.error("Failed to fetch mention analytics:", error);
      return null;
    }
  }, []);

  if (isLoading) {
    return (
      <Card className="p-6 border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  if (isError || !data) {
    return null;
  }

  return (
    <Card className="p-6 border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500">
          <AtSign className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mention Analytics</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track your mention activity</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20"
        >
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Total Mentions</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{data.totalMentions}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">This Week</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{data.mentionsThisWeek}</p>
        </motion.div>
      </div>

      {/* Top Mentioners */}
      {data.topMentioners.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Top Mentioners
          </h4>
          <div className="space-y-2">
            {data.topMentioners.map((mentioner, index) => (
              <motion.div
                key={mentioner.username}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {mentioner.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{mentioner.displayName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">@{mentioner.username}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{mentioner.count}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">mentions</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Top Communities */}
      {data.topCommunities.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Top Communities
          </h4>
          <div className="space-y-2">
            {data.topCommunities.map((community, index) => (
              <motion.div
                key={community.communityId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {community.name.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{community.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{community.count}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">mentions</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
