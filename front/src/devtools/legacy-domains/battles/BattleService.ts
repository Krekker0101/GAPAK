/**
 * GAPAK Battles Service & Reactive State Engine
 * Phase 5 - Cinematic 1v1 Creator Arena State Machine & Voting System
 */

import {
  Battle,
  BattleState,
  VoteTarget,
  BattleRound,
  BattleHost,
  BattleComment,
} from '../../../shared/types/battles';
import { UserProfile } from '../../../shared/types';
import { MOCK_CURRENT_USER } from '../trust-rooms/TrustRoomService';

const MOCK_HOST_A: BattleHost = {
  user: MOCK_CURRENT_USER,
  score: 1420,
  votesCount: 380,
  weightedVotes: 760,
  status: 'streaming',
  videoFeedUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600',
  avatarUrl: MOCK_CURRENT_USER.avatarUrl,
};

const MOCK_USER_ELENA: UserProfile = {
  id: 'usr_elena',
  username: 'elena_v',
  displayName: 'Elena Vance',
  email: 'elena@gapak.io',
  avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
  role: 'creator',
  status: 'active',
  presence: 'online',
  trustScore: 95,
  permissions: [],
  twoFactorEnabled: true,
  createdAt: '2025-02-10T00:00:00Z',
};

const MOCK_HOST_B: BattleHost = {
  user: MOCK_USER_ELENA,
  score: 1680,
  votesCount: 410,
  weightedVotes: 890,
  status: 'streaming',
  videoFeedUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600',
  avatarUrl: MOCK_USER_ELENA.avatarUrl,
};

const MOCK_USER_MARCUS: UserProfile = {
  id: 'usr_marcus',
  username: 'marcus_tech',
  displayName: 'Marcus Chen',
  email: 'marcus@gapak.io',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  role: 'user',
  status: 'active',
  presence: 'busy',
  trustScore: 89,
  permissions: [],
  twoFactorEnabled: false,
  createdAt: '2025-03-01T00:00:00Z',
};

