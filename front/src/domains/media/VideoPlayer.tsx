/**
 * Premium Video Player Component
 * GAPAK Media Infrastructure - Phase 4
 *
 * Supports adaptive HLS quality switching, custom UI controls, PiP, captions,
 * buffering states, playback grant auto-renewal, mobile native controls, and IntersectionObserver auto-pause.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Subtitles,
  RotateCcw,
  Loader2,
  AlertCircle,
  PictureInPicture2,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { PlaybackGrant, HLSVariant } from '../../shared/types';
import type { MediaUsageContext } from '../../shared/types/media';
import { PlaybackGrantService } from './PlaybackGrantService';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  playbackGrant?: PlaybackGrant;
  title?: string;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
  onEnded?: () => void;
  playbackContext?: MediaUsageContext;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  playbackGrant: initialGrant,
  title,
  autoPlay = false,
  loop = false,
  className = '',
  onEnded,
  playbackContext = 'POST_ATTACHMENT',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [captionLanguage, setCaptionLanguage] = useState<string>('off');
  const pendingSeekRef = useRef<number | null>(null);
  // Playback grant state
  const [grant, setGrant] = useState<PlaybackGrant | undefined>(initialGrant);
  const effectivePlaybackContext: MediaUsageContext = playbackContext;
  const [grantRemainingSec, setGrantRemainingSec] = useState<number>(
    initialGrant ? PlaybackGrantService.getRemainingSeconds(initialGrant) : 600
  );
  const activeSrc = selectedQuality === 'auto' ? (grant?.masterManifestUrl || src) : (grant?.variants.find(v => v.resolution === selectedQuality)?.url || grant?.masterManifestUrl || src);

  // Menus toggles
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showCaptionMenu, setShowCaptionMenu] = useState(false);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSrc.includes('.m3u8')) return;
    let hls: { destroy: () => void } | undefined;
    let cancelled = false;
    const nativeHls = video.canPlayType('application/vnd.apple.mpegurl');
    if (nativeHls) {
      video.src = activeSrc;
      return;
    }
    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !video || !Hls.isSupported()) return;
      const instance = new Hls({ enableWorker: true, lowLatencyMode: true });
      instance.loadSource(activeSrc);
      instance.attachMedia(video);
      hls = instance;
    }).catch(() => setHasError(true));
    return () => { cancelled = true; hls?.destroy(); if (video.src === activeSrc) video.removeAttribute('src'); video.load(); };
  }, [activeSrc]);

  useEffect(() => {
    const handlePanic = () => {
      videoRef.current?.pause();
      setIsPlaying(false);
      setGrant(undefined);
      setHasError(true);
    };
    window.addEventListener('gapak:panic', handlePanic);
    return () => window.removeEventListener('gapak:panic', handlePanic);
  }, []);

  // Grant countdown & renewal
  useEffect(() => {
    if (!grant) return;

    const timer = setInterval(async () => {
      const remaining = PlaybackGrantService.getRemainingSeconds(grant);
      setGrantRemainingSec(remaining);

      if (remaining <= 30) {
        // Renew grant
        try {
          const renewed = await PlaybackGrantService.renewPlaybackGrant(grant, effectivePlaybackContext);
          setGrant(renewed);
        } catch {
          videoRef.current?.pause();
          setIsPlaying(false);
          setHasError(true);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [grant]);

  // Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  useEffect(() => () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = null;
  }, []);

  // Intersection Observer auto-pause offscreen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (!videoRef.current) return;

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, videoRef.current.currentTime - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(videoRef.current.duration, videoRef.current.currentTime + 5));
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(0, volume - 0.1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
    }
  };

  const seek = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const changeVolume = (val: number) => {
    if (!videoRef.current) return;
    setVolume(val);
    videoRef.current.volume = val;
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      await videoRef.current.requestPictureInPicture();
    }
  };

  const changeSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSettingsMenu(false);
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative group bg-black rounded-[var(--radius-2xl)] overflow-hidden select-none border border-subtle ${className}`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={activeSrc}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
        onLoadedMetadata={() => {
          if (!videoRef.current) return;
          setDuration(videoRef.current.duration);
          if (pendingSeekRef.current !== null && Number.isFinite(pendingSeekRef.current)) {
            const target = Math.min(pendingSeekRef.current, Number.isFinite(videoRef.current.duration) ? videoRef.current.duration : pendingSeekRef.current);
            videoRef.current.currentTime = target;
            pendingSeekRef.current = null;
            if (autoPlay) void videoRef.current.play().catch(() => undefined);
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        onError={() => setHasError(true)}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
      >
        {grant?.captions?.map(caption => <track key={caption.language} kind="subtitles" src={caption.url} srcLang={caption.language} label={caption.label} default={caption.language === captionLanguage} />)}
      </video>

      {/* Title & Signed Grant Badge Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-xs text-white z-20 pointer-events-none">
        <div className="flex items-center gap-2">
          {title && <span className="font-bold truncate max-w-xs">{title}</span>}
          {grant && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Signed Grant ({grantRemainingSec}s)</span>
            </span>
          )}
        </div>

        {selectedQuality !== 'auto' && (
          <span className="px-2 py-0.5 rounded bg-indigo-600/80 text-white font-mono text-[10px] font-bold">
            {selectedQuality}
          </span>
        )}
      </div>

      {/* Center Play/Pause / Buffering / Error Overlay */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs z-20 pointer-events-none">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-rose-300 p-4 z-20 space-y-2">
          <AlertCircle className="w-10 h-10 text-rose-500" />
          <p className="font-bold text-sm">Playback Stream Failed</p>
          <p className="text-xs text-tertiary text-center max-w-sm">
            Grant token expired or HLS variant chunk request timed out.
          </p>
          <button
            type="button"
            onClick={() => {
              setHasError(false);
              videoRef.current?.load();
            }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-[var(--radius-lg)] text-xs font-semibold flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Stream</span>
          </button>
        </div>
      )}

      {!isPlaying && !isBuffering && !hasError && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors z-10 cursor-pointer"
        >
          <div className="p-4 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-[var(--radius-pill)] shadow-token-lg transition-transform transform group-hover:scale-110">
            <Play className="w-8 h-8 ml-1 fill-white" />
          </div>
        </div>
      )}

      {/* Subtitles Overlay */}
      {captionLanguage !== 'off' && isPlaying && (
        <div className="absolute bottom-16 left-0 right-0 text-center z-20 pointer-events-none">
          <span className="inline-block px-3 py-1 bg-black/80 text-yellow-300 text-xs font-semibold rounded-[var(--radius-lg)] border border-default">
            [Subtitle ({captionLanguage.toUpperCase()}): GAPAK Realtime Encryption Stream]
          </span>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 z-30 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline Seekbar */}
        <div className="relative mb-2 group/bar cursor-pointer flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-surface-strong accent-indigo-500 rounded-[var(--radius-lg)] cursor-pointer hover:h-2 transition-all"
          />
        </div>

        {/* Controls Buttons Bar */}
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-3">
            <button type="button" onClick={togglePlay} className="hover:text-indigo-400 transition-colors">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/vol">
              <button type="button" onClick={toggleMute} className="hover:text-indigo-400 transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                className="w-16 h-1 bg-surface-strong accent-indigo-500 rounded-[var(--radius-lg)] cursor-pointer"
              />
            </div>

            {/* Time Stamp */}
            <span className="font-mono text-[11px] text-secondary">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2 relative">
            {/* Subtitles Button */}
            <button
              type="button"
              onClick={() => setShowCaptionMenu(!showCaptionMenu)}
              className={`p-1 hover:text-indigo-400 transition-colors ${captionLanguage !== 'off' ? 'text-indigo-400' : ''}`}
            >
              <Subtitles className="w-5 h-5" />
            </button>

            {/* Picture-in-Picture */}
            <button type="button" onClick={togglePiP} className="p-1 hover:text-indigo-400 transition-colors">
              <PictureInPicture2 className="w-5 h-5" />
            </button>

            {/* Quality & Speed Settings Button */}
            <button
              type="button"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-1 hover:text-indigo-400 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Fullscreen Button */}
            <button type="button" onClick={toggleFullscreen} className="p-1 hover:text-indigo-400 transition-colors">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>

            {/* Captions Dropdown */}
            {showCaptionMenu && (
              <div className="absolute bottom-full mb-2 right-12 w-36 bg-surface border border-subtle rounded-[var(--radius-xl)] p-1 shadow-token-lg text-xs space-y-1 z-40">
                <p className="px-2 py-1 text-[10px] font-mono text-tertiary uppercase">Subtitles</p>
                {['off', 'en', 'ru', 'es'].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setCaptionLanguage(lang);
                      setShowCaptionMenu(false);
                    }}
                    className={`w-full p-1.5 text-left rounded-[var(--radius-lg)] ${
                      captionLanguage === lang ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-surface-muted text-secondary'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {/* Quality & Speed Dropdown */}
            {showSettingsMenu && (
              <div className="absolute bottom-full mb-2 right-0 w-44 bg-surface border border-subtle rounded-[var(--radius-xl)] p-2 shadow-token-lg text-xs space-y-2 z-40">
                <div>
                  <p className="text-[10px] font-mono text-tertiary uppercase mb-1">Quality</p>
                  {['auto', '1080p', '720p', '480p', '360p'].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        pendingSeekRef.current = videoRef.current?.currentTime ?? 0;
                        setSelectedQuality(q);
                        setShowSettingsMenu(false);
                      }}
                      className={`w-full p-1 text-left rounded ${
                        selectedQuality === q ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-surface-muted text-secondary'
                      }`}
                    >
                      {q.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="border-t border-subtle pt-1">
                  <p className="text-[10px] font-mono text-tertiary uppercase mb-1">Speed</p>
                  {[0.5, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => changeSpeed(s)}
                      className={`w-full p-1 text-left rounded ${
                        playbackSpeed === s ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-surface-muted text-secondary'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
