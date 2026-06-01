"use client";

import { useEffect, useMemo, useState } from "react";
import { Wifi } from "lucide-react";

import { mediaService } from "@/shared/api/services/media.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { Badge } from "@/shared/ui/badge";

function preferredQuality(labels: string[]) {
  if (typeof navigator === "undefined") {
    return labels.at(-1) ?? null;
  }
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } }).connection;
  const effectiveType = connection?.effectiveType ?? "4g";
  const downlink = connection?.downlink ?? 10;
  const preference =
    effectiveType.includes("2g") || downlink < 0.8
      ? ["240p", "360p"]
      : effectiveType === "3g" || downlink < 2.5
        ? ["360p", "480p"]
        : downlink < 6
          ? ["720p", "480p"]
          : ["1080p", "720p", "480p"];

  return preference.find((label) => labels.includes(label)) ?? labels.at(-1) ?? null;
}

export function AdaptiveVideoPlayer({ mediaId }: { mediaId: string }) {
  const [canUseHls, setCanUseHls] = useState(false);
  const resource = useAsyncResource(async () => {
    const [asset, grant] = await Promise.all([
      mediaService.getAsset(mediaId),
      mediaService.createPlaybackGrant(mediaId, "clip-playback"),
    ]);
    return { asset, grant };
  }, [mediaId]);

  useEffect(() => {
    const probe = document.createElement("video");
    setCanUseHls(Boolean(probe.canPlayType("application/vnd.apple.mpegurl")));
  }, []);

  const playback = useMemo(() => {
    const grant = resource.data?.grant;
    if (!grant) {
      return null;
    }
    const variants = grant.variantRequests ?? {};
    const labels = Object.keys(variants);
    const selected = preferredQuality(labels);
    if (selected && variants[selected] && !variants[selected].url.includes(".m3u8")) {
      return { url: variants[selected].url, label: selected };
    }
    if (canUseHls && grant.adaptiveRequest?.url) {
      return { url: grant.adaptiveRequest.url, label: "auto" };
    }
    return { url: grant.request.url, label: "original" };
  }, [canUseHls, resource.data?.grant]);

  if (resource.isError) {
    return (
      <div className="flex aspect-[9/16] items-center justify-center rounded-2xl bg-black/30 px-4 text-center text-sm text-muted-foreground">
        Видео временно недоступно
      </div>
    );
  }

  if (resource.isLoading || !playback) {
    return (
      <div className="flex aspect-[9/16] items-center justify-center rounded-2xl bg-black/30 text-sm text-muted-foreground">
        Видео готовится...
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
      <video className="aspect-[9/16] w-full object-cover" src={playback.url} controls playsInline preload="metadata" />
      <div className="absolute left-3 top-3">
        <Badge variant="primary" className="gap-1 bg-black/50 backdrop-blur">
          <Wifi className="h-3.5 w-3.5" />
          {playback.label}
        </Badge>
      </div>
    </div>
  );
}