const INITIAL_BATTLES: Battle[] = [
  {
    id: 'bat_live_01',
    title: 'GAPAK Protocol Battle: ZK Proofs vs Optimistic Rollups',
    description: 'Cinematic 1v1 debate & live coding showdown between Alex Rivers and Elena Vance.',
    category: 'TECH & CODING',
    state: 'ROUND_ACTIVE',
    hostA: MOCK_HOST_A,
    hostB: MOCK_HOST_B,
    currentRound: 2,
    totalRounds: 3,
    rounds: [
      {
        roundNumber: 1,
        title: 'Opening Statements & Scalability Limits',
        durationSeconds: 180,
        status: 'completed',
        winner: 'HOST_B',
        votesHostA: 120,
        votesHostB: 180,
        votesDraw: 20,
      },
      {
        roundNumber: 2,
        title: 'Live Implementation & Security Benchmarks',
        durationSeconds: 300,
        status: 'active',
        votesHostA: 260,
        votesHostB: 230,
        votesDraw: 15,
      },
      {
        roundNumber: 3,
        title: 'Audience Q&A & Final Verdict',
        durationSeconds: 180,
        status: 'upcoming',
        votesHostA: 0,
        votesHostB: 0,
        votesDraw: 0,
      },
    ],
    scheduledAt: '2026-08-08T23:00:00Z',
    durationMinutes: 30,
    totalVotes: 825,
    audienceCount: 1420,
    linkedLiveStreamId: 'ls_gapak_01',
    linkedTrustRoomId: 'tr_beta',
    myVote: 'HOST_A',
    voteWeight: 2,
    createdAt: '2026-08-08T20:00:00Z',
    comments: [
      {
        id: 'c1',
        author: MOCK_USER_MARCUS,
        text: 'Alex’s ZK circuit synthesis in Round 2 was insane! 🔥',
        target: 'HOST_A',
        createdAt: '2026-08-08T23:15:00Z',
      },
      {
        id: 'c2',
        author: MOCK_USER_ELENA,
        text: 'Optimistic rollups still win on instant latency though! 🚀',
        target: 'HOST_B',
        createdAt: '2026-08-08T23:16:00Z',
      },
    ],
  },
  {
    id: 'bat_sched_02',
    title: 'UI Design Face-off: Dark Mode Luxury vs Warm Neutral Minimalist',
    description: 'Marcus Chen vs Alex Rivers in a 60-minute real-time Figma & Tailwind speed sprint.',
    category: 'DESIGN & PRODUCT',
    state: 'SCHEDULED',
    hostA: {
      user: MOCK_USER_MARCUS,
      score: 0,
      votesCount: 0,
      weightedVotes: 0,
      status: 'ready',
      avatarUrl: MOCK_USER_MARCUS.avatarUrl,
    },
    hostB: MOCK_HOST_A,
    currentRound: 1,
    totalRounds: 2,
    rounds: [
      {
        roundNumber: 1,
        title: 'Design System Tokens & Typography',
        durationSeconds: 300,
        status: 'upcoming',
        votesHostA: 0,
        votesHostB: 0,
        votesDraw: 0,
      },
      {
        roundNumber: 2,
        title: 'Interactive Motion & Prototype Polish',
        durationSeconds: 300,
        status: 'upcoming',
        votesHostA: 0,
        votesHostB: 0,
        votesDraw: 0,
      },
    ],
    scheduledAt: '2026-08-09T18:00:00Z',
    durationMinutes: 45,
    totalVotes: 140,
    audienceCount: 310,
    createdAt: '2026-08-08T18:00:00Z',
    comments: [],
  },
  {
    id: 'bat_pending_03',
    title: 'AI Code Agents: Gemini 2.5 Pro vs Anthropic Claude 3.5 Sonnet',
    description: 'Challenging complex full-stack code generation benchmark battle.',
    category: 'AI & DATA',
    state: 'PENDING_RESPONSE',
    hostA: MOCK_HOST_A,
    hostB: {
      user: MOCK_USER_MARCUS,
      score: 0,
      votesCount: 0,
      weightedVotes: 0,
      status: 'offline',
      avatarUrl: MOCK_USER_MARCUS.avatarUrl,
    },
    currentRound: 1,
    totalRounds: 3,
    rounds: [],
    scheduledAt: '2026-08-10T12:00:00Z',
    durationMinutes: 60,
    totalVotes: 0,
    audienceCount: 0,
    createdAt: '2026-08-08T22:00:00Z',
    comments: [],
  },
];

type BattleListener = (battles: Battle[]) => void;

class BattleServiceImpl {
  private battles: Battle[] = [...INITIAL_BATTLES];
  private listeners: Set<BattleListener> = new Set();

