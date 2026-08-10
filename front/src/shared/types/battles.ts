/**
 * GAPAK Battles Domain Specifications & Contracts
 * Phase 5 - Cinematic 1v1 Creator Arena
 */

import { UserProfile } from './index';

export type BattleState =
  | 'DRAFT'
  | 'PENDING_RESPONSE'
  | 'ACCEPTED'
  | 'SCHEDULED'
  | 'LIVE'
  | 'ROUND_ACTIVE'
  | 'ROUND_COMPLETE'
  | 'FINISHED'
  | 'CANCELLED';

export type VoteTarget = 'HOST_A' | 'HOST_B' | 'DRAW';

export interface BattleRound {
  roundNumber: number;
  title: string;
  durationSeconds: number;
  status: 'upcoming' | 'active' | 'completed';
  winner?: VoteTarget;
  votesHostA: number;
  votesHostB: number;
  votesDraw: number;
}

export interface BattleHost {
  user: UserProfile;
  score: number;
  votesCount: number;
  weightedVotes: number;
  status: 'ready' | 'streaming' | 'offline';
  videoFeedUrl?: string;
  avatarUrl?: string;
}

export interface BattleComment {
  id: string;
  author: UserProfile;
  text: string;
  target?: VoteTarget;
  createdAt: string;
}

export interface Battle {
  id: string;
  title: string;
  description: string;
  category: string;
  state: BattleState;
  hostA: BattleHost;
  hostB: BattleHost;
  currentRound: number;
  totalRounds: number;
  rounds: BattleRound[];
  scheduledAt: string;
  durationMinutes: number;
  totalVotes: number;
  audienceCount: number;
  linkedLiveStreamId?: string;
  linkedTrustRoomId?: string;
  myVote?: VoteTarget;
  voteWeight?: number;
  winner?: VoteTarget;
  createdAt: string;
  comments: BattleComment[];
}
