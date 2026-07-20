"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Search, Filter, Clock, BookOpen, ArrowRight, Bookmark, Share2 } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { useInView } from "react-intersection-observer";

interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    isVerified: boolean;
  };
  coverImage?: string;
  category: string;
  readTime: number;
  metrics: {
    views: number;
    likes: number;
    bookmarks: number;
  };
  createdAt: string;
  tags: string[];
}

const MOCK_ARTICLES: Article[] = Array.from({ length: 50 }, (_, i) => ({
  id: `article-${i}`,
  title: `Premium Article ${i + 1}: Building Next-Generation Social Networks`,
  excerpt: "An in-depth exploration of modern social network architecture, focusing on performance, scalability, and user experience.",
  content: "Full article content would go here...",
  author: {
    id: `user-${i}`,
    username: `author${i}`,
    displayName: `Author ${i}`,
    isVerified: i % 3 === 0,
  },
  coverImage: i % 2 === 0 ? `/article-cover-${i}.jpg` : undefined,
  category: ["Technology", "Design", "Development", "Product"][i % 4],
  readTime: 5 + Math.floor(Math.random() * 10),
  metrics: {
    views: Math.floor(Math.random() * 50000),
    likes: Math.floor(Math.random() * 5000),
    bookmarks: Math.floor(Math.random() * 1000),
  },
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  tags: i % 2 === 0 ? ["social", "network", "premium"] : ["tech", "design"],
}));

function ArticleCard({ article, index }: { article: Article; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Card className="group border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
        {/* Cover Image */}
        {article.coverImage && (
          <div className="relative aspect-video bg-gradient-to-br from-blue-500/20 to-purple-500/20">
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              Cover Image
            </div>
          </div>
        )}

        <div className="p-6">
          {/* Category Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium mb-3">
            <BookOpen className="w-3 h-3" />
            {article.category}
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {article.title}
          </h3>

          {/* Excerpt */}
          <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">
            {article.excerpt}
          </p>

          {/* Author Info */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                {article.author.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {article.author.displayName}
                </span>
                {article.author.isVerified && (
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-[8px]">✓</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                <Clock className="w-3 h-3" />
                <span>{article.readTime} min read</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {article.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Metrics */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-500">
              <span>{article.metrics.views.toLocaleString()} views</span>
              <span>{article.metrics.likes.toLocaleString()} likes</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Bookmark className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  });

  useEffect(() => {
    if (inView && !loading) {
      setLoading(true);
      setTimeout(() => {
        setArticles((prev) => [...prev, ...MOCK_ARTICLES.slice(prev.length, prev.length + 10)]);
        setLoading(false);
      }, 1000);
    }
  }, [inView, loading]);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setArticles(MOCK_ARTICLES.slice(0, 10));
      setLoading(false);
    }, 1000);
  }, []);

  const categories = ["all", "Technology", "Design", "Development", "Product"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-purple-950 dark:to-pink-950">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
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
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article, index) => (
            <ArticleCard key={article.id} article={article} index={index} />
          ))}
          
          {loading && (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg">
                  <div className="space-y-4">
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-6 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
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
