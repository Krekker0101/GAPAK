"use client";

import { useEffect, useState } from "react";
import { Bookmark, Clapperboard, Eye, Heart, Lock, MessageCircle, Repeat2, SendHorizonal, Timer, UsersRound } from "lucide-react";

import { AdaptiveVideoPlayer } from "@/components/feed/adaptive-video-player";
import { useActivityStore } from "@/shared/lib/activity-store";
import { formatDateTime, formatRelativeTime } from "@/shared/lib/utils";
import type { PostResponse } from "@/shared/types/post";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

const privacyMeta: Record<PostResponse["privacy"], { label: string; variant: "default" | "primary" | "trusted" | "danger" }> = {
  PUBLIC: { label: "Public", variant: "default" },
  FRIENDS: { label: "Friends", variant: "primary" },
  TRUSTED_CIRCLE: { label: "Trusted Circle", variant: "trusted" },
  PRIVATE: { label: "Private", variant: "danger" },
  ONE_TIME: { label: "One-Time", variant: "trusted" },
  TIMED: { label: "Timed", variant: "primary" },
};

export function PostCard({ post }: { post: PostResponse }) {
  const meta = privacyMeta[post.privacy];
  const { likedPostIds, savedPostIds, repostedPostIds, commentsByPostId, toggleLike, toggleSave, toggleRepost, addComment, markViewed } =
    useActivityStore();
  const [draft, setDraft] = useState("");
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    markViewed(post.id);
  }, [markViewed, post.id]);

  const liked = likedPostIds.includes(post.id);
  const saved = savedPostIds.includes(post.id);
  const reposted = repostedPostIds.includes(post.id);
  const comments = commentsByPostId[post.id] ?? [];

  const handleAddComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }

    addComment(post.id, draft);
    setDraft("");
    setShowComments(true);
  };

  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {post.contentType === "CLIP" ? (
              <Badge variant="primary" className="gap-1">
                <Clapperboard className="h-3.5 w-3.5" />
                Клипс
              </Badge>
            ) : null}
            <Badge variant={meta.variant}>{meta.label}</Badge>
            {post.oneTimeViewLimit ? (
              <Badge variant="default" className="gap-1">
                <Eye className="h-3.5 w-3.5" />
                {post.oneTimeViewLimit} views
              </Badge>
            ) : null}
            {post.expiresAt ? (
              <Badge variant="default" className="gap-1">
                <Timer className="h-3.5 w-3.5" />
                Expires {formatRelativeTime(post.expiresAt)}
              </Badge>
            ) : null}
            {liked ? <Badge variant="primary">Liked</Badge> : null}
            {saved ? <Badge variant="trusted">Saved</Badge> : null}
            {reposted ? <Badge variant="default">Reposted</Badge> : null}
          </div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Author {post.authorId}</p>
        </div>
        <p className="text-sm text-muted-foreground">{formatRelativeTime(post.publishedAt)}</p>
      </div>
      {post.contentType === "CLIP" && post.mediaFileIds?.[0] ? (
        <div className="mx-auto w-full max-w-sm">
          <AdaptiveVideoPlayer mediaId={post.mediaFileIds[0]} />
        </div>
      ) : null}
      <p className="text-sm leading-8 text-foreground/95">{post.body}</p>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          Published {formatDateTime(post.publishedAt)}
        </span>
        <span className="inline-flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-primary" />
          Audience IDs {post.audienceUserIds?.length ?? 0}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/8 pt-4">
        <Button type="button" size="sm" variant={liked ? "secondary" : "outline"} onClick={() => toggleLike(post.id)}>
          <Heart className={`h-4 w-4 ${liked ? "fill-current text-rose-300" : ""}`} />
          {liked ? "Liked" : "Like"}
        </Button>
        <Button type="button" size="sm" variant={saved ? "secondary" : "outline"} onClick={() => toggleSave(post.id)}>
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current text-cyan-200" : ""}`} />
          {saved ? "Saved" : "Save"}
        </Button>
        <Button type="button" size="sm" variant={reposted ? "secondary" : "outline"} onClick={() => toggleRepost(post.id)}>
          <Repeat2 className="h-4 w-4" />
          {reposted ? "Reposted" : "Repost"}
        </Button>
        <Button type="button" size="sm" variant={showComments ? "secondary" : "outline"} onClick={() => setShowComments((current) => !current)}>
          <MessageCircle className="h-4 w-4" />
          {showComments ? "Hide comments" : `Comments ${comments.length}`}
        </Button>
      </div>

      {showComments ? (
        <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.02] p-4">
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet. Add the first one to keep the thread alive.</p>
            ) : (
              comments
                .slice()
                .reverse()
                .map((comment) => (
                  <div key={comment.id} className="rounded-[1rem] border border-white/8 bg-black/10 px-3 py-2">
                    <p className="text-sm text-foreground">{comment.text}</p>
                  </div>
                ))
            )}
          </div>

          <form onSubmit={handleAddComment} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add a private comment"
              className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
            />
            <Button type="submit" size="sm">
              <SendHorizonal className="h-4 w-4" />
              Send
            </Button>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
