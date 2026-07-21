"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect } from "react";
import { Search, Filter, Grid, List, TrendingUp, Clock, Heart, MessageSquare, Share2, MoreVertical } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { useInView } from "react-intersection-observer";
import { useVirtualizer } from "@tanstack/react-virtual";

// Types
interface Post {
  id: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    isVerified: boolean;
  };
  content: string;
  media?: {
    type: "image" | "video";
    url: string;
    thumbnail?: string;
  }[];
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  createdAt: string;
  tags: string[];
}

// Mock data - replace with API call
const MOCK_POSTS: Post[] = Array.from({ length: 100 }, (_, i) => ({
  id: `post-${i}`,
  author: {
    id: `user-${i}`,
    username: `user${i}`,
    displayName: `User ${i}`,
    isVerified: i % 5 === 0,
  },
  content: `This is post ${i + 1} with some sample content. Premium quality content that showcases the platform's capabilities.`,
  media: i % 3 === 0 ? [{
    type: "image" as const,
    url: `/placeholder-${i}.jpg`,
  }] : undefined,
  metrics: {
    likes: Math.floor(Math.random() * 1000),
    comments: Math.floor(Math.random() * 100),
    shares: Math.floor(Math.random() * 50),
    views: Math.floor(Math.random() * 10000),
  },
  createdAt: new Date(Date.now() - i * 3600000).toISOString(),
  tags: i % 2 === 0 ? ["premium", "content"] : ["social", "network"],
}));

// Skeleton component
function PostSkeleton() {
  return (
    <Card className="p-6 border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Post Card Component
function PostCard({ post, index }: { post: Post; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Card className="group border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-white/20">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                  {post.author.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {post.author.displayName}
                  </h3>
                  {post.author.isVerified && (
                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  @{post.author.username} · {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="hover:bg-slate-100 dark:hover:bg-slate-800">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-4">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            {post.content}
          </p>
          
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className="relative aspect-video bg-slate-100 dark:bg-slate-800">
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              Media content
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="p-6 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors">
                <Heart className="w-5 h-5" />
                <span className="text-sm font-medium">{post.metrics.likes}</span>
              </button>
              <button className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-500 transition-colors">
                <MessageSquare className="w-5 h-5" />
                <span className="text-sm font-medium">{post.metrics.comments}</span>
              </button>
              <button className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-green-500 transition-colors">
                <Share2 className="w-5 h-5" />
                <span className="text-sm font-medium">{post.metrics.shares}</span>
              </button>
            </div>
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-500 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>{post.metrics.views.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortBy, setSortBy] = useState<"trending" | "latest" | "popular">("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  // Infinite scroll
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  });

  // Load more posts when in view
  useEffect(() => {
    if (inView && !loading) {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setPosts((prev) => [...prev, ...MOCK_POSTS.slice(prev.length, prev.length + 20)]);
        setLoading(false);
      }, 1000);
    }
  }, [inView, loading]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setPosts(MOCK_POSTS.slice(0, 20));
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-blue-950 dark:to-purple-950">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={sortBy === "trending" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSortBy("trending")}
                className="gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Trending
              </Button>
              <Button
                variant={sortBy === "latest" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSortBy("latest")}
                className="gap-2"
              >
                <Clock className="w-4 h-4" />
                Latest
              </Button>
              <Button
                variant={sortBy === "popular" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSortBy("popular")}
                className="gap-2"
              >
                <Heart className="w-4 h-4" />
                Popular
              </Button>
              
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
              
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="w-5 h-5" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Filter className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-6"}>
          <AnimatePresence>
            {posts.map((post, index) => (
              <PostCard key={post.id} post={post} index={index} />
            ))}
          </AnimatePresence>
          
          {loading && (
            <>
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </>
          )}
        </div>
        
        {/* Infinite scroll trigger */}
        <div ref={ref} className="h-20" />
      </div>
    </div>
  );
}
