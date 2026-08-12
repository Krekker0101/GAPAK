/**
 * GAPAK Post Subcomponent: PostMedia
 * Handles carousel, video player, and One-Time self-destruct content shields.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Play, Volume2, VolumeX, ShieldAlert, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { PostMediaAsset, ContentPrivacyLevel } from '../../shared/types';
import { Button } from '../../shared/design-system/primitives';

interface PostMediaProps {
  media: PostMediaAsset[];
  privacy: ContentPrivacyLevel;
  oneTimeViewed?: boolean;
  onRevealOneTime?: () => void;
}

export const PostMedia: React.FC<PostMediaProps> = ({
  media,
  privacy,
  oneTimeViewed = false,
  onRevealOneTime,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  if (!media || media.length === 0) return null;

  const currentAsset = media[currentIndex];

  // One-Time Content Shield
  if (privacy === 'ONE_TIME') {
    if (oneTimeViewed || (isRevealed && !oneTimeViewed)) {
      return (
        <div className="mx-4 my-2 p-8 rounded-[var(--radius-2xl)] bg-rose-500/10 border border-rose-500/20 text-center flex flex-col items-center justify-center space-y-3">
          <div className="p-3 rounded-[var(--radius-pill)] bg-rose-500/20 text-rose-500">
            <EyeOff className="w-8 h-8" />
          </div>
          <div>
            <h4 className="font-semibold text-primary dark:text-primary">One-Time Content Expired</h4>
            <p className="text-xs text-muted dark:text-tertiary mt-1 max-w-sm">
              This asset was viewed and automatically self-destructed according to GAPAK privacy policy.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-4 my-2 relative rounded-[var(--radius-2xl)] overflow-hidden bg-app aspect-video flex flex-col items-center justify-center text-center p-6 border border-subtle">
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-rose-950/40 to-slate-900 blur-xl opacity-80" />
        <div className="relative z-10 flex flex-col items-center space-y-3 max-w-md">
          <div className="p-3 rounded-[var(--radius-2xl)] bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Eye className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-white text-base">One-Time Self-Destruct Content</h4>
          <p className="text-xs text-secondary">
            Once tapped, this secret photo/video will disappear permanently from all devices.
          </p>
          <Button
            variant="gradient"
            onClick={() => {
              setIsRevealed(true);
              onRevealOneTime?.();
            }}
            className="bg-gradient-to-r from-rose-500 to-amber-500 text-white font-semibold"
          >
            Tap to Reveal & View Once
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative my-2 mx-4 rounded-[var(--radius-2xl)] overflow-hidden bg-app group">
      {/* Media Display */}
      {currentAsset.type === 'video' ? (
        <div className="relative aspect-video bg-black flex items-center justify-center">
          <video
            src={currentAsset.url}
            controls
            autoPlay
            muted={isMuted}
            loop
            className="w-full h-full object-contain"
            preload="metadata"
          />
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="absolute bottom-3 right-3 p-2 rounded-[var(--radius-pill)] bg-black/60 text-white hover:bg-black/80 transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <div className="relative w-full max-h-[500px] overflow-hidden flex items-center justify-center bg-surface">
          <img
            src={currentAsset.url}
            alt={currentAsset.altText || 'Post media asset'}
            className="w-full h-full object-cover max-h-[500px]" loading="lazy" decoding="async"
          />
        </div>
      )}

      {/* Carousel Navigation */}
      {media.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous media"
            onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : media.length - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-[var(--radius-pill)] bg-black/50 text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Previous media"
            onClick={() => setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0))}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-[var(--radius-pill)] bg-black/50 text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5">
            {media.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-[var(--radius-pill)] transition-all ${
                  idx === currentIndex ? 'w-5 bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
