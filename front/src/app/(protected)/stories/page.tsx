"use client";

import { useState } from "react";
import { Search, Filter, TrendingUp, Globe, Users, Flame, Clock, MapPin } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";

interface Story {
  id: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    isVerified: boolean;
  };
  thumbnailUrl: string;
  caption: string;
  viewers: number;
  createdAt: string;
  location?: string;
}

const MOCK_STORIES: Story[] = Array.from({ length: 50 }, (_, i) => ({
  id: `story-${i}`,
  author: {
    id: `user-${i}`,
    username: `user${i}`,
    displayName: `Creator ${i}`,
    isVerified: i % 4 === 0,
  },
  thumbnailUrl: `/story-thumb-${i}.jpg`,
  caption: `Premium story ${i + 1} showcasing amazing content`,
  viewers: Math.floor(Math.random() * 10000),
  createdAt: new Date(Date.now() - i * 3600000).toISOString(),
  location: i % 3 === 0 ? "New York, USA" : undefined,
}));

export default function StoriesDiscoveryPage() {
  const [activeTab, setActiveTab] = useState<"trending" | "nearby" | "public" | "creators" | "friends">("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = ["all", "Lifestyle", "Travel", "Food", "Music", "Art", "Tech"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50 to-purple-50 dark:from-slate-950 dark:via-pink-950 dark:to-purple-950">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search stories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <Button variant="outline" size="icon" className="gap-2">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Button
            variant={activeTab === "trending" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("trending")}
            className="gap-2"
          >
            <Flame className="w-4 h-4" />
            Trending
          </Button>
          <Button
            variant={activeTab === "nearby" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("nearby")}
            className="gap-2"
          >
            <MapPin className="w-4 h-4" />
            Nearby
          </Button>
          <Button
            variant={activeTab === "public" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("public")}
            className="gap-2"
          >
            <Globe className="w-4 h-4" />
            Public
          </Button>
          <Button
            variant={activeTab === "creators" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("creators")}
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            Creators
          </Button>
          <Button
            variant={activeTab === "friends" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("friends")}
            className="gap-2"
          >
            <Clock className="w-4 h-4" />
            Friends
          </Button>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="capitalize"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Stories Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {MOCK_STORIES.map((story) => (
            <Card key={story.id} className="group border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer">
              {/* Thumbnail */}
              <div className="relative aspect-[9/16] bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                  Story
                </div>
                
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Viewers count */}
                <div className="absolute top-2 right-2 flex items-center gap-1 text-white text-xs bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  {story.viewers.toLocaleString()}
                </div>
              </div>

              {/* Author info */}
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white text-[10px]">
                      {story.author.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {story.author.displayName}
                      </span>
                      {story.author.isVerified && (
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[8px]">✓</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                  {story.caption}
                </p>

                {story.location && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500 mt-2">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{story.location}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
