"use client";

import { useEffect, useState } from "react";

import { mediaService } from "@/shared/api/services/media.service";

type MediaUrlState = {
  url: string | null;
  loading: boolean;
  error: string | null;
};

export function useMediaUrl(mediaFileId: string | null | undefined, reason: string) {
  const [state, setState] = useState<MediaUrlState>({
    url: null,
    loading: Boolean(mediaFileId),
    error: null,
  });

  useEffect(() => {
    if (!mediaFileId) {
      setState({
        url: null,
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    void mediaService
      .getPlaybackUrl(mediaFileId, reason)
      .then((url) => {
        if (cancelled) {
          return;
        }
        setState({
          url,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          url: null,
          loading: false,
          error: error instanceof Error ? error.message : "Unable to load media",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [mediaFileId, reason]);

  return state;
}
