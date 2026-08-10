/**
 * GAPAK Battles Top-Level Domain View
 * Phase 5 - Cinematic 1v1 Creator Arena
 */

import React, { useState, useEffect } from 'react';
import { Swords, Plus, Search, Flame, Radio, Clock, Award, Shield } from 'lucide-react';
import { Battle, BattleState } from '../../../shared/types/battles';
import { BattleService } from './BattleService';
import { BattleCard } from './BattleCard';
import { BattleDetail } from './BattleDetail';
import { CreateBattleModal } from './CreateBattleModal';
import { Button } from '../../../shared/design-system/primitives';

interface BattleViewProps {
  onNavigateToTrustRoom?: (roomId: string) => void;
}

export const BattleView: React.FC<BattleViewProps> = ({ onNavigateToTrustRoom }) => {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<'ALL' | 'LIVE' | 'SCHEDULED' | 'PENDING' | 'FINISHED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const unsub = BattleService.subscribe(setBattles);
    return () => unsub();
  }, []);

  const filteredBattles = battles.filter((b) => {
    let matchesState = true;
    if (stateFilter === 'LIVE') matchesState = b.state === 'LIVE' || b.state === 'ROUND_ACTIVE' || b.state === 'ROUND_COMPLETE';
    if (stateFilter === 'SCHEDULED') matchesState = b.state === 'SCHEDULED' || b.state === 'ACCEPTED';
    if (stateFilter === 'PENDING') matchesState = b.state === 'PENDING_RESPONSE';
    if (stateFilter === 'FINISHED') matchesState = b.state === 'FINISHED';

    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.hostA.user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.hostB.user.displayName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesState && matchesSearch;
  });

  if (selectedBattleId) {
    return (
      <BattleDetail
        battleId={selectedBattleId}
        onBack={() => setSelectedBattleId(null)}
        onNavigateToTrustRoom={onNavigateToTrustRoom}
      />
    );
  }

  return (
    <div className="h-full bg-app text-primary flex flex-col overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-extrabold tracking-tight text-primary">
              GAPAK Creator Battles & Arena
            </h1>
          </div>
          <p className="text-xs text-tertiary mt-1">
            Realtime 1v1 creator competitions, weighted audience voting, and cinematic arena stages
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          variant="primary"
          className="flex items-center gap-1.5 text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>Launch 1v1 Battle</span>
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3 rounded-[var(--radius-2xl)] border border-subtle">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search battles, hosts, tech topics, or categories..."
            className="w-full bg-app border border-subtle rounded-[var(--radius-xl)] pl-9 pr-3 py-2 text-xs text-primary placeholder-slate-500 outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {(['ALL', 'LIVE', 'SCHEDULED', 'PENDING', 'FINISHED'] as const).map((sf) => (
            <button
              key={sf}
              type="button"
              onClick={() => setStateFilter(sf)}
              className={`px-3 py-1.5 rounded-[var(--radius-xl)] text-xs font-semibold transition-colors ${
                stateFilter === sf
                  ? 'bg-amber-600 text-white'
                  : 'bg-app text-tertiary hover:text-primary'
              }`}
            >
              {sf}
            </button>
          ))}
        </div>
      </div>

      {/* Battle Cards Grid */}
      {filteredBattles.length === 0 ? (
        <div className="p-12 text-center bg-surface-glass border border-subtle rounded-[var(--radius-2xl)] space-y-2">
          <Swords className="w-10 h-10 text-secondary mx-auto" />
          <p className="font-bold text-sm text-secondary">No Battles Found</p>
          <p className="text-xs text-muted">
            Launch a new 1v1 Creator Battle or clear your active filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBattles.map((battle) => (
            <BattleCard
              key={battle.id}
              battle={battle}
              onSelect={(id) => setSelectedBattleId(id)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateBattleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onBattleCreated={(id) => setSelectedBattleId(id)}
      />
    </div>
  );
};
