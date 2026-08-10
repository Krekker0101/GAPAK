/**
 * GAPAK Battles Subcomponent: BattleDetail
 * Cinematic 1v1 Creator Battle Arena with Split Feeds, Realtime State Machine,
 * Audience Voting Engine, Motion System, and Trust Room Integration.
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Swords,
  Radio,
  Clock,
  Award,
  Users,
  Flame,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Lock,
  Play,
  Check,
  Send,
  Video,
  Mic,
  MicOff,
  Volume2,
} from 'lucide-react';
import { Battle, BattleState, VoteTarget } from '../../../shared/types/battles';
import { BattleService } from './BattleService';
import { Avatar, Badge, Button } from '../../../shared/design-system/primitives';

interface BattleDetailProps {
  battleId: string;
  onBack: () => void;
  onNavigateToTrustRoom?: (roomId: string) => void;
}

export const BattleDetail: React.FC<BattleDetailProps> = ({
  battleId,
  onBack,
  onNavigateToTrustRoom,
}) => {
  const [battle, setBattle] = useState<Battle | undefined>(() =>
    BattleService.getBattleById(battleId)
  );
  const [commentInput, setCommentInput] = useState('');
  const [commentTarget, setCommentTarget] = useState<VoteTarget>('HOST_A');
  const [roundTimer, setRoundTimer] = useState(180);

  useEffect(() => {
    const unsub = BattleService.subscribe((battles) => {
      const updated = battles.find((b) => b.id === battleId);
      setBattle(updated);
    });
    return () => unsub();
  }, [battleId]);

  // Round countdown timer simulation when ROUND_ACTIVE
  useEffect(() => {
    if (battle?.state === 'ROUND_ACTIVE') {
      const timer = setInterval(() => {
        setRoundTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [battle?.state]);

  if (!battle) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-tertiary text-sm">Battle arena not found.</p>
        <Button onClick={onBack} variant="outline" size="sm">
          Return to Arena
        </Button>
      </div>
    );
  }

  const isLive = battle.state === 'LIVE' || battle.state === 'ROUND_ACTIVE' || battle.state === 'ROUND_COMPLETE';
  const totalHostVotes = battle.hostA.votesCount + battle.hostB.votesCount || 1;
  const pctA = Math.round((battle.hostA.votesCount / totalHostVotes) * 100);
  const pctB = 100 - pctA;

  const handleVote = (target: VoteTarget) => {
    BattleService.submitVote(battle.id, target);
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    BattleService.addComment(battle.id, commentInput.trim(), commentTarget);
    setCommentInput('');
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-app text-primary overflow-y-auto space-y-6 p-4 md:p-6 motion-safe:transition-all">
      {/* Top Navigation Header */}
      <div className="flex items-center justify-between border-b border-subtle pb-4">
        <div className="flex items-center gap-3">
          <Button onClick={onBack} variant="ghost" size="sm" className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-amber-400 animate-pulse" />
              <h1 className="text-lg font-extrabold text-primary">{battle.title}</h1>
            </div>
            <p className="text-xs text-tertiary mt-0.5">{battle.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="brand" size="sm" className="font-mono text-[10px] uppercase">
            {battle.category}
          </Badge>

          {isLive && (
            <Badge variant="danger" size="sm" className="flex items-center gap-1 font-bold animate-pulse">
              <Radio className="w-3 h-3" />
              <span>ROUND {battle.currentRound} / {battle.totalRounds}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* STATE-SPECIFIC UX BANNERS */}

      {/* State 1: PENDING_RESPONSE */}
      {battle.state === 'PENDING_RESPONSE' && (
        <div className="p-5 rounded-[var(--radius-2xl)] bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-sm font-bold text-amber-300 flex items-center justify-center md:justify-start gap-2">
              <Clock className="w-4 h-4" />
              Challenge Invitation Pending Response
            </h3>
            <p className="text-xs text-secondary">
              Host B ({battle.hostB.user.displayName}) has been invited to accept this 1v1 Arena challenge.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => BattleService.respondToInvite(battle.id, true)}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Accept Challenge
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => BattleService.respondToInvite(battle.id, false)}
              leftIcon={<XCircle className="w-4 h-4" />}
            >
              Decline
            </Button>
          </div>
        </div>
      )}

      {/* State 2: ACCEPTED / SCHEDULED */}
      {(battle.state === 'SCHEDULED' || battle.state === 'ACCEPTED') && (
        <div className="p-5 rounded-[var(--radius-2xl)] bg-indigo-500/10 border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-sm font-bold text-indigo-300 flex items-center justify-center md:justify-start gap-2">
              <Clock className="w-4 h-4" />
              Battle Accepted & Scheduled
            </h3>
            <p className="text-xs text-secondary">
              Scheduled for {new Date(battle.scheduledAt).toLocaleString()}.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => BattleService.startBattle(battle.id)}
            leftIcon={<Play className="w-4 h-4" />}
          >
            Launch Arena Stream Now
          </Button>
        </div>
      )}

      {/* State 3: ROUND_COMPLETE */}
      {battle.state === 'ROUND_COMPLETE' && (
        <div className="p-5 rounded-[var(--radius-2xl)] bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-sm font-bold text-amber-300 flex items-center justify-center md:justify-start gap-2">
              <Award className="w-4 h-4" />
              Round {battle.currentRound} Intermission Complete
            </h3>
            <p className="text-xs text-secondary">
              Review round scores and prepare for Round {battle.currentRound + 1}.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => BattleService.nextRound(battle.id)}
            leftIcon={<Play className="w-4 h-4" />}
          >
            Start Round {battle.currentRound + 1}
          </Button>
        </div>
      )}

      {/* State 4: FINISHED */}
      {battle.state === 'FINISHED' && (
        <div className="p-6 rounded-[var(--radius-2xl)] bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-rose-500/20 border border-amber-500/40 text-center space-y-3">
          <Award className="w-10 h-10 text-amber-400 mx-auto animate-bounce" />
          <h2 className="text-xl font-extrabold text-amber-300">
            Battle Concluded: Winner {battle.winner === 'HOST_A' ? battle.hostA.user.displayName : battle.winner === 'HOST_B' ? battle.hostB.user.displayName : 'DRAW'}!
          </h2>
          <p className="text-xs text-secondary max-w-lg mx-auto">
            Final Scores — {battle.hostA.user.displayName}: {battle.hostA.score} pts vs {battle.hostB.user.displayName}: {battle.hostB.score} pts.
          </p>

          {battle.linkedTrustRoomId && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToTrustRoom?.(battle.linkedTrustRoomId!)}
                leftIcon={<Lock className="w-4 h-4 text-emerald-400" />}
              >
                Join Post-Battle VIP Trust Room
              </Button>
            </div>
          )}
        </div>
      )}

      {/* CINEMATIC SPLIT ARENA VIEW (DESKTOP & MOBILE RESPONSIVE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Host A Arena Side */}
        <div className="lg:col-span-5 relative group rounded-[var(--radius-3xl)] overflow-hidden border-2 border-indigo-500/40 bg-surface shadow-token-lg">
          <div className="aspect-video relative bg-app flex items-center justify-center overflow-hidden">
            <img
              src={battle.hostA.videoFeedUrl || battle.hostA.avatarUrl || battle.hostA.user.avatarUrl}
              alt={battle.hostA.user.displayName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40" />

            {/* Top Host Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <Badge variant="brand" size="sm" className="font-bold flex items-center gap-1">
                <Video className="w-3 h-3" />
                <span>HOST A</span>
              </Badge>
              <span className="px-2 py-0.5 rounded-[var(--radius-pill)] bg-black/60 text-indigo-300 text-[10px] font-mono font-bold">
                {battle.hostA.status.toUpperCase()}
              </span>
            </div>

            {/* Bottom Info Bar */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar
                  src={battle.hostA.avatarUrl || battle.hostA.user.avatarUrl}
                  alt={battle.hostA.user.displayName}
                  size="sm"
                />
                <div>
                  <p className="text-xs font-bold text-white">{battle.hostA.user.displayName}</p>
                  <p className="text-[10px] text-indigo-300 font-mono font-bold">
                    {battle.hostA.score} Pts • {battle.hostA.votesCount} Votes
                  </p>
                </div>
              </div>

              <div className="text-right font-mono font-extrabold text-indigo-400 text-lg">
                {pctA}%
              </div>
            </div>
          </div>
        </div>

        {/* Center Stage VS & Timer Indicator */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center space-y-3 py-2">
          <div className="relative">
            <div className="w-14 h-14 rounded-[var(--radius-pill)] bg-gradient-to-br from-indigo-500 via-amber-500 to-rose-500 p-0.5 shadow-token-lg animate-pulse">
              <div className="w-full h-full rounded-[var(--radius-pill)] bg-app flex items-center justify-center text-amber-400 font-black text-lg tracking-wider">
                VS
              </div>
            </div>
          </div>

          {/* Round Timer */}
          {battle.state === 'ROUND_ACTIVE' && (
            <div className="text-center space-y-0.5">
              <p className="text-[10px] font-mono font-bold text-tertiary uppercase tracking-widest">
                Round {battle.currentRound} Timer
              </p>
              <div className="text-2xl font-mono font-extrabold text-amber-400 bg-surface px-3 py-1 rounded-[var(--radius-xl)] border border-amber-500/30">
                {formatTimer(roundTimer)}
              </div>
            </div>
          )}

          {/* Host Action to Complete Round */}
          {battle.state === 'ROUND_ACTIVE' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => BattleService.completeRound(battle.id)}
              className="text-[11px] font-bold"
            >
              Complete Round
            </Button>
          )}
        </div>

        {/* Host B Arena Side */}
        <div className="lg:col-span-5 relative group rounded-[var(--radius-3xl)] overflow-hidden border-2 border-rose-500/40 bg-surface shadow-token-lg">
          <div className="aspect-video relative bg-app flex items-center justify-center overflow-hidden">
            <img
              src={battle.hostB.videoFeedUrl || battle.hostB.avatarUrl || battle.hostB.user.avatarUrl}
              alt={battle.hostB.user.displayName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40" />

            {/* Top Host Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <Badge variant="danger" size="sm" className="font-bold flex items-center gap-1">
                <Video className="w-3 h-3" />
                <span>HOST B</span>
              </Badge>
              <span className="px-2 py-0.5 rounded-[var(--radius-pill)] bg-black/60 text-rose-300 text-[10px] font-mono font-bold">
                {battle.hostB.status.toUpperCase()}
              </span>
            </div>

            {/* Bottom Info Bar */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar
                  src={battle.hostB.avatarUrl || battle.hostB.user.avatarUrl}
                  alt={battle.hostB.user.displayName}
                  size="sm"
                />
                <div>
                  <p className="text-xs font-bold text-white">{battle.hostB.user.displayName}</p>
                  <p className="text-[10px] text-rose-300 font-mono font-bold">
                    {battle.hostB.score} Pts • {battle.hostB.votesCount} Votes
                  </p>
                </div>
              </div>

              <div className="text-right font-mono font-extrabold text-rose-400 text-lg">
                {pctB}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* REALTIME VOTING CONTROL PANEL */}
      <div className="p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-extrabold text-primary">Audience Realtime Voting Engine</h3>
          </div>

          <div className="flex items-center gap-2 text-xs text-tertiary">
            <span>Your Vote Weight:</span>
            <span className="px-2 py-0.5 rounded-[var(--radius-md)] bg-indigo-500/20 text-indigo-300 font-mono font-bold">
              {battle.voteWeight || 2}x Weighted
            </span>
          </div>
        </div>

        {/* Voting Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleVote('HOST_A')}
            className={`p-3.5 rounded-[var(--radius-xl)] border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
              battle.myVote === 'HOST_A'
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-token-lg shadow-indigo-500/20'
                : 'bg-app border-subtle text-secondary hover:border-indigo-500/50'
            }`}
          >
            {battle.myVote === 'HOST_A' && <Check className="w-4 h-4 text-emerald-400" />}
            <span>Vote {battle.hostA.user.displayName} (A)</span>
          </button>

          <button
            type="button"
            onClick={() => handleVote('DRAW')}
            className={`p-3.5 rounded-[var(--radius-xl)] border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
              battle.myVote === 'DRAW'
                ? 'bg-amber-600 border-amber-400 text-white shadow-token-lg shadow-amber-500/20'
                : 'bg-app border-subtle text-secondary hover:border-amber-500/50'
            }`}
          >
            {battle.myVote === 'DRAW' && <Check className="w-4 h-4 text-emerald-400" />}
            <span>Vote Draw / Equal</span>
          </button>

          <button
            type="button"
            onClick={() => handleVote('HOST_B')}
            className={`p-3.5 rounded-[var(--radius-xl)] border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
              battle.myVote === 'HOST_B'
                ? 'bg-rose-600 border-rose-400 text-white shadow-token-lg shadow-rose-500/20'
                : 'bg-app border-subtle text-secondary hover:border-rose-500/50'
            }`}
          >
            {battle.myVote === 'HOST_B' && <Check className="w-4 h-4 text-emerald-400" />}
            <span>Vote {battle.hostB.user.displayName} (B)</span>
          </button>
        </div>

        {/* Live Bar */}
        <div className="space-y-1 pt-2">
          <div className="h-3 w-full bg-app rounded-[var(--radius-pill)] overflow-hidden flex border border-subtle">
            <div style={{ width: `${pctA}%` }} className="bg-indigo-500 transition-all duration-300" />
            <div style={{ width: `${pctB}%` }} className="bg-rose-500 transition-all duration-300" />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-tertiary">
            <span>{pctA}% Host A</span>
            <span>{battle.totalVotes} Total Votes Cast</span>
            <span>{pctB}% Host B</span>
          </div>
        </div>
      </div>

      {/* BOTTOM LAYOUT: LIVE CHAT & ROUNDS BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Live Audience Chat */}
        <div className="lg:col-span-7 bg-surface p-4 rounded-[var(--radius-2xl)] border border-subtle space-y-3 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            Live Arena Audience Chat ({battle.comments.length})
          </h3>

          <div className="space-y-2 overflow-y-auto max-h-[260px] p-1">
            {battle.comments.map((c) => (
              <div key={c.id} className="p-2.5 rounded-[var(--radius-xl)] bg-app border border-subtle space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar src={c.author.avatarUrl} alt={c.author.displayName} size="sm" />
                    <span className="text-xs font-bold text-primary">{c.author.displayName}</span>
                    {c.target && (
                      <Badge
                        variant={c.target === 'HOST_A' ? 'brand' : 'danger'}
                        size="sm"
                        className="text-[9px]"
                      >
                        Team {c.target === 'HOST_A' ? 'A' : 'B'}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted">
                    {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-secondary pl-8">{c.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendComment} className="flex gap-2 pt-2 border-t border-subtle">
            <select
              value={commentTarget}
              onChange={(e) => setCommentTarget(e.target.value as VoteTarget)}
              className="bg-app border border-subtle rounded-[var(--radius-xl)] px-2 py-1 text-xs text-secondary outline-none"
            >
              <option value="HOST_A">Team A</option>
              <option value="HOST_B">Team B</option>
            </select>
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Send live arena comment..."
              className="flex-1 bg-app border border-subtle rounded-[var(--radius-xl)] px-3 py-2 text-xs text-primary placeholder-slate-500 outline-none"
            />
            <Button type="submit" variant="primary" size="sm">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>

        {/* Rounds Breakdown & Linked Trust Room */}
        <div className="lg:col-span-5 bg-surface p-4 rounded-[var(--radius-2xl)] border border-subtle space-y-4">
          <h3 className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
            <Award className="w-4 h-4 text-amber-400" />
            Arena Rounds Schedule ({battle.rounds.length})
          </h3>

          <div className="space-y-2">
            {battle.rounds.map((r) => (
              <div
                key={r.roundNumber}
                className={`p-3 rounded-[var(--radius-xl)] border flex items-center justify-between text-xs ${
                  r.status === 'active'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 font-bold'
                    : 'bg-app border-subtle text-tertiary'
                }`}
              >
                <div>
                  <p className="font-bold text-primary">
                    Round {r.roundNumber}: {r.title}
                  </p>
                  <p className="text-[10px] text-muted">{r.durationSeconds}s Duration</p>
                </div>

                <Badge
                  variant={
                    r.status === 'active'
                      ? 'warning'
                      : r.status === 'completed'
                      ? 'success'
                      : 'neutral'
                  }
                  size="sm"
                  className="font-mono text-[10px]"
                >
                  {r.winner ? `Winner: ${r.winner}` : r.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>

          {battle.linkedTrustRoomId && (
            <div className="p-3 rounded-[var(--radius-xl)] bg-indigo-500/10 border border-indigo-500/20 space-y-2">
              <p className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Linked VIP Trust Room Enclave
              </p>
              <p className="text-[11px] text-tertiary">
                Exclusive high-trust space linked to this battle for backstage debates.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToTrustRoom?.(battle.linkedTrustRoomId!)}
                className="w-full text-xs font-bold"
              >
                Open Trust Room
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
