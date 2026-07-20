"use client";

import { useEffect, useMemo, useState, useCallback, memo } from "react";
import { FileText, Heart, MessageCircle, Repeat2, Send } from "lucide-react";
import { AdaptiveVideoPlayer } from "@/components/feed/adaptive-video-player";
import { Tooltip } from "@/shared/ui/tooltip";
import { postService } from "@/shared/api/services/post.service";
import { useMediaUrl } from "@/shared/lib/hooks/use-media-url";
import { formatRelativeTime } from "@/shared/lib/utils";
import type { CommentResponse, PostResponse } from "@/shared/types/post";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function initials(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "GP";
}

function mediaIds(post: PostResponse) {
  return post.mediaFileIds ?? post.mediaFileIDs ?? [];
}

const PostAttachment = memo(function PostAttachment({ mediaId }: { mediaId: string }) {
  const { url, loading } = useMediaUrl(mediaId, "feed-post-attachment");

  if (loading) {
    return <div className="h-56 animate-pulse rounded-2xl bg-white/[0.06]" />;
  }

  if (!url) {
    return null;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-2xl bg-black/20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Post" loading="lazy" className="max-h-[620px] w-full object-cover transition duration-500 group-hover:scale-[1.015]" />
    </a>
  );
});

type PostCardProps = {
  post: PostResponse;
  mode?: "feed" | "clip";
};

export const PostCard = memo(function PostCard({ post, mode = "feed" }: PostCardProps) {
  const [liked, setLiked] = useState(Boolean(post.isLiked));
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const attachments = useMemo(() => mediaIds(post), [post]);

  useEffect(() => {
    setLiked(Boolean(post.isLiked));
    setLikeCount(post.likeCount ?? 0);
  }, [post.id, post.isLiked, post.likeCount]);

  useEffect(() => {
    if (!showComments) return;
    let cancelled = false;
    void postService
      .getComments(post.id, { page: 1, limit: 20, sortBy: "recent" })
      .then((items) => {
        if (!cancelled) setComments(items);
      });
    return () => {
      cancelled = true;
    };
  }, [post.id, showComments]);

  const handleToggleLike = useCallback(async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((current) => Math.max(0, current + (nextLiked ? 1 : -1)));
    try {
      if (nextLiked) {
        await postService.like(post.id);
      } else {
        await postService.unlike(post.id);
      }
    } catch {
      setLiked(!nextLiked);
      setLikeCount((current) => Math.max(0, current + (nextLiked ? -1 : 1)));
    }
  }, [liked, post.id]);

  const handleAddComment = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    try {
      const created = await postService.createComment(post.id, { content });
      setComments((current) => [created, ...current]);
      setDraft("");
    } catch {
      // ignore
    }
  }, [draft, post.id]);

  const handleToggleComments = useCallback(() => {
    setShowComments((current) => !current);
  }, []);

  if (mode === "clip") {
    return (
      <Card className="group relative mx-auto w-full max-w-[420px] overflow-hidden p-3 transition-transform duration-500 hover:-translate-y-1">
        <div className="relative overflow-hidden rounded-2xl bg-black">
          {attachments[0] ? <AdaptiveVideoPlayer mediaId={attachments[0]} /> : <div className="aspect-[9/16] bg-black" />}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-9 w-9 rounded-full border border-white/20">
                    <AvatarFallback className="rounded-full bg-white/15 text-xs">{initials(post.authorId)}</AvatarFallback>
                  </Avatar>
                  <p className="truncate text-xs font-semibold text-white">{shortId(post.authorId)}</p>
                </div>
                <p className="line-clamp-2 text-xs leading-5 text-white/80">{post.body}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <button
                  type="button"
                  aria-label="Like"
                  onClick={() => void handleToggleLike()}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-xl transition hover:bg-white/10"
                >
                  <Heart className={`h-4 w-4 ${liked ? "fill-rose-300 text-rose-300" : ""}`} />
                </button>
                <button
                  type="button"
                  aria-label="Comment"
                  onClick={() => setShowComments((current) => !current)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-xl transition hover:bg-white/10"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="social-card relative space-y-4 overflow-hidden p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11 rounded-full border border-primary/20">
            <AvatarFallback className="text-xs font-semibold">{initials(post.authorId)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{shortId(post.authorId)}</p>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(post.publishedAt)}</p>
          </div>
        </div>
      </div>

      <p className="relative text-sm leading-6 text-foreground/90">{post.body}</p>

      {attachments.length > 0 && (
        <div className="relative grid gap-3">
          {post.contentType === "CLIP" ? <AdaptiveVideoPlayer mediaId={attachments[0]} /> : attachments.map((mediaId) => <PostAttachment key={mediaId} mediaId={mediaId} />)}
        </div>
      )}

      <div className="relative flex items-center gap-1 border-t border-white/8 pt-3">
        <Tooltip content={liked ? "Unlike" : "Like"} side="top" delay={150}>
          <button
            type="button"
            onClick={() => void handleToggleLike()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/[0.06] hover:text-foreground"
          >
            <Heart className={`h-5 w-5 ${liked ? "fill-rose-300 text-rose-300" : ""}`} />
          </button>
        </Tooltip>
        <Tooltip content="Comments" side="top" delay={150}>
          <button
            type="button"
            onClick={handleToggleComments}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/[0.06] hover:text-foreground"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </Tooltip>
        <Tooltip content="Repost" side="top" delay={150}>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/[0.06] hover:text-foreground">
            <Repeat2 className="h-5 w-5" />
          </button>
        </Tooltip>
      </div>

      {showComments && (
        <div className="relative rounded-xl border border-white/8 bg-white/[0.025] p-3">
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-lg bg-white/[0.04] px-2 py-1.5">
                  <p className="text-xs text-muted-foreground">{shortId(comment.authorId)} · {formatRelativeTime(comment.createdAt)}</p>
                  <p className="text-xs text-foreground">{comment.content}</p>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleAddComment} className="mt-3 flex gap-2">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Comment…" className="flex-1 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-foreground outline-none transition focus:border-primary/50" />
            <Tooltip content="Send comment" side="top" delay={150}>
              <Button type="submit" size="sm" variant="outline" className="h-8 w-8 p-0 rounded-full">
                <Send className="h-3 w-3" />
              </Button>
            </Tooltip>
          </form>
        </div>
      )}
    </Card>
  );
});
