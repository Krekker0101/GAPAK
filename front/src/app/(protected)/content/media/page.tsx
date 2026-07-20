"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Search, Filter, Clock, Image as ImageIcon, Video, Music, Play, Heart, Eye } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { useInView } from "react-intersection-observer";

interface MediaItem {
  id: string;
  title: string;
  description: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    isVerified: boolean;
  };
  thumbnailUrl: string;
  type: "image" | "video" | "audio";
  category: string;
  duration?: string;
  metrics: {
    views: number;
    likes: number;
  };
  createdAt: string;
  tags: string[];
}

const MOCK_MEDIA: MediaItem[] = Array.from({ length: 50 }, (_, i) => ({
  id: `media-${i}`,
  title: `Premium Media ${i + 1}`,
  description: "High-quality media content showcasing creativity and artistic expression.",
  author: {
    id: `user-${i}`,
    username: `creator${i}`,
    displayName: `Creator ${i}`,
    isVerified: i % 4 === 0,
  },
  thumbnailUrl: `/media-thumb-${i}.jpg`,
  type: ["image", "video", "audio"][i % 3] as "image" | "video" | "audio",
  category: ["Photography", "Videography", "Music", "Design", "Art"][i % 5],
  duration: i % 3 === 0 ? undefined : `${Math.floor(Math.random() * 10) + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
  metrics: {
    views: Math.floor(Math.random() * 10000),
    likes: Math.floor(Math.random() * 1000),
  },
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  tags: i % 2 === 0 ? ["creative", "art"] : ["media", "content"],
}));

function MediaCard({ media, index }: { media: MediaItem; index: number }) {
  const typeIcons = {
    image: <ImageIcon className="w-4 h-4" />,
    video: <Video className="w-4 h-4" />,
    audio: <Music className="w-4 h-4" />,
  };

  const typeColors = {
    image: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    video: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    audio: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Card className="group border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
        {/* Thumbnail */}
        <div className="relative aspect-square bg-gradient-to-br from-pink-500/20 to-purple-500/20">
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            {typeIcons[media.type]}
          </div>
          
          {/* Duration badge for video/audio */}
          {media.duration && (
            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-white text-xs">
              {media.duration}
            </div>
          )}

          {/* Play button overlay for video/audio */}
          {media.type !== "image" && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-8 h-8 text-white fill-white" />
              </div>
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="p-4">
          {/* Type Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-2">
            <span className={`px-3 py-1 rounded-full ${typeColors[media.type]}`}>
              {media.type.charAt(0).toUpperCase() + media.type.slice(1)}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 line-clamp-2 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
            {media.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
            {media.description}
          </p>

          {/* Category */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 text-xs font-medium mb-3">
            {media.category}
          </div>

          {/* Author Info */}
          <div className="flex items-center gap-2 mb-3">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white text-[10px]">
                {media.author.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-900 dark:text-white truncate">
                  {media.author.displayName}
                </span>
                {media.author.isVerified && (
                  <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[6px]">✓</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-500">
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>{media.metrics.views.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                <span>{media.metrics.likes.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function MediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  });

  useEffect(() => {
    if (inView && !loading) {
      setLoading(true);
      setTimeout(() => {
        setMedia((prev) => [...prev, ...MOCK_MEDIA.slice(prev.length, prev.length + 12)]);
        setLoading(false);
      }, 1000);
    }
  }, [inView, loading]);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setMedia(MOCK_MEDIA.slice(0, 12));
      setLoading(false);
    }, 1000);
  }, []);

  const categories = ["all", "Photography", "Videography", "Music", "Design", "Art"];
  const types = ["all", "image", "video", "audio"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50 to-rose-50 dark:from-slate-950 dark:via-pink-950 dark:to-rose-950">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="capitalize"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            {types.map((type) => (
              <Button
                key={type}
                variant={selectedType === type ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedType(type)}
                className="capitalize"
              >
                {type}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {media.map((item, index) => (
            <MediaCard key={item.id} media={item} index={index} />
          ))}
          
          {loading && (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg">
                  <div className="aspect-square bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
        
        <div ref={ref} className="h-20" />
      </div>
    </div>
  );
}
