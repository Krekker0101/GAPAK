"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X, Image as ImageIcon, Video as VideoIcon, Type, Play, Pause, AlertCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Card } from "@/shared/ui/card";
import type { CreateStoryRequest, StoryResponse } from "@/shared/types/story";
import { storyService } from "@/shared/api/services/story.service";
import { useMediaUpload } from "@/shared/lib/hooks/use-media-upload";

interface StoryCreatorProps {
  onClose: () => void;
  onSuccess?: (story: StoryResponse) => void;
}

type UploadStep = "select" | "preview" | "edit" | "uploading";

interface UploadFile {
  file: File;
  preview: string;
  type: "image" | "video";
  duration?: number;
}

export function StoryCreator({ onClose, onSuccess }: StoryCreatorProps) {
  const [step, setStep] = useState<UploadStep>("select");
  const [uploadFile, setUploadFile] = useState<UploadFile | null>(null);
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<"PUBLIC" | "FRIENDS" | "PRIVATE">("PUBLIC");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { upload, progress } = useMediaUpload();

  const handleFileSelect = (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      setError("File too large (max 100MB)");
      return;
    }

    const mimeType = file.type;
    let type: "image" | "video" = "image";

    if (mimeType.startsWith("video/")) {
      type = "video";
    } else if (!mimeType.startsWith("image/")) {
      setError("Only images and videos are supported");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      const newFile: UploadFile = {
        file,
        preview,
        type,
      };

      if (type === "video") {
        // Get video duration
        const video = document.createElement("video");
        video.onloadedmetadata = () => {
          newFile.duration = video.duration;
          setUploadFile(newFile);
          setStep("preview");
        };
        video.src = preview;
      } else {
        setUploadFile(newFile);
        setStep("preview");
      }
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  const handleDragDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handlePublish = async () => {
    if (!uploadFile) return;

    setStep("uploading");
    setIsLoading(true);
    setError(null);

    try {
      // Upload media file
      const mediaFileId = await upload(uploadFile.file, "STORY");

      // Create story
      const payload: CreateStoryRequest = {
        mediaFileId,
        caption: caption || undefined,
        privacy,
        allowReplies: true,
        allowReactions: true,
      };

      const story = await storyService.create(payload);
      onSuccess?.(story);
      onClose();
    } catch (err) {
      setStep("edit");
      setError(err instanceof Error ? err.message : "Failed to create story");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">Create Story</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === "select" && (
            <div className="space-y-4">
              {/* Drag and drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDragDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                />

                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-primary/60" />
                  <div>
                    <p className="font-medium text-sm">Drop media here</p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                  </div>
                </div>
              </div>

              {/* Quick select buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                >
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">Photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                >
                  <VideoIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">Video</span>
                </button>
              </div>
            </div>
          )}

          {step === "preview" && uploadFile && (
            <div className="space-y-4">
              {/* Media preview */}
              <div className="rounded-lg overflow-hidden bg-black aspect-square flex items-center justify-center relative group">
                {uploadFile.type === "image" && (
                  <img
                    src={uploadFile.preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                )}
                {uploadFile.type === "video" && (
                  <>
                    <video
                      ref={videoRef}
                      src={uploadFile.preview}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <Play className="h-8 w-8 text-white fill-white" />
                    </div>
                  </>
                )}
              </div>

              {/* Media info */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Type:</span> {uploadFile.type === "video" ? "Video" : "Image"}
                </p>
                <p>
                  <span className="font-medium">Size:</span>{" "}
                  {(uploadFile.file.size / 1024 / 1024).toFixed(2)}MB
                </p>
                {uploadFile.duration && (
                  <p>
                    <span className="font-medium">Duration:</span>{" "}
                    {Math.round(uploadFile.duration)}s
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("select");
                    setUploadFile(null);
                  }}
                  className="flex-1"
                >
                  Change
                </Button>
                <Button onClick={() => setStep("edit")} className="flex-1">
                  Next
                </Button>
              </div>
            </div>
          )}

          {(step === "edit" || step === "uploading") && uploadFile && (
            <div className="space-y-4">
              {/* Media preview thumbnail */}
              <div className="rounded-lg overflow-hidden bg-black/50 aspect-video flex items-center justify-center relative">
                {uploadFile.type === "image" && (
                  <img
                    src={uploadFile.preview}
                    alt="Preview"
                    className="w-full h-full object-cover opacity-50"
                  />
                )}
                {uploadFile.type === "video" && (
                  <video
                    src={uploadFile.preview}
                    className="w-full h-full object-cover opacity-50"
                  />
                )}

                {/* Upload progress overlay */}
                {step === "uploading" && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4">
                    <div className="relative w-12 h-12">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-white/20"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-primary transition-all"
                          strokeDasharray={`${(progress / 100) * 125.6} 125.6`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                        {Math.round(progress)}%
                      </div>
                    </div>
                    <p className="text-sm text-white">Uploading...</p>
                  </div>
                )}
              </div>

              {/* Caption input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Caption (optional)</label>
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                  maxLength={600}
                  disabled={step === "uploading"}
                  className="resize-none text-sm"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {caption.length}/600
                </p>
              </div>

              {/* Privacy selector */}
              {step === "edit" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Privacy</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["PUBLIC", "FRIENDS", "PRIVATE"].map((privacyOption) => (
                      <button
                        key={privacyOption}
                        onClick={() => setPrivacy(privacyOption as typeof privacy)}
                        className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                          privacy === privacyOption
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-white/10 hover:bg-white/5"
                        }`}
                      >
                        {privacyOption}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/20 border border-destructive/50 flex gap-2 items-start">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step !== "select" && (
          <div className="flex gap-2 p-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={() => {
                if (step === "preview") {
                  setStep("select");
                  setUploadFile(null);
                } else if (step !== "uploading") {
                  setStep("preview");
                }
              }}
              disabled={step === "uploading"}
              className="flex-1"
            >
              Back
            </Button>
            {(step === "edit" || step === "uploading") && (
              <Button
                onClick={handlePublish}
                disabled={isLoading || step === "uploading"}
                className="flex-1 bg-gradient-to-r from-primary to-accent"
              >
                {isLoading || step === "uploading" ? "Publishing..." : "Share Story"}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
