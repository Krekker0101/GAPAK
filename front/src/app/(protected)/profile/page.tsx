"use client";

import Link from "next/link";
import { Bookmark, Eye, Fingerprint, Heart, LockKeyhole, MessageCircle, Repeat2, SquarePen } from "lucide-react";
import { useMemo } from "react";

import { MetricCard } from "@/components/common/metric-card";
import { PageHeader } from "@/components/common/page-header";
import { StateCard } from "@/components/common/state-card";
import { postService } from "@/shared/api/services/post.service";
import { presenceService } from "@/shared/api/services/presence.service";
import { userService } from "@/shared/api/services/user.service";
import { useActivityStore } from "@/shared/lib/activity-store";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { useMediaUrl } from "@/shared/lib/hooks/use-media-url";
import { formatRelativeTime, toSentenceCase } from "@/shared/lib/utils";
import type { PostResponse } from "@/shared/types/post";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export default function ProfilePage() {
  const { data, isLoading, isError, error, reload } = useAsyncResource(async () => {
    const [profile, presence, posts] = await Promise.all([
      userService.getMe(),
      presenceService.me(),
      postService.getFeed({ page: 1, limit: 20 }),
    ]);

    return {
      profile,
      presence,
      posts,
    };
  }, []);

  const activity = useActivityStore();
  const avatar = useMediaUrl(data?.profile.avatarFileId ?? null, "profile-avatar");
  const presenceVariant =
    data?.presence.state === "ONLINE"
      ? "success"
      : data?.presence.state === "IDLE"
        ? "trusted"
        : data?.presence.state === "HIDDEN"
          ? "danger"
          : "default";

  const postMap = useMemo(() => {
    const posts = data?.posts ?? [];

    return new Map<string, PostResponse>(posts.map((post) => [post.id, post]));
  }, [data?.posts]);

  const savedPosts = activity.savedPostIds
    .map((postId) => postMap.get(postId))
    .filter((post): post is PostResponse => Boolean(post));
  const repostedPosts = activity.repostedPostIds
    .map((postId) => postMap.get(postId))
    .filter((post): post is PostResponse => Boolean(post));
  const likedPosts = activity.likedPostIds
    .map((postId) => postMap.get(postId))
    .filter((post): post is PostResponse => Boolean(post));
  const recentComments = Object.entries(activity.commentsByPostId)
    .flatMap(([postId, comments]) =>
      comments.map((comment) => ({
        postId,
        text: comment.text,
        createdAt: comment.createdAt,
      })),
    )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 4);

  const totalComments = Object.values(activity.commentsByPostId).reduce((sum, entries) => sum + entries.length, 0);

  if (isError) {
    return (
      <StateCard
        title="Unable to load profile"
        description={error?.message ?? "Profile request failed."}
        variant="error"
        action={
          <Button onClick={() => void reload()} variant="outline">
            Retry
          </Button>
        }
      />
    );
  }

  if (isLoading || !data) {
    return <StateCard title="Loading profile" description="Restoring your identity layer and privacy settings." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Profile"
        title={data.profile.displayName}
        description="Your backend profile is still the source of truth, and the browser keeps your local feed actions synced for a richer profile view."
        actions={
          <Button asChild>
            <Link href="/profile/edit">
              <SquarePen className="h-4 w-4" />
              Edit profile
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-5">
              <Avatar className="h-24 w-24 rounded-[2rem] border border-white/10 bg-black/20">
                {avatar.url ? <AvatarImage src={avatar.url} alt={data.profile.displayName} /> : null}
                <AvatarFallback className="rounded-[2rem] text-xl">
                  {data.profile.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.28em] text-primary">Identity layer</p>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-4xl font-semibold">{data.profile.displayName}</h2>
                    <Badge variant={presenceVariant}>{toSentenceCase(data.presence.state)}</Badge>
                  </div>
                  <p className="mt-2 text-base text-muted-foreground">@{data.profile.username}</p>
                </div>
                <p className="max-w-2xl text-sm leading-8 text-muted-foreground">
                  {data.profile.bio || "No bio yet. Add one to define your current trust-facing identity."}
                </p>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>Last seen: {data.presence.lastSeenAt ? formatRelativeTime(data.presence.lastSeenAt) : "Hidden"}</span>
                  <span>{avatar.loading ? "Refreshing avatar access..." : avatar.error ? "Avatar unavailable" : "Avatar ready"}</span>
                </div>
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-white/8 bg-black/20 px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Status</p>
              <p className="mt-2 font-display text-2xl font-semibold">{data.profile.statusMessage || "Private mode"}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Liked"
              value={String(activity.likedPostIds.length)}
              detail="Stored locally so your likes survive refreshes and device sessions."
              icon={<Heart className="h-5 w-5 text-primary" />}
            />
            <MetricCard
              label="Saved"
              value={String(activity.savedPostIds.length)}
              detail="Saved posts are surfaced here as soon as they exist in the local activity store."
              icon={<Bookmark className="h-5 w-5 text-primary" />}
            />
            <MetricCard
              label="Reposted"
              value={String(activity.repostedPostIds.length)}
              detail="Keep a lightweight repost trail without touching the backend contract."
              icon={<Repeat2 className="h-5 w-5 text-primary" />}
            />
            <MetricCard
              label="Viewed"
              value={String(activity.viewedPostIds.length)}
              detail="Every feed entry you open is marked as viewed and restored on the next visit."
              icon={<Eye className="h-5 w-5 text-primary" />}
            />
            <MetricCard
              label="Comments"
              value={String(totalComments)}
              detail="Private comments are kept locally and shown in the profile activity panel."
              icon={<MessageCircle className="h-5 w-5 text-primary" />}
            />
            <MetricCard
              label="Anonymous mode"
              value={data.profile.isAnonymous ? "On" : "Off"}
              detail="Matches the backend auth and users response shape."
              icon={<Fingerprint className="h-5 w-5 text-primary" />}
            />
            <MetricCard
              label="Two-factor auth"
              value={data.profile.twoFactorEnabled ? "Enabled" : "Disabled"}
              detail="Activate 2FA to strengthen trust-room and session posture."
              icon={<LockKeyhole className="h-5 w-5 text-primary" />}
            />
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Activity map</p>
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.25rem] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Saved posts</p>
                  <p className="mt-1 text-sm text-muted-foreground">{savedPosts.length} entries stored locally</p>
                </div>
                <Bookmark className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-3 space-y-2">
                {savedPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Save a post from the feed to see it here.</p>
                ) : (
                  savedPosts.map((post) => (
                    <div key={post.id} className="rounded-[1rem] border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-sm font-medium text-foreground">{post.body.slice(0, 90)}{post.body.length > 90 ? "..." : ""}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{post.contentType} • {formatRelativeTime(post.publishedAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Reposts</p>
                  <p className="mt-1 text-sm text-muted-foreground">{repostedPosts.length} entries stored locally</p>
                </div>
                <Repeat2 className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-3 space-y-2">
                {repostedPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Repost something from the feed to keep a personal recap.</p>
                ) : (
                  repostedPosts.map((post) => (
                    <div key={post.id} className="rounded-[1rem] border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-sm font-medium text-foreground">{post.body.slice(0, 90)}{post.body.length > 90 ? "..." : ""}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{post.contentType} • {formatRelativeTime(post.publishedAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Comments</p>
                  <p className="mt-1 text-sm text-muted-foreground">{totalComments} private notes saved locally</p>
                </div>
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-3 space-y-2">
                {recentComments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Comment on a post from the feed to see them here.</p>
                ) : (
                  recentComments.map((comment) => (
                    <div key={`${comment.postId}-${comment.createdAt}`} className="rounded-[1rem] border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-sm text-foreground">{comment.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Post {comment.postId}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Liked posts</p>
                  <p className="mt-1 text-sm text-muted-foreground">{likedPosts.length} entries stored locally</p>
                </div>
                <Heart className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-3 space-y-2">
                {likedPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Like a post from the feed to see it appear here.</p>
                ) : (
                  likedPosts.map((post) => (
                    <div key={post.id} className="rounded-[1rem] border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-sm font-medium text-foreground">{post.body.slice(0, 90)}{post.body.length > 90 ? "..." : ""}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{post.contentType} • {formatRelativeTime(post.publishedAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <p className="mt-5 text-xs uppercase tracking-[0.24em] text-muted-foreground">Local activity is browser-persisted and shown on this page.</p>
        </Card>
      </div>
    </div>
  );
}
