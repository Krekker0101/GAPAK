import { useState, useCallback } from "react";
import { mediaService } from "@/shared/api/services/media.service";
import type { UploadPurpose } from "@/shared/types/media";

export interface UseMediaUploadOptions {
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onSuccess?: (mediaFileId: string) => void;
}

export function useMediaUpload(options?: UseMediaUploadOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const upload = useCallback(
    async (file: File, purpose: UploadPurpose = "STORY") => {
      setIsLoading(true);
      setProgress(0);
      setError(null);

      try {
        // Start upload progress simulation
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 95) return prev;
            return prev + Math.random() * 30;
          });
        }, 100);

        // Upload file
        const result = await mediaService.uploadFile(file, purpose);

        clearInterval(progressInterval);
        setProgress(100);

        // Simulate small delay before completion
        await new Promise((resolve) => setTimeout(resolve, 300));

        setIsLoading(false);
        options?.onSuccess?.(result.mediaFileId);

        return result.mediaFileId;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options?.onError?.(error);
        setIsLoading(false);
        throw error;
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    upload,
    isLoading,
    progress,
    error,
    reset,
  };
}
