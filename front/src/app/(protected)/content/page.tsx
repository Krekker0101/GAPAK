"use client";

import { motion } from "framer-motion";
import { 
  FileText, 
  FolderKanban, 
  Calendar, 
  File, 
  BarChart3, 
  Image as ImageIcon,
  ArrowRight,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { Card } from "@/shared/ui/card";

const CONTENT_CATEGORIES = [
  {
    id: "posts",
    title: "Posts",
    description: "Traditional publications and updates",
    icon: FileText,
    gradient: "from-blue-500 to-cyan-500",
    count: 1234,
    color: "blue"
  },
  {
    id: "articles",
    title: "Articles",
    description: "Long-form content and essays",
    icon: FileText,
    gradient: "from-purple-500 to-pink-500",
    count: 567,
    color: "purple"
  },
  {
    id: "projects",
    title: "Projects",
    description: "Project showcases and portfolios",
    icon: FolderKanban,
    gradient: "from-emerald-500 to-teal-500",
    count: 89,
    color: "emerald"
  },
  {
    id: "events",
    title: "Events",
    description: "Upcoming events and meetups",
    icon: Calendar,
    gradient: "from-orange-500 to-red-500",
    count: 34,
    color: "orange"
  },
  {
    id: "documents",
    title: "Documents",
    description: "PDFs, presentations and files",
    icon: File,
    gradient: "from-indigo-500 to-violet-500",
    count: 156,
    color: "indigo"
  },
  {
    id: "polls",
    title: "Polls",
    description: "Community polls and surveys",
    icon: BarChart3,
    gradient: "from-amber-500 to-yellow-500",
    count: 78,
    color: "amber"
  },
  {
    id: "media",
    title: "Media",
    description: "Photos and videos gallery",
    icon: ImageIcon,
    gradient: "from-rose-500 to-pink-500",
    count: 2345,
    color: "rose"
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.2, 0.8, 0.2, 1]
    }
  }
};

export default function ContentHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-blue-950 dark:to-purple-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Premium Content Hub
              </span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
              Content Hub
            </h1>
            
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Discover and explore premium content across multiple categories. 
              Everything you need, all in one place.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content Categories Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {CONTENT_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <Link key={category.id} href={`/content/${category.id}`}>
                <motion.div
                  variants={itemVariants}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card className="group relative overflow-hidden border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300">
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                    
                    {/* Content */}
                    <div className="relative p-6">
                      <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${category.gradient} mb-4`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {category.title}
                      </h3>
                      
                      <p className="text-slate-600 dark:text-slate-400 mb-4">
                        {category.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-500">
                          {category.count.toLocaleString()} items
                        </span>
                        
                        <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-${category.color}-500/10 text-${category.color}-600 dark:text-${category.color}-400 text-sm font-medium group-hover:bg-${category.color}-500 group-hover:text-white transition-all duration-300`}>
                          Explore
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Hover Glow Effect */}
                    <div className={`absolute -inset-1 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300`} />
                  </Card>
                </motion.div>
              </Link>
            );
          })}
        </motion.div>
      </div>

      {/* Premium Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="p-6 border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">100M+</div>
            <div className="text-slate-600 dark:text-slate-400">Content Items</div>
          </Card>
          
          <Card className="p-6 border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl">
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">10K+</div>
            <div className="text-slate-600 dark:text-slate-400">Active Creators</div>
          </Card>
          
          <Card className="p-6 border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl">
            <div className="text-4xl font-bold text-pink-600 dark:text-pink-400 mb-2">99.9%</div>
            <div className="text-slate-600 dark:text-slate-400">Uptime</div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
