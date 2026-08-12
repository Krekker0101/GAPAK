/**
 * GAPAK Live Streaming Platform Types
 * Phase 4 - Live Domain Architecture
 */

import { UserProfile } from './index';
import { PlaybackGrant } from './media';

export type LiveStreamState =
  | 'SCHEDULED'
  | 'PREPARING'
  | 'LIVE'
  | 'ENDING'
  | 'ENDED'
  | 'REPLAY'
  | 'FAILED'
  | 'ERROR';

export type ReplayStatus = 'UNAVAILABLE' | 'PROCESSING' | 'READY' | 'ERROR';

export interface LiveStream {
  id: string;
  title: string;
  description?: string;
  host: UserProfile;
  state: LiveStreamState;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  currentViewersCount: number;
  peakViewersCount: number;
  likesCount: number;
  coverImageUrl?: string;
  allowReplay: boolean;
  replayMediaId?: string;
  replayStatus?: ReplayStatus;
  streamKey?: string;
  playbackGrant?: PlaybackGrant;
  tags?: string[];
  latencyMs?: number;
  createdAt: string;
}

export interface LiveChatMessage {
  id: string;
  streamId: string;
  sender: UserProfile;
  text: string;
  isSystem?: boolean;
  isPinned?: boolean;
  badges?: string[];
  createdAt: string;
}

export interface LiveStreamEvent {
  id: string;
  streamId: string;
  type: 'viewer_joined' | 'viewer_left' | 'like' | 'tip' | 'pinned_msg' | 'state_change';
  user?: UserProfile;
  payload?: Record<string, unknown>;
  timestamp: string;
}
