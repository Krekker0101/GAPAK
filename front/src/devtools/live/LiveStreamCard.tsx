/**
 * Live Stream Card Component
 * Phase 4 - Live Domain
 */

import React from 'react';
import { Radio, Users, Flame, Play, Clock, Tv } from 'lucide-react';
import { LiveStream } from '../../shared/types';
import { Avatar, Badge } from '../../shared/design-system/primitives';

interface LiveStreamCardProps {
  stream: LiveStream;
  onSelect: (streamId: string) => void;
}

export const LiveStreamCard: React.FC<LiveStreamCardProps> = ({ stream, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(stream.id)}
      className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl flex flex-col"
    >
      {/* Thumbnail Banner */}
      <div className="relative aspect-video bg-black overflow-hidden">
        <img
          src={stream.coverImageUrl}
          alt={stream.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Status Badge */}
        <div className="absolute top-3 left-3 z-10">
          {stream.state === 'LIVE' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-600 text-white font-mono font-bold text-[10px] rounded-full shadow-lg animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white" />
              LIVE
            </span>
          )}
          {stream.state === 'SCHEDULED' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/90 text-slate-950 font-mono font-bold text-[10px] rounded-full shadow-lg">
              <Clock className="w-3 h-3" />
              SCHEDULED
            </span>
          )}
          {stream.state === 'REPLAY' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 text-white font-mono font-bold text-[10px] rounded-full shadow-lg">
              <Tv className="w-3 h-3" />
              REPLAY
            </span>
          )}
          {stream.state === 'ENDED' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 text-slate-300 font-mono font-bold text-[10px] rounded-full">
              ENDED
            </span>
          )}
        </div>

        {/* Viewers Overlay */}
        {stream.state === 'LIVE' && (
          <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-xs px-2 py-1 rounded-lg text-white font-mono text-[10px] flex items-center gap-1">
            <Users className="w-3 h-3 text-indigo-400" />
            <span>{stream.currentViewersCount.toLocaleString()}</span>
          </div>
        )}

        {/* Play Overlay Icon on Hover */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="p-3 bg-indigo-600 text-white rounded-full shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-6 h-6 ml-0.5 fill-white" />
          </div>
        </div>
      </div>

      {/* Details Footer */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <h3 className="font-bold text-sm text-slate-100 line-clamp-2 leading-snug group-hover:text-indigo-400 transition-colors">
            {stream.title}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2">{stream.description}</p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <Avatar name={stream.host.displayName} src={stream.host.avatarUrl} size="sm" />
            <span className="font-semibold text-slate-300 truncate max-w-[120px]">{stream.host.displayName}</span>
          </div>

          <div className="flex items-center gap-1 text-slate-400 text-[11px]">
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            <span>{stream.likesCount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
