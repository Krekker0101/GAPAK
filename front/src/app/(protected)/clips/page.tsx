"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, MessageCircle, Share2, Bookmark, MoreVertical, 
  Volume2, VolumeX, Play, Pause, Settings, TrendingUp,
  Clock, Users, Flame, ChevronUp, ChevronDown
} from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { postService } from "@/shared/api/services/post.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { useMediaUrl } from "@/shared/lib/hooks/use-media-url";
import type { PostResponse } from "@/shared/types/post";

// Premium Clips Page with vertical swipe navigation
export default function ClipsPage() {
  const { data: clipsData, isLoading, isError, error, reload } = useAsyncResource(
    () => postService.getClips({ page: 1, limit: 20 }), 
    []
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activeTab, setActiveTab] = useState<"trending" | "following" | "latest">("trending");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const clips = clipsData || [];
  const currentClip = clips[currentIndex];
  
  // Get media URL for current clip
  const mediaFileId = currentClip?.mediaFileIds?.[0] || currentClip?.mediaFileIDs?.[0];
  const videoUrl = useMediaUrl(mediaFileId || null, "clip-playback");

  // Show error if no video URL is available
  const hasVideo = videoUrl.url && !videoUrl.error && !videoUrl.loading;

  // Auto-play current clip
  useEffect(() => {
    if (currentClip && videoRefs.current[currentIndex]) {
      videoRefs.current[currentIndex]?.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentIndex, currentClip]);

  // Pause other videos
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (index !== currentIndex && video) {
        video.pause();
      }
    });
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const direction = e.key === "ArrowUp" ? -1 : 1;
        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < clips.length) {
          setCurrentIndex(newIndex);
        }
      }
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "m" || e.key === "M") {
        setIsMuted(!isMuted);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, clips.length, isMuted]);

  const togglePlay = useCallback(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (currentVideo) {
      if (isPlaying) {
        currentVideo.pause();
      } else {
        currentVideo.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [currentIndex, isPlaying]);

  const handleNext = useCallback(() => {
    if (currentIndex < clips.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, clips.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleLike = useCallback(() => {
    // API call to like clip
    console.log("Like clip:", currentClip?.id);
  }, [currentClip]);

  const handleShare = useCallback(() => {
    setShowShare(true);
  }, []);

  const handleBookmark = useCallback(() => {
    // API call to bookmark clip
    console.log("Bookmark clip:", currentClip?.id);
  }, [currentClip]);

  // Touch swipe handling
  const touchStartRef = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientY;
    const diff = touchStartRef.current - touchEnd;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrevious();
      }
    }
  };

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Clips unavailable</h2>
          <p className="text-muted-foreground mb-4">{error?.message ?? "Try again."}</p>
          <Button onClick={() => void reload()}>Retry</Button>
        </Card>
      </div>
    );
  }

  if (isLoading || !clips.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading clips...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar - Navigation */}
      <div className="hidden lg:flex flex-col w-64 bg-slate-900/50 backdrop-blur-xl border-r border-white/10 p-4">
        <h1 className="text-2xl font-bold text-white mb-8">Clips</h1>
        
        <nav className="space-y-2">
          <Button
            variant={activeTab === "trending" ? "default" : "ghost"}
            className="w-full justify-start gap-3"
            onClick={() => setActiveTab("trending")}
          >
            <Flame className="w-5 h-5" />
            Trending
          </Button>
          <Button
            variant={activeTab === "following" ? "default" : "ghost"}
            className="w-full justify-start gap-3"
            onClick={() => setActiveTab("following")}
          >
            <Users className="w-5 h-5" />
            Following
          </Button>
          <Button
            variant={activeTab === "latest" ? "default" : "ghost"}
            className="w-full justify-start gap-3"
            onClick={() => setActiveTab("latest")}
          >
            <Clock className="w-5 h-5" />
            Latest
          </Button>
        </nav>

        <div className="mt-auto">
          <Button variant="outline" className="w-full">
            Create Clip
          </Button>
        </div>
      </div>

      {/* Main Content - Vertical Swipe */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="popLayout">
          {clips.map((clip, index) => (
            <motion.div
              key={clip.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: index === currentIndex ? 1 : 0,
                scale: index === currentIndex ? 1 : 0.95,
                y: index === currentIndex ? 0 : index < currentIndex ? -100 : 100,
              }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              className={`absolute inset-0 ${index === currentIndex ? "z-10" : "z-0"}`}
            >
              <div className="relative w-full h-full bg-slate-900">
                {/* Video */}
                {hasVideo ? (
                  <video
                    ref={(el) => {
                      videoRefs.current[index] = el;
                    }}
                    src={index === currentIndex ? videoUrl.url || "" : ""}
                    poster={index === currentIndex ? videoUrl.url || "" : ""}
                    className="w-full h-full object-cover"
                    muted={isMuted}
                    loop
                    playsInline
                    onClick={togglePlay}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900">
                    <div className="text-center">
                      {videoUrl.loading ? (
                        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      ) : (
                        <>
                          <p className="text-white text-lg mb-2">Video unavailable</p>
                          <p className="text-white/60 text-sm">
                            {videoUrl.error || "No media file attached"}
                          </p>
                          {!mediaFileId && currentClip && (
                            <p className="text-white/40 text-xs mt-2">
                              Post ID: {currentClip.id}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

                {/* Controls overlay */}
                {showControls && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
                      onClick={togglePlay}
                    >
                      {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                    </Button>
                  </div>
                )}

                {/* Right side - Actions */}
                <div className="absolute right-4 bottom-24 flex flex-col gap-6 z-20">
                  <div className="flex flex-col items-center gap-1">
                    <Avatar className="w-12 h-12 border-2 border-white">
                      <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white">
                        {currentClip?.authorId.slice(0, 2).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center">
                      <span className="text-white text-xs">+</span>
                    </div>
                  </div>

                  <button
                    onClick={handleLike}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <Heart className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-white text-xs font-medium">
                      {(currentClip?.likeCount || 0).toLocaleString()}
                    </span>
                  </button>

                  <button
                    onClick={() => setShowComments(true)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-white text-xs font-medium">
                      {(currentClip?.commentCount || 0).toLocaleString()}
                    </span>
                  </button>

                  <button
                    onClick={handleBookmark}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <Bookmark className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-white text-xs font-medium">Save</span>
                  </button>

                  <button
                    onClick={handleShare}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <Share2 className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-white text-xs font-medium">
                      Share
                    </span>
                  </button>

                  <button className="flex flex-col items-center gap-1 group">
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <MoreVertical className="w-6 h-6 text-white" />
                    </div>
                  </button>
                </div>

                {/* Bottom - Info */}
                <div className="absolute left-4 right-20 bottom-8 z-20">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-10 h-10 border-2 border-white">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-sm">
                        {currentClip?.authorId.slice(0, 2).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">
                          @{currentClip?.authorId.slice(0, 8) || "user"}
                        </span>
                      </div>
                      <span className="text-white/70 text-sm">
                        Posted {currentClip?.publishedAt ? new Date(currentClip.publishedAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <Button size="sm" className="bg-white text-black hover:bg-white/90">
                      Follow
                    </Button>
                  </div>

                  <p className="text-white mb-3 line-clamp-2">
                    {currentClip?.body || ""}
                  </p>

                  <div className="flex items-center gap-4 mt-3 text-white/70 text-sm">
                    <span>{currentClip?.likeCount || 0} likes</span>
                    <span>•</span>
                    <span>{currentClip?.commentCount || 0} comments</span>
                  </div>
                </div>

                {/* Top - Navigation */}
                <div className="absolute top-4 left-4 right-4 flex justify-between z-20">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="bg-black/20 backdrop-blur-sm text-white hover:bg-black/30"
                      onClick={() => setIsMuted(!isMuted)}
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="bg-black/20 backdrop-blur-sm text-white hover:bg-black/30"
                      onClick={() => setShowSettings(!showSettings)}
                    >
                      <Settings className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="bg-black/20 backdrop-blur-sm text-white hover:bg-black/30"
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                    >
                      <ChevronUp className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="bg-black/20 backdrop-blur-sm text-white hover:bg-black/30"
                      onClick={handleNext}
                      disabled={currentIndex === clips.length - 1}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Progress indicator */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
                  <div 
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / clips.length) * 100}%` }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Settings panel */}
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="absolute top-4 right-4 z-30 bg-slate-900/95 backdrop-blur-xl rounded-2xl p-4 border border-white/10 w-64"
          >
            <h3 className="text-white font-semibold mb-4">Playback Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-white/70 text-sm mb-2 block">Playback Speed</label>
                <div className="flex gap-2">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                    <Button
                      key={speed}
                      variant={playbackSpeed === speed ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPlaybackSpeed(speed)}
                    >
                      {speed}x
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Autoplay</span>
                <Button variant="outline" size="sm">On</Button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Loop</span>
                <Button variant="outline" size="sm">On</Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Mobile bottom navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 p-4 z-30">
        <div className="flex justify-around">
          <Button
            variant={activeTab === "trending" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("trending")}
          >
            <Flame className="w-4 h-4" />
          </Button>
          <Button
            variant={activeTab === "following" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("following")}
          >
            <Users className="w-4 h-4" />
          </Button>
          <Button
            variant={activeTab === "latest" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("latest")}
          >
            <Clock className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Add Music icon import
function Music({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

