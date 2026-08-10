/**
 * GAPAK Live Stream Room Experience
 * Phase 4 - Live Domain
 *
 * Full live stream room featuring:
 * - Desktop: Video left/main + Live Chat & Events right
 * - Mobile: Video top layout + bottom sheet live chat
 * - State machine handling: SCHEDULED, LIVE, ENDING, ENDED, REPLAY, ERROR
 * - Stream overlays (Viewers, Latency, Floating Hearts, Host Control Panel)
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Flame,
  Radio,
  Share2,
  Gift,
  Heart,
  Video,
  Mic,
  MicOff,
  Square,
  Play,
  RotateCcw,
  Clock,
  MessageSquare,
  ShieldAlert,
  Loader2,
  ArrowLeft,
  Tv,
} from 'lucide-react';
import { LiveStream, PlaybackGrant } from '../../shared/types';
import { LiveStreamService } from './LiveStreamService';
import { PlaybackGrantService } from '../media/PlaybackGrantService';
import { VideoPlayer } from '../media/VideoPlayer';
import { LiveChat } from './LiveChat';
import { CURRENT_USER } from '../mocks/api/socialMockData';
import { Avatar, Badge, Button } from '../../shared/design-system/primitives';

interface LiveStreamRoomProps {
  streamId: string;
  onBack: () => void;
}

interface FloatingHeart {
  id: number;
  left: number;
}

export const LiveStreamRoom: React.FC<LiveStreamRoomProps> = ({ streamId, onBack }) => {
  const [stream, setStream] = useState<LiveStream | undefined>(LiveStreamService.getStreamById(streamId));
  const [grant, setGrant] = useState<PlaybackGrant | undefined>();
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [mobileTab, setMobileTab] = useState<'video' | 'chat'>('video');

  // Host local controls
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    const unsub = LiveStreamService.subscribeStreams((list) => {
      const updated = list.find((s) => s.id === streamId);
      setStream(updated);
    });
    return () => unsub();
  }, [streamId]);

  // Request signed playback grant
  useEffect(() => {
    let isMounted = true;
    PlaybackGrantService.requestPlaybackGrant(streamId, 'LIVE_REPLAY').then((g) => {
      if (isMounted) setGrant(g);
    });
    return () => {
      isMounted = false;
    };
  }, [streamId]);

  if (!stream) {
    return (
      <div className="p-8 text-center text-slate-400 space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-200">Stream Not Found</h2>
        <Button onClick={onBack} variant="secondary">
          Return to Streams List
        </Button>
      </div>
    );
  }

  const isHost = stream.host.id === CURRENT_USER.id;

  const handleSendLike = () => {
    LiveStreamService.sendLike(streamId);
    // Trigger floating heart
    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      left: Math.floor(Math.random() * 60) + 20,
    };
    setFloatingHearts((prev) => [...prev, newHeart]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 2000);
  };

  const sampleVideoUrl =
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Room Navigation Bar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Avatar name={stream.host.displayName} src={stream.host.avatarUrl} size="sm" />

          <div className="min-w-0">
            <h1 className="font-bold text-sm text-slate-100 truncate">{stream.title}</h1>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>{stream.host.displayName}</span>
              {stream.state === 'LIVE' && (
                <span className="inline-flex items-center gap-1 text-rose-400 font-bold font-mono">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  LIVE
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Mobile View Toggle */}
        <div className="flex md:hidden items-center bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMobileTab('video')}
            className={`px-3 py-1 text-xs rounded-lg font-semibold ${
              mobileTab === 'video' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Video
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('chat')}
            className={`px-3 py-1 text-xs rounded-lg font-semibold ${
              mobileTab === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Live Chat
          </button>
        </div>
      </div>

      {/* Main Layout Container */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
        {/* Left / Main Video Stream Panel */}
        <div
          className={`flex-1 flex flex-col bg-black relative ${
            mobileTab === 'chat' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Stream Player area */}
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
            {stream.state === 'SCHEDULED' ? (
              <div className="p-8 text-center space-y-3 bg-slate-900/80 border border-slate-800 rounded-2xl max-w-md m-4 backdrop-blur-md">
                <Clock className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
                <h3 className="font-bold text-base text-slate-100">Live Stream Scheduled</h3>
                <p className="text-xs text-slate-400">
                  Scheduled start time:{' '}
                  {stream.scheduledAt
                    ? new Date(stream.scheduledAt).toLocaleString()
                    : 'To be announced'}
                </p>
                {isHost && (
                  <Button
                    onClick={() => LiveStreamService.transitionState(stream.id, 'LIVE')}
                    variant="primary"
                    className="w-full mt-2"
                  >
                    Start Stream Now
                  </Button>
                )}
              </div>
            ) : stream.state === 'ENDED' ? (
              <div className="p-8 text-center space-y-3 bg-slate-900/80 border border-slate-800 rounded-2xl max-w-md m-4">
                <Tv className="w-12 h-12 text-slate-500 mx-auto" />
                <h3 className="font-bold text-base text-slate-100">Broadcast Has Ended</h3>
                <p className="text-xs text-slate-400">
                  {stream.allowReplay
                    ? 'Replay is currently processing and will be available shortly.'
                    : 'The host has disabled replay for this broadcast.'}
                </p>
                {stream.allowReplay && (
                  <Button
                    onClick={() => LiveStreamService.transitionState(stream.id, 'REPLAY')}
                    variant="outline"
                  >
                    Load Replay
                  </Button>
                )}
              </div>
            ) : stream.state === 'REPLAY' && stream.replayStatus === 'PROCESSING' ? (
              <div className="p-8 text-center space-y-3">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
                <h3 className="font-bold text-sm text-slate-200">Processing Replay Stream...</h3>
              </div>
            ) : (
              <VideoPlayer
                src={sampleVideoUrl}
                poster={stream.coverImageUrl}
                playbackGrant={grant}
                title={stream.title}
                autoPlay={stream.state === 'LIVE'}
                className="w-full h-full"
              />
            )}

            {/* Floating Hearts Animation Container */}
            <div className="absolute bottom-16 right-8 w-24 h-64 pointer-events-none z-30">
              {floatingHearts.map((heart) => (
                <div
                  key={heart.id}
                  className="absolute bottom-0 text-rose-500 animate-bounce"
                  style={{ left: `${heart.left}%` }}
                >
                  <Heart className="w-8 h-8 fill-rose-500 text-rose-400 drop-shadow-lg" />
                </div>
              ))}
            </div>
          </div>

          {/* Stream Overlay Info Bar */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>{stream.currentViewersCount.toLocaleString()} watching</span>
              </span>

              <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <Flame className="w-4 h-4 text-rose-500" />
                <span>{stream.likesCount.toLocaleString()} likes</span>
              </span>

              {stream.latencyMs && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                  Latency: {stream.latencyMs}ms
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSendLike}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl font-semibold flex items-center gap-1.5 active:scale-110 transition-transform"
              >
                <Heart className="w-4 h-4 fill-rose-500" />
                <span>Like</span>
              </button>

              {/* Host Broadcast Controls */}
              {isHost && stream.state === 'LIVE' && (
                <div className="flex items-center gap-2 border-l border-slate-700 pl-2">
                  <button
                    type="button"
                    onClick={() => setIsMicMuted(!isMicMuted)}
                    className={`p-2 rounded-xl ${
                      isMicMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200'
                    }`}
                    title="Toggle Microphone"
                  >
                    {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => LiveStreamService.transitionState(stream.id, 'ENDED')}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center gap-1"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>End Stream</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Live Chat Side Panel */}
        <div
          className={`w-full md:w-80 h-full ${
            mobileTab === 'video' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <LiveChat
            streamId={stream.id}
            className="w-full"
            onSendLike={handleSendLike}
          />
        </div>
      </div>
    </div>
  );
};
