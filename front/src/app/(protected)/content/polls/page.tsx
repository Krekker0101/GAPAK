"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Search, Filter, Clock, BarChart3, Users, MessageSquare, TrendingUp } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { useInView } from "react-intersection-observer";

interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
}

interface Poll {
  id: string;
  question: string;
  description: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    isVerified: boolean;
  };
  category: string;
  status: "active" | "ended";
  options: PollOption[];
  metrics: {
    totalVotes: number;
    comments: number;
    shares: number;
  };
  createdAt: string;
  endsAt: string;
  tags: string[];
}

const MOCK_POLLS: Poll[] = Array.from({ length: 50 }, (_, i) => {
  const totalVotes = Math.floor(Math.random() * 1000) + 100;
  const options = [
    { id: `opt-${i}-1`, text: "Option A", votes: Math.floor(totalVotes * 0.4), percentage: 40 },
    { id: `opt-${i}-2`, text: "Option B", votes: Math.floor(totalVotes * 0.3), percentage: 30 },
    { id: `opt-${i}-3`, text: "Option C", votes: Math.floor(totalVotes * 0.2), percentage: 20 },
    { id: `opt-${i}-4`, text: "Option D", votes: Math.floor(totalVotes * 0.1), percentage: 10 },
  ];
  
  return {
    id: `poll-${i}`,
    question: `What's your opinion on topic ${i + 1}?`,
    description: "Share your thoughts and help us understand community preferences better.",
    author: {
      id: `user-${i}`,
      username: `pollster${i}`,
      displayName: `Pollster ${i}`,
      isVerified: i % 4 === 0,
    },
    category: ["Technology", "Lifestyle", "Entertainment", "Politics", "Sports"][i % 5],
    status: i % 3 === 0 ? "ended" : "active",
    options,
    metrics: {
      totalVotes,
      comments: Math.floor(Math.random() * 200),
      shares: Math.floor(Math.random() * 100),
    },
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    endsAt: new Date(Date.now() + (7 - i) * 86400000).toISOString(),
    tags: i % 2 === 0 ? ["community", "opinion"] : ["survey", "feedback"],
  };
});

function PollCard({ poll, index }: { poll: Poll; index: number }) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(poll.status === "ended");

  const handleVote = (optionId: string) => {
    if (!hasVoted && poll.status === "active") {
      setSelectedOption(optionId);
      setHasVoted(true);
      // API call to submit vote
      console.log("Vote for:", optionId);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Card className="group border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
        <div className="p-6">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3">
            <span className={`px-3 py-1 rounded-full ${
              poll.status === "active" 
                ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
            }`}>
              {poll.status.charAt(0).toUpperCase() + poll.status.slice(1)}
            </span>
            {poll.status === "active" && (
              <span className="text-slate-500 dark:text-slate-500">
                • Ends {new Date(poll.endsAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Question */}
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
            {poll.question}
          </h3>

          {/* Description */}
          <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
            {poll.description}
          </p>

          {/* Category */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium mb-4">
            <BarChart3 className="w-3 h-3" />
            {poll.category}
          </div>

          {/* Poll Options */}
          <div className="space-y-3 mb-4">
            {poll.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleVote(option.id)}
                disabled={hasVoted || poll.status === "ended"}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  selectedOption === option.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                } ${hasVoted || poll.status === "ended" ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-900 dark:text-white">{option.text}</span>
                  {hasVoted || poll.status === "ended" ? (
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {option.percentage}%
                    </span>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                  )}
                </div>
                {(hasVoted || poll.status === "ended") && (
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${option.percentage}%` }}
                    />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Author Info */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xs">
                {poll.author.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {poll.author.displayName}
                </span>
                {poll.author.isVerified && (
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-[8px]">✓</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                <Clock className="w-3 h-3" />
                <span>{new Date(poll.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {poll.tags.slice(0, 3).map((tag) => (
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
                <Users className="w-4 h-4" />
                <span>{poll.metrics.totalVotes.toLocaleString()} votes</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                <span>{poll.metrics.comments}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <TrendingUp className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
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
        setPolls((prev) => [...prev, ...MOCK_POLLS.slice(prev.length, prev.length + 10)]);
        setLoading(false);
      }, 1000);
    }
  }, [inView, loading]);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setPolls(MOCK_POLLS.slice(0, 10));
      setLoading(false);
    }, 1000);
  }, []);

  const categories = ["all", "Technology", "Lifestyle", "Entertainment", "Politics", "Sports"];
  const statuses = ["all", "active", "ended"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50 dark:from-slate-950 dark:via-green-950 dark:to-teal-950">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search polls..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
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
          {polls.map((poll, index) => (
            <PollCard key={poll.id} poll={poll} index={index} />
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