  public subscribe(listener: BattleListener): () => void {
    this.listeners.add(listener);
    listener(this.battles);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.battles]));
  }

  public getBattles(): Battle[] {
    return this.battles;
  }

  public getBattleById(id: string): Battle | undefined {
    return this.battles.find((b) => b.id === id);
  }

  public createBattle(
    title: string,
    description: string,
    category: string,
    opponentUser: UserProfile,
    totalRounds: number,
    scheduledAt: string,
    linkedTrustRoomId?: string
  ): Battle {
    const newBattle: Battle = {
      id: `bat_${Date.now()}`,
      title,
      description,
      category,
      state: 'PENDING_RESPONSE',
      hostA: {
        user: MOCK_CURRENT_USER,
        score: 0,
        votesCount: 0,
        weightedVotes: 0,
        status: 'ready',
        avatarUrl: MOCK_CURRENT_USER.avatarUrl,
      },
      hostB: {
        user: opponentUser,
        score: 0,
        votesCount: 0,
        weightedVotes: 0,
        status: 'offline',
        avatarUrl: opponentUser.avatarUrl,
      },
      currentRound: 1,
      totalRounds,
      rounds: Array.from({ length: totalRounds }).map((_, idx) => ({
        roundNumber: idx + 1,
        title: `Round ${idx + 1}: Arena Challenge`,
        durationSeconds: 180,
        status: 'upcoming',
        votesHostA: 0,
        votesHostB: 0,
        votesDraw: 0,
      })),
      scheduledAt,
      durationMinutes: totalRounds * 15,
      totalVotes: 0,
      audienceCount: 0,
      linkedTrustRoomId,
      createdAt: new Date().toISOString(),
      comments: [],
    };

    this.battles.unshift(newBattle);
    this.notify();
    return newBattle;
  }

  public respondToInvite(battleId: string, accept: boolean): void {
    const battle = this.getBattleById(battleId);
    if (!battle) return;

    if (accept) {
      battle.state = 'SCHEDULED';
      battle.hostB.status = 'ready';
    } else {
      battle.state = 'CANCELLED';
    }
    this.notify();
  }

  public startBattle(battleId: string): void {
    const battle = this.getBattleById(battleId);
    if (!battle) return;

    battle.state = 'ROUND_ACTIVE';
    battle.currentRound = 1;
    if (battle.rounds.length > 0) {
      battle.rounds[0].status = 'active';
    }
    battle.hostA.status = 'streaming';
    battle.hostB.status = 'streaming';
    this.notify();
  }

  public submitVote(battleId: string, target: VoteTarget): void {
    const battle = this.getBattleById(battleId);
    if (!battle) return;

    // Weight calculation based on user trust score (e.g. 98 trust = 2x weight)
    const weight = MOCK_CURRENT_USER.trustScore > 90 ? 2 : 1;

    battle.myVote = target;
    battle.voteWeight = weight;

    if (target === 'HOST_A') {
      battle.hostA.votesCount += 1;
      battle.hostA.weightedVotes += weight;
      battle.hostA.score += weight * 10;
    } else if (target === 'HOST_B') {
      battle.hostB.votesCount += 1;
      battle.hostB.weightedVotes += weight;
      battle.hostB.score += weight * 10;
    }

    battle.totalVotes += 1;

    // Update active round votes
    const activeRound = battle.rounds.find((r) => r.roundNumber === battle.currentRound);
    if (activeRound) {
      if (target === 'HOST_A') activeRound.votesHostA += 1;
      if (target === 'HOST_B') activeRound.votesHostB += 1;
      if (target === 'DRAW') activeRound.votesDraw += 1;
    }

    this.notify();
  }

  public completeRound(battleId: string): void {
    const battle = this.getBattleById(battleId);
    if (!battle) return;

    const currentR = battle.rounds.find((r) => r.roundNumber === battle.currentRound);
    if (currentR) {
      currentR.status = 'completed';
      if (currentR.votesHostA > currentR.votesHostB) {
        currentR.winner = 'HOST_A';
      } else if (currentR.votesHostB > currentR.votesHostA) {
        currentR.winner = 'HOST_B';
      } else {
        currentR.winner = 'DRAW';
      }
    }

    if (battle.currentRound < battle.totalRounds) {
      battle.state = 'ROUND_COMPLETE';
    } else {
      battle.state = 'FINISHED';
      if (battle.hostA.score > battle.hostB.score) {
        battle.winner = 'HOST_A';
      } else if (battle.hostB.score > battle.hostA.score) {
        battle.winner = 'HOST_B';
      } else {
        battle.winner = 'DRAW';
      }
    }

    this.notify();
  }

  public nextRound(battleId: string): void {
    const battle = this.getBattleById(battleId);
    if (!battle) return;

    if (battle.currentRound < battle.totalRounds) {
      battle.currentRound += 1;
      battle.state = 'ROUND_ACTIVE';
      const nextR = battle.rounds.find((r) => r.roundNumber === battle.currentRound);
      if (nextR) nextR.status = 'active';
      this.notify();
    }
  }

  public addComment(battleId: string, text: string, target?: VoteTarget): void {
    const battle = this.getBattleById(battleId);
    if (!battle) return;

    const newComment: BattleComment = {
      id: `c_${Date.now()}`,
      author: MOCK_CURRENT_USER,
      text,
      target,
      createdAt: new Date().toISOString(),
    };

    battle.comments.unshift(newComment);
    this.notify();
  }
}

export const BattleService = new BattleServiceImpl();
