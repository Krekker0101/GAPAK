/**
 * GAPAK Live & Media Domain View
 * Phase 4 - Top Level Domain Component
 */

import React, { useState, useEffect } from 'react';
import {
  Radio,
  Plus,
  Tv,
  Clock,
  Flame,
  Search,
  Filter,
  Activity,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import { LiveStream, LiveStreamState } from '../../shared/types';
import { LiveStreamService } from './LiveStreamService';
import { LiveStreamCard } from './LiveStreamCard';
import { LiveStreamRoom } from './LiveStreamRoom';
import { CreateStreamModal } from './CreateStreamModal';
import { LiveMediaTestConsole } from './LiveMediaTestConsole';
import { MediaUploadSubsystem } from '../media/MediaUploadSubsystem';
import { GlobalUploadCenter } from '../media/GlobalUploadCenter';
import { Button, Badge } from '../../shared/design-system/primitives';

export const LiveView: React.FC = () => {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<'ALL' | LiveStreamState>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'streams' | 'uploader' | 'testConsole'>('streams');

  useEffect(() => {
    const unsub = LiveStreamService.subscribeStreams(setStreams);
    return () => unsub();
  }, []);

  const filteredStreams = streams.filter((s) => {
    const matchesState = stateFilter === 'ALL' || s.state === stateFilter;
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.host.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesState && matchesSearch;
  });

  const liveCount = streams.filter((s) => s.state === 'LIVE').length;
  const scheduledCount = streams.filter((s) => s.state === 'SCHEDULED').length;

  if (selectedStreamId) {
    return (
      <div className="h-full relative">
        <LiveStreamRoom streamId={selectedStreamId} onBack={() => setSelectedStreamId(null)} />
        <GlobalUploadCenter />
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-rose-500 animate-pulse" />
            <h1 className="text-xl font-extrabold tracking-tight text-slate-100">
              GAPAK Live Platform & Universal Media Subsystem
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Realtime low-latency broadcasts, signed HLS playback grants, and multi-tenant media uploads
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            variant="primary"
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Go Live / Schedule</span>
          </Button>
        </div>
      </div>

      {/* Domain Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('streams')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeSubTab === 'streams'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Live Broadcasts</span>
          {liveCount > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full animate-pulse">
              {liveCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('uploader')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeSubTab === 'uploader'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Media Upload Subsystem</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('testConsole')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeSubTab === 'testConsole'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Phase 4 Verification Test Suite</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeSubTab === 'streams' && (
        <div className="space-y-6">
          {/* Search & State Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search live streams, hosts, or tags..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['ALL', 'LIVE', 'SCHEDULED', 'REPLAY', 'ENDED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStateFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    stateFilter === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {st}
                  {st === 'LIVE' && liveCount > 0 && ` (${liveCount})`}
                  {st === 'SCHEDULED' && scheduledCount > 0 && ` (${scheduledCount})`}
                </button>
              ))}
            </div>
          </div>

          {/* Streams Grid */}
          {filteredStreams.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-2xl space-y-2">
              <Tv className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="font-bold text-sm text-slate-300">No Streams Match Filter</p>
              <p className="text-xs text-slate-500">Try adjusting your search query or state filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStreams.map((stream) => (
                <LiveStreamCard
                  key={stream.id}
                  stream={stream}
                  onSelect={(id) => setSelectedStreamId(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'uploader' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <h3 className="font-bold text-sm text-slate-100">Universal Media Pipeline Tester</h3>
            <p className="text-xs text-slate-400">
              Upload attachments for Post Attachment, Chat Attachment, Clip, Story, Profile, Trust Room, or Live Replay.
            </p>
          </div>
          <MediaUploadSubsystem />
        </div>
      )}

      {activeSubTab === 'testConsole' && <LiveMediaTestConsole />}

      {/* Create Modal */}
      <CreateStreamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onStreamCreated={(id) => setSelectedStreamId(id)}
      />

      {/* Global Upload Center Dock */}
      <GlobalUploadCenter />
    </div>
  );
};
