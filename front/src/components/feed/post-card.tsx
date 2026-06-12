"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, FileText, Heart, MapPin, MessageCircle, SendHorizonal, ShieldCheck, Timer, Verified } from "lucide-react";

import { AdaptiveVideoPlayer } from "@/components/feed/adaptive-video-player";
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

function PostAttachment({ mediaId }: { mediaId: string }) {
  const { url, loading, error } = useMediaUrl(mediaId, "feed-post-attachment");

  if (loading) {
    return <div className="h-56 animate-pulse rounded-[1.5rem] bg-white/[0.06]" />;
  }

  if (error || !url) {
    return (
      <div className="flex items-center gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">
        <FileText className="h-5 w-5 text-primary" />
        <span>Файл #{shortId(mediaId)} доступен через защищённый backend media API.</span>
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Post attachment" loading="lazy" className="max-h-[620px] w-full object-cover transition duration-500 group-hover:scale-[1.015]" />
    </a>
  );
}

type PostCardProps = {
  post: PostResponse;
  mode?: "feed" | "clip";
};

export function PostCard({ post, mode = "feed" }: PostCardProps) {
  const [liked, setLiked] = useState(Boolean(post.isLiked));
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const attachments = useMemo(() => mediaIds(post), [post]);
  const authorLabel = `user:${shortId(post.authorId)}`;

  useEffect(() => {
    setLiked(Boolean(post.isLiked));
    setLikeCount(post.likeCount ?? 0);
    setCommentCount(post.commentCount ?? 0);
  }, [post.id, post.isLiked, post.likeCount, post.commentCount]);

  useEffect(() => {
    if (!showComments) {
      return;
    }

    let cancelled = false;
    setCommentsLoading(true);
    void postService
      .getComments(post.id, { page: 1, limit: 20, sortBy: "recent" })
      .then((items) => {
        if (!cancelled) {
          setComments(items);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setActionError(error instanceof Error ? error.message : "Не удалось загрузить комментарии");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommentsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [post.id, showComments]);

  const handleToggleLike = async () => {
    setActionError(null);
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((current) => Math.max(0, current + (nextLiked ? 1 : -1)));
    try {
      if (nextLiked) {
        await postService.like(post.id);
      } else {
        await postService.unlike(post.id);
      }
    } catch (error) {
      setLiked(!nextLiked);
      setLikeCount((current) => Math.max(0, current + (nextLiked ? -1 : 1)));
      setActionError(error instanceof Error ? error.message : "Действие не выполнено");
    }
  };

  const handleAddComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) {
      return;
    }

    setActionError(null);
    try {
      const created = await postService.createComment(post.id, { content });
      setComments((current) => [created, ...current]);
      setCommentCount((current) => current + 1);
      setDraft("");
      setShowComments(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Комментарий не отправлен");
    }
  };

  if (mode === "clip") {
    return (
      <Card className="group relative mx-auto w-full max-w-[420px] overflow-hidden p-3 transition-transform duration-500 hover:-translate-y-1">
        <div className="relative overflow-hidden rounded-[1.65rem] bg-black">
          {attachments[0] ? <AdaptiveVideoPlayer mediaId={attachments[0]} /> : <div className="aspect-[9/16] bg-black" />}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-full border border-white/20">
                    <AvatarFallback className="rounded-full bg-white/15 text-xs text-white">{initials(authorLabel)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{authorLabel}</p>
                    <p className="text-xs text-white/60">{formatRelativeTime(post.publishedAt)}</p>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-white/90">{post.body}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-3">
                <button type="button" aria-label="Like clip" onClick={() => void handleToggleLike()} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-xl transition hover:bg-white/15">
                  <Heart className={`h-5 w-5 ${liked ? "fill-white" : ""}`} />
                </button>
                <button type="button" aria-label="Comment clip" onClick={() => setShowComments((current) => !current)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-xl transition hover:bg-white/15">
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
    <Card className="social-card relative space-y-5 overflow-hidden p-5 sm:p-6">
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-12 w-12 rounded-full border border-primary/25 shadow-[0_0_30px_rgba(102,244,255,0.14)]">
            <AvatarFallback className="rounded-full bg-[linear-gradient(135deg,rgba(102,244,255,0.22),rgba(138,125,255,0.24))] text-xs text-white">{initials(authorLabel)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{authorLabel}</p>
              <Verified className="h-4 w-4 text-primary" aria-label="Backend verified author id" />
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[11px] text-emerald-100">Trust API</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              <span>{formatRelativeTime(post.publishedAt)}</span>
              {post.expiresAt ? (
                <>
                  <Timer className="h-3.5 w-3.5 text-amber-200" />
                  <span>Доступ до {formatRelativeTime(post.expiresAt)}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground sm:flex sm:items-center sm:gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          {post.privacy}
        </div>
      </div>

      <p className="relative whitespace-pre-line text-[15px] leading-7 text-foreground/92">{post.body}</p>

      {attachments.length > 0 ? (
        <div className="relative grid gap-3">
          {post.contentType === "CLIP" ? <AdaptiveVideoPlayer mediaId={attachments[0]} /> : attachments.map((mediaId) => <PostAttachment key={mediaId} mediaId={mediaId} />)}
        </div>
      ) : null}

      {post.audienceUserIds?.length ? (
        <div className="relative flex items-center gap-2 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-3 text-xs text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          Индивидуальная аудитория из backend API: {post.audienceUserIds.length}
        </div>
      ) : null}

      {actionError ? <p className="relative rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{actionError}</p> : null}

      <div className="relative flex flex-wrap items-center gap-1 border-t border-white/8 pt-3 text-muted-foreground">
        <button type="button" onClick={() => void handleToggleLike()} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm transition hover:bg-white/[0.06] hover:text-foreground">
          <Heart className={`h-4 w-4 ${liked ? "fill-rose-300 text-rose-300" : ""}`} />
          {likeCount}
        </button>
        <button type="button" onClick={() => setShowComments((current) => !current)} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm transition hover:bg-white/[0.06] hover:text-foreground">
          <MessageCircle className="h-4 w-4" />
          {commentCount}
        </button>
      </div>

      {showComments ? (
        <div className="relative rounded-[1.25rem] border border-white/8 bg-white/[0.025] p-4">
          <div className="space-y-3">
            {commentsLoading ? <p className="text-sm text-muted-foreground">Загружаем комментарии через API…</p> : null}
            {!commentsLoading && comments.length === 0 ? <p className="text-sm text-muted-foreground">Комментариев в backend пока нет.</p> : null}
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-[1rem] bg-white/[0.04] px-3 py-2">
                <p className="text-xs text-muted-foreground">user:{shortId(comment.authorId)} · {formatRelativeTime(comment.createdAt)}</p>
                <p className="mt-1 text-sm text-foreground">{comment.content}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddComment} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Комментарий через Backend API" className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-foreground outline-none transition focus:border-primary/50" />
            <Button type="submit" size="sm" variant="outline" aria-label="Send comment">
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
