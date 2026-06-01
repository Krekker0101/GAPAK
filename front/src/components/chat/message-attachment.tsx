"use client";

import { Download, FileImage, FileText } from "lucide-react";

import type { MessageAttachmentResponse } from "@/shared/types/chat";
import { useMediaUrl } from "@/shared/lib/hooks/use-media-url";

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageAttachment({ attachment }: { attachment: MessageAttachmentResponse }) {
  const { url, loading, error } = useMediaUrl(attachment.mediaFileId, "chat-attachment");
  const isImage = attachment.mimeType.startsWith("image/");

  return (
    <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] p-3">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/8 bg-black/20 p-2 text-primary">
          {isImage ? <FileImage className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {attachment.originalName || attachment.mediaFileId}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {attachment.mimeType} • {formatBytes(attachment.sizeBytes)}
          </p>
        </div>
        {url ? (
          <a
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            <Download className="h-3.5 w-3.5" />
            Open
          </a>
        ) : null}
      </div>
      {isImage && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={attachment.originalName || "Attachment preview"}
          className="mt-3 max-h-64 w-full rounded-[1rem] border border-white/8 object-cover"
        />
      ) : null}
      {loading ? <p className="mt-3 text-xs text-muted-foreground">Generating secure download link...</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
