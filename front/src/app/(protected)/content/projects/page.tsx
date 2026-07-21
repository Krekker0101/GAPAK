"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Search, Filter, Clock, FolderKanban, Users, Star, ArrowRight, ExternalLink } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { useInView } from "react-intersection-observer";

interface Project {
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
  coverImage?: string;
  category: string;
  status: "active" | "completed" | "planned";
  metrics: {
    stars: number;
    forks: number;
    contributors: number;
  };
  createdAt: string;
  tags: string[];
  url?: string;
}

const MOCK_PROJECTS: Project[] = Array.from({ length: 50 }, (_, i) => ({
  id: `project-${i}`,
  title: `Premium Project ${i + 1}`,
  description: "An innovative project showcasing modern development practices and cutting-edge technologies.",
  author: {
    id: `user-${i}`,
    username: `dev${i}`,
    displayName: `Developer ${i}`,
    isVerified: i % 4 === 0,
  },
  coverImage: i % 2 === 0 ? `/project-cover-${i}.jpg` : undefined,
  category: ["Web", "Mobile", "AI", "Blockchain", "IoT"][i % 5],
  status: ["active", "completed", "planned"][i % 3] as "active" | "completed" | "planned",
  metrics: {
    stars: Math.floor(Math.random() * 5000),
    forks: Math.floor(Math.random() * 500),
    contributors: Math.floor(Math.random() * 50),
  },
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  tags: i % 2 === 0 ? ["opensource", "innovation"] : ["tech", "future"],
  url: `https://github.com/project-${i}`,
}));

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const statusColors = {
    active: "bg-green-500/10 text-green-600 dark:text-green-400",
    completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    planned: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Card className="group border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
        {/* Cover Image */}
        {project.coverImage && (
          <div className="relative aspect-video bg-gradient-to-br from-blue-500/20 to-purple-500/20">
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              Cover Image
            </div>
          </div>
        )}

        <div className="p-6">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3">
            <span className={`px-3 py-1 rounded-full ${statusColors[project.status]}`}>
              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {project.title}
          </h3>

          {/* Description */}
          <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">
            {project.description}
          </p>

          {/* Author Info */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xs">
                {project.author.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {project.author.displayName}
                </span>
                {project.author.isVerified && (
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-[8px]">✓</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                <Clock className="w-3 h-3" />
                <span>{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {project.tags.slice(0, 3).map((tag) => (
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
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4" />
                <span>{project.metrics.stars}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{project.metrics.contributors}</span>
              </div>
            </div>
            {project.url && (
              <Button variant="ghost" size="sm" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                View
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  });

  useEffect(() => {
    if (inView && !loading) {
      setLoading(true);
      setTimeout(() => {
        setProjects((prev) => [...prev, ...MOCK_PROJECTS.slice(prev.length, prev.length + 10)]);
        setLoading(false);
      }, 1000);
    }
  }, [inView, loading]);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setProjects(MOCK_PROJECTS.slice(0, 10));
      setLoading(false);
    }, 1000);
  }, []);

  const categories = ["all", "Web", "Mobile", "AI", "Blockchain", "IoT"];
  const statuses = ["all", "active", "completed", "planned"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
            {statuses.map((status) => (
              <Button
                key={status}
                variant={selectedStatus === status ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedStatus(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
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
