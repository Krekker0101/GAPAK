"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Search, Filter, Clock, Calendar, MapPin, Users, Ticket, ArrowRight } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { useInView } from "react-intersection-observer";

interface Event {
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
  startDate: string;
  endDate: string;
  location: string;
  isVirtual: boolean;
  metrics: {
    attendees: number;
    interested: number;
  };
  tags: string[];
}

const MOCK_EVENTS: Event[] = Array.from({ length: 50 }, (_, i) => ({
  id: `event-${i}`,
  title: `Premium Event ${i + 1}: Tech Conference 2026`,
  description: "Join us for an amazing event featuring industry leaders, workshops, and networking opportunities.",
  author: {
    id: `user-${i}`,
    username: `organizer${i}`,
    displayName: `Organizer ${i}`,
    isVerified: i % 3 === 0,
  },
  coverImage: i % 2 === 0 ? `/event-cover-${i}.jpg` : undefined,
  category: ["Conference", "Workshop", "Meetup", "Webinar", "Hackathon"][i % 5],
  startDate: new Date(Date.now() + i * 86400000).toISOString(),
  endDate: new Date(Date.now() + i * 86400000 + 86400000).toISOString(),
  location: i % 2 === 0 ? "San Francisco, CA" : "Virtual",
  isVirtual: i % 2 !== 0,
  metrics: {
    attendees: Math.floor(Math.random() * 1000),
    interested: Math.floor(Math.random() * 500),
  },
  tags: i % 2 === 0 ? ["tech", "conference", "networking"] : ["webinar", "online", "learning"],
}));

function EventCard({ event, index }: { event: Event; index: number }) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Card className="group border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
        {/* Cover Image */}
        {event.coverImage && (
          <div className="relative aspect-video bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              Cover Image
            </div>
            
            {/* Date Badge */}
            <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {new Date(event.startDate).getDate()}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 uppercase">
                {new Date(event.startDate).toLocaleString("default", { month: "short" })}
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          {/* Category Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-medium mb-3">
            <Calendar className="w-3 h-3" />
            {event.category}
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {event.title}
          </h3>

          {/* Description */}
          <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">
            {event.description}
          </p>

          {/* Event Details */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="w-4 h-4" />
              <span>
                {formatDate(event.startDate)} • {formatTime(event.startDate)} - {formatTime(event.endDate)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              {event.isVirtual ? (
                <>
                  <Ticket className="w-4 h-4" />
                  <span>Virtual Event</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  <span>{event.location}</span>
                </>
              )}
            </div>
          </div>

          {/* Author Info */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                {event.author.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {event.author.displayName}
                </span>
                {event.author.isVerified && (
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-[8px]">✓</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {event.tags.slice(0, 3).map((tag) => (
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
                <span>{event.metrics.attendees} attending</span>
              </div>
              <div className="flex items-center gap-1">
                <Ticket className="w-4 h-4" />
                <span>{event.metrics.interested} interested</span>
              </div>
            </div>
            <Button size="sm" className="gap-2">
              <ArrowRight className="w-4 h-4" />
              Details
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
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
        setEvents((prev) => [...prev, ...MOCK_EVENTS.slice(prev.length, prev.length + 10)]);
        setLoading(false);
      }, 1000);
    }
  }, [inView, loading]);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setEvents(MOCK_EVENTS.slice(0, 10));
      setLoading(false);
    }, 1000);
  }, []);

  const categories = ["all", "Conference", "Workshop", "Meetup", "Webinar", "Hackathon"];

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
                  placeholder="Search events..."
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
          {events.map((event, index) => (
            <EventCard key={event.id} event={event} index={index} />
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
