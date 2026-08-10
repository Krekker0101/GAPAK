/**
 * GAPAK Battles Subcomponent: BattleCard
 * Visual representation of 1v1 Creator Battles with live scores and status badges.
 */

import React from 'react';
import { Flame, Radio, Clock, Award, Users, ChevronRight, Swords } from 'lucide-react';
import { Battle, BattleState } from '../../../shared/types/battles';
import { Avatar, Badge } from '../../../shared/design-system/primitives';

interface BattleCardProps {
  battle: Battle;
  onSelect: (battleId: string) => void;
}

export const BattleCard: React.FC<BattleCardProps> = ({ battle, onSelect }) => {
  const isLive = battle.state === 'LIVE' || battle.state === 'ROUND_ACTIVE' || battle.state === 'ROUND_COMPLETE';
  const totalHostVotes = battle.hostA.votesCount + battle.hostB.votesCount || 1;
  const pctA = Math.round((battle.hostA.votesCount / totalHostVotes) * 100);
  const pctB = 100 - pctA;

  const getStatusBadge = (state: BattleState) => {
    switch (state) {
      case 'ROUND_ACTIVE':
      case 'LIVE':
        return (
          <Badge variant="danger" size="sm" className="flex items-center gap-1 font-bold animate-pulse">
            <Radio className="w-3 h-3" />
            <span>LIVE ROUND {battle.currentRound}</span>
          </Badge>
        );
      case 'ROUND_COMPLETE':
        return (
          <Badge variant="warning" size="sm" className="flex items-center gap-1 font-bold">
            <Clock className="w-3 h-3" />
            <span>INTERMISSION</span>
          </Badge>
        );
      case 'SCHEDULED':
      case 'ACCEPTED':
        return (
          <Badge variant="brand" size="sm" className="flex items-center gap-1 font-bold">
            <Clock className="w-3 h-3" />
            <span>SCHEDULED</span>
          </Badge>
        );
      case 'PENDING_RESPONSE':
        return (
          <Badge variant="warning" size="sm" className="flex items-center gap-1 font-bold">
            <span>PENDING INVITE</span>
          </Badge>
        );
      case 'FINISHED':
        return (
          <Badge variant="success" size="sm" className="flex items-center gap-1 font-bold">
            <Award className="w-3 h-3" />
            <span>FINISHED</span>
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="neutral" size="sm">
            <span>CANCELLED</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            <span>{state}</span>
          </Badge>
        );
    }
  };

  return (
    <div
      onClick={() => onSelect(battle.id)}
      className="group relative cursor-pointer rounded-[var(--radius-2xl)] border border-subtle bg-surface-glass-strong hover:bg-surface hover:border-amber-500/50 p-5 transition-all duration-200 shadow-token-md hover:shadow-token-lg hover:shadow-amber-500/5 flex flex-col justify-between overflow-hidden"
    >
      {/* Top Accent Gradient Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-amber-500 to-rose-500" />

      <div className="space-y-4">
        {/* Header Category & Status */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="neutral" size="sm" className="text-[10px] font-mono tracking-wider font-bold">
            {battle.category}
          </Badge>
          {getStatusBadge(battle.state)}
        </div>

        {/* Title */}
        <h3 className="text-base font-extrabold text-primary group-hover:text-amber-400 transition-colors line-clamp-1">
          {battle.title}
        </h3>

        {/* 1v1 Hosts Matchup Arena */}
        <div className="p-3.5 rounded-[var(--radius-xl)] bg-app-glass border border-subtle flex items-center justify-between gap-2">
          {/* Host A */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Avatar
              src={battle.hostA.avatarUrl || battle.hostA.user.avatarUrl}
              alt={battle.hostA.user.displayName}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-primary truncate">
                {battle.hostA.user.displayName}
              </p>
              <p className="text-[10px] text-indigo-400 font-mono font-semibold">
                {battle.hostA.score} pts
              </p>
            </div>
          </div>

          {/* VS Emblem */}
          <div className="p-1.5 rounded-[var(--radius-pill)] bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0 flex items-center justify-center">
            <Swords className="w-4 h-4" />
          </div>

          {/* Host B */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end text-right">
            <div className="min-w-0">
              <p className="text-xs font-bold text-primary truncate">
                {battle.hostB.user.displayName}
              </p>
              <p className="text-[10px] text-rose-400 font-mono font-semibold">
                {battle.hostB.score} pts
              </p>
            </div>
            <Avatar
              src={battle.hostB.avatarUrl || battle.hostB.user.avatarUrl}
              alt={battle.hostB.user.displayName}
              size="md"
            />
          </div>
        </div>

        {/* Live Vote Progress Meter (if active or finished) */}
        {(isLive || battle.state === 'FINISHED') && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono font-bold text-tertiary">
              <span className="text-indigo-400">{pctA}%</span>
              <span>{battle.totalVotes} Votes</span>
              <span className="text-rose-400">{pctB}%</span>
            </div>

            <div className="h-2 w-full bg-app rounded-[var(--radius-pill)] overflow-hidden flex">
              <div
                style={{ width: `${pctA}%` }}
                className="bg-indigo-500 transition-all duration-300"
              />
              <div
                style={{ width: `${pctB}%` }}
                className="bg-rose-500 transition-all duration-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="mt-4 pt-3 border-t border-subtle flex items-center justify-between text-xs text-tertiary">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-medium text-secondary">
            <Users className="w-3.5 h-3.5 text-tertiary" />
            {battle.audienceCount} Live
          </span>
          <span className="font-mono text-[10px] text-tertiary">
            Round {battle.currentRound}/{battle.totalRounds}
          </span>
        </div>

        <div className="flex items-center text-amber-400 group-hover:translate-x-1 transition-transform font-bold text-xs">
          <span>Enter Arena</span>
          <ChevronRight className="w-4 h-4 ml-0.5" />
        </div>
      </div>
    </div>
  );
};
