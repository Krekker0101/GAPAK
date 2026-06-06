"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, MessageCircle, Repeat2, SendHorizonal } from "lucide-react";

import { AdaptiveVideoPlayer } from "@/components/feed/adaptive-video-player";
import { useActivityStore } from "@/shared/lib/activity-store";
import { formatRelativeTime } from "@/shared/lib/utils";
import type { PostResponse } from "@/shared/types/post";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

const authors = [
  { name: "Mira Chen", username: "@mira" },
  { name: "Alex Morgan", username: "@alex" },
  { name: "Noah Kim", username: "@noah" },
  { name: "Sofia Ray", username: "@sofia" },
];

function getAuthor(authorId: string) {
  const index = Math.abs(
    authorId.split("").reduce((total, char) => total + char.charCodeAt(0), 0),
  ) % authors.length;

  return authors[index];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type PostCardProps = {
  post: PostResponse;
  mode?: "feed" | "clip";
};

export function PostCard({ post, mode = "feed" }: PostCardProps) {
  const { likedPostIds, repostedPostIds, commentsByPostId, toggleLike, toggleRepost, addComment, markViewed } = useActivityStore();
  const [draft, setDraft] = useState("");
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    markViewed(post.id);
  }, [markViewed, post.id]);

  const author = useMemo(() => getAuthor(post.authorId), [post.authorId]);
  const liked = likedPostIds.includes(post.id);
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

  if (mode === "clip") {
    return (
      <Card className="group relative mx-auto w-full max-w-[420px] overflow-hidden p-3 transition-transform duration-500 hover:-translate-y-1">
        <div className="relative overflow-hidden rounded-[1.65rem] bg-black">
          {post.mediaFileIds?.[0] ? (
            <AdaptiveVideoPlayer mediaId={post.mediaFileIds[0]} />
          ) : (
            <div className="aspect-[9/16] bg-[radial-gradient(circle_at_30%_20%,rgba(138,125,255,0.22),transparent_28%),linear-gradient(180deg,#111827,#030712)]" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-full border border-white/20">
                    <AvatarFallback className="rounded-full bg-white/15 text-xs text-white">{initials(author.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{author.name}</p>
                    <p className="text-xs text-white/60">{formatRelativeTime(post.publishedAt)}</p>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-white/90">{post.body}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-3">
                <button
                  type="button"
                  aria-label="Like clip"
                  onClick={() => toggleLike(post.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-xl transition hover:bg-white/15"
                >
                  <Heart className={`h-5 w-5 ${liked ? "fill-white" : ""}`} />
                </button>
                <button
                  type="button"
                  aria-label="Comment clip"
                  onClick={() => setShowComments((current) => !current)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-xl transition hover:bg-white/15"
                >
                  <MessageCircle className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Repost clip"
                  onClick={() => toggleRepost(post.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-xl transition hover:bg-white/15"
                >
                  <Repeat2 className={`h-5 w-5 ${reposted ? "text-cyan-200" : ""}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11 rounded-full border border-white/10">
            <AvatarFallback className="rounded-full bg-white/10 text-xs text-white">{initials(author.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{author.name}</p>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">{author.username}</p>
            </div>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(post.publishedAt)}</p>
          </div>
        </div>
      </div>

      {post.contentType === "CLIP" && post.mediaFileIds?.[0] ? (
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[1.75rem]">
          <AdaptiveVideoPlayer mediaId={post.mediaFileIds[0]} />
        </div>
      ) : null}

      <p className="whitespace-pre-line text-[15px] leading-7 text-foreground/92">{post.body}</p>

      <div className="flex items-center gap-1 border-t border-white/8 pt-3 text-muted-foreground">
        <button
          type="button"
          onClick={() => toggleLike(post.id)}
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm transition hover:bg-white/[0.06] hover:text-foreground"
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-rose-300 text-rose-300" : ""}`} />
          {liked ? "Нравится" : "Лайк"}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((current) => !current)}
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm transition hover:bg-white/[0.06] hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          {comments.length}
        </button>
        <button
          type="button"
          onClick={() => toggleRepost(post.id)}
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm transition hover:bg-white/[0.06] hover:text-foreground"
        >
          <Repeat2 className={`h-4 w-4 ${reposted ? "text-cyan-200" : ""}`} />
          Репост
        </button>
      </div>

      {showComments ? (
        <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.025] p-4">
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет комментариев.</p>
            ) : (
              comments
                .slice()
                .reverse()
                .map((comment) => (
                  <div key={comment.id} className="rounded-[1rem] bg-white/[0.04] px-3 py-2">
                    <p className="text-sm text-foreground">{comment.text}</p>
                  </div>
                ))
            )}
          </div>

          <form onSubmit={handleAddComment} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Комментарий"
              className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
            />
            <Button type="submit" size="sm" variant="outline" aria-label="Send comment">
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
