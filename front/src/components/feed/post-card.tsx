"use client";

import { useMemo, useState } from "react";
import { Clock3, FileText, Heart, LockKeyhole, MessageCircle, ShieldCheck, SendHorizonal, Timer } from "lucide-react";

import { AdaptiveVideoPlayer } from "@/components/feed/adaptive-video-player";
import { postService } from "@/shared/api/services/post.service";
import { formatRelativeTime } from "@/shared/lib/utils";
import type { CommentResponse, PostResponse } from "@/shared/types/post";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

function compactIdentity(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function privacyLabel(privacy: PostResponse["privacy"]) {
  const labels: Record<PostResponse["privacy"], string> = {
    PUBLIC: "Публично",
    FRIENDS: "Друзья",
    TRUSTED_CIRCLE: "Круг доверия",
    PRIVATE: "Приватно",
    ONE_TIME: "Один просмотр",
    TIMED: "По таймеру",
  };

  return labels[privacy];
}

type PostCardProps = {
  post: PostResponse;
  mode?: "feed" | "clip";
  currentUserId?: string;
  currentUserName?: string;
};

export function PostCard({ post, mode = "feed", currentUserId, currentUserName }: PostCardProps) {
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [comments, setComments] = useState<CommentResponse[] | null>(null);
  const [draft, setDraft] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const isOwnPost = currentUserId === post.authorId;
  const authorName = isOwnPost && currentUserName ? currentUserName : `Участник ${compactIdentity(post.authorId)}`;
  const authorHandle = isOwnPost ? "@me" : `@${compactIdentity(post.authorId).replace("…", "")}`;
  const mediaIds = post.mediaFileIds ?? [];
  const expiresAt = post.expiresAt ? new Date(post.expiresAt) : null;

  const accessBadge = useMemo(() => privacyLabel(post.privacy), [post.privacy]);

  async function toggleLike() {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
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
    } finally {
      setIsMutating(false);
    }
  }

  async function openComments() {
    const next = !showComments;
    setShowComments(next);
    if (!next || comments) {
      return;
    }

    setCommentsError(null);
    try {
      setComments(await postService.getComments(post.id, { page: 1, limit: 20, sortBy: "recent" }));
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : "Не удалось загрузить комментарии.");
    }
  }

  async function handleAddComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isMutating) {
      return;
    }

    setIsMutating(true);
    setCommentsError(null);
    try {
      const created = await postService.createComment(post.id, { content });
      setComments((current) => [created, ...(current ?? [])]);
      setCommentCount((current) => current + 1);
      setDraft("");
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : "Не удалось отправить комментарий.");
    } finally {
      setIsMutating(false);
    }
  }

  if (mode === "clip") {
    if (!mediaIds[0]) {
      return null;
    }

    return (
      <Card className="group relative mx-auto w-full max-w-[420px] overflow-hidden p-3 transition-transform duration-500 hover:-translate-y-1">
        <div className="relative overflow-hidden rounded-[1.65rem] bg-black">
          <AdaptiveVideoPlayer mediaId={mediaIds[0]} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-full border border-white/20">
                    <AvatarFallback className="rounded-full bg-white/15 text-xs text-white">{initials(authorName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{authorName}</p>
                    <p className="text-xs text-white/60">{formatRelativeTime(post.publishedAt)}</p>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-white/90">{post.body}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-3">
                <button
                  type="button"
                  aria-label="Like clip"
                  onClick={() => void toggleLike()}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-xl transition hover:bg-white/15"
                >
                  <Heart className={`h-5 w-5 ${liked ? "fill-white" : ""}`} />
                </button>
                <button
                  type="button"
                  aria-label="Comment clip"
                  onClick={() => void openComments()}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-xl transition hover:bg-white/15"
                >
                  <MessageCircle className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="social-card relative overflow-hidden space-y-5 p-5 sm:p-6">
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11 rounded-full border border-white/10">
            <AvatarFallback className="rounded-full bg-[linear-gradient(135deg,rgba(102,244,255,0.28),rgba(138,125,255,0.22))] text-xs text-white">
              {initials(authorName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{authorName}</p>
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs text-muted-foreground">{authorHandle}</p>
            </div>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(post.publishedAt)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
          {post.privacy === "TIMED" ? <Timer className="h-3.5 w-3.5 text-primary" /> : <LockKeyhole className="h-3.5 w-3.5 text-primary" />}
          {accessBadge}
        </div>
      </div>

      <p className="relative whitespace-pre-line text-[15px] leading-7 text-foreground/92">{post.body}</p>

      {mediaIds.length > 0 ? (
        <div className="relative grid gap-3">
          {mediaIds.map((mediaId) => (
            <div key={mediaId} className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20">
              {post.contentType === "CLIP" ? (
                <AdaptiveVideoPlayer mediaId={mediaId} />
              ) : (
                <div className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Защищенное вложение: {compactIdentity(mediaId)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {expiresAt ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
            <Clock3 className="h-3.5 w-3.5" /> Доступ до {expiresAt.toLocaleString("ru-RU")}
          </span>
        ) : null}
      </div>

      <div className="relative flex items-center gap-1 border-t border-white/8 pt-3 text-muted-foreground">
        <button
          type="button"
          onClick={() => void toggleLike()}
          disabled={isMutating}
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm transition hover:bg-white/[0.06] hover:text-foreground disabled:opacity-60"
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-rose-300 text-rose-300" : ""}`} />
          {likeCount}
        </button>
        <button
          type="button"
          onClick={() => void openComments()}
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm transition hover:bg-white/[0.06] hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          {commentCount}
        </button>
      </div>

      {showComments ? (
        <div className="relative rounded-[1.25rem] border border-white/8 bg-white/[0.025] p-4">
          {commentsError ? <p className="mb-3 text-sm text-rose-300">{commentsError}</p> : null}
          <div className="space-y-3">
            {comments?.map((comment) => (
              <div key={comment.id} className="rounded-[1rem] bg-white/[0.04] px-3 py-2">
                <p className="text-xs text-muted-foreground">Участник {compactIdentity(comment.authorId)}</p>
                <p className="text-sm text-foreground">{comment.content}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddComment} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Комментарий"
              className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
            />
            <Button type="submit" size="sm" variant="outline" disabled={isMutating} aria-label="Send comment">
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
