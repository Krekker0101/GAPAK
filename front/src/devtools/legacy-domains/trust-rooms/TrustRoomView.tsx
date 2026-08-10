/**
 * GAPAK Trust Rooms Top-Level Domain View
 * Phase 5 - High-Trust Spaces & Governance Enclaves
 */

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Plus,
  Search,
  EyeOff,
  ShieldCheck,
  Shield,
  Users,
  Activity,
  Key,
} from 'lucide-react';
import { TrustRoom, TrustRoomPrivacy } from '../../../shared/types/trustRooms';
import { TrustRoomService } from './TrustRoomService';
import { TrustRoomCard } from './TrustRoomCard';
import { TrustRoomDetail } from './TrustRoomDetail';
import { TrustRoomCreateModal } from './TrustRoomCreateModal';
import { Button } from '../../../shared/design-system/primitives';

export const TrustRoomView: React.FC = () => {
  const [rooms, setRooms] = useState<TrustRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [privacyFilter, setPrivacyFilter] = useState<'ALL' | TrustRoomPrivacy>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const unsub = TrustRoomService.subscribe(setRooms);
    return () => unsub();
  }, []);

  const filteredRooms = rooms.filter((r) => {
    const matchesPrivacy = privacyFilter === 'ALL' || r.privacy === privacyFilter;
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPrivacy && matchesSearch;
  });

  if (selectedRoomId) {
    return (
      <TrustRoomDetail
        roomId={selectedRoomId}
        onBack={() => setSelectedRoomId(null)}
      />
    );
  }

  return (
    <div className="h-full bg-app text-primary flex flex-col overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-extrabold tracking-tight text-primary">
              GAPAK Trust Rooms & Governance Enclaves
            </h1>
          </div>
          <p className="text-xs text-tertiary mt-1">
            Private, high-trust spaces with end-to-end encryption, 2FA enforcement, and zero-knowledge privacy policies
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          variant="primary"
          className="flex items-center gap-1.5 text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>New Trust Room</span>
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3 rounded-[var(--radius-2xl)] border border-subtle">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search trust rooms, governance topics, or encryption policies..."
            className="w-full bg-app border border-subtle rounded-[var(--radius-xl)] pl-9 pr-3 py-2 text-xs text-primary placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {(['ALL', 'SECRET', 'PRIVATE'] as const).map((pf) => (
            <button
              key={pf}
              type="button"
              onClick={() => setPrivacyFilter(pf)}
              className={`px-3 py-1.5 rounded-[var(--radius-xl)] text-xs font-semibold transition-colors ${
                privacyFilter === pf
                  ? 'bg-indigo-600 text-white'
                  : 'bg-app text-tertiary hover:text-primary'
              }`}
            >
              {pf}
            </button>
          ))}
        </div>
      </div>

      {/* Rooms Grid */}
      {filteredRooms.length === 0 ? (
        <div className="p-12 text-center bg-surface-glass border border-subtle rounded-[var(--radius-2xl)] space-y-2">
          <Shield className="w-10 h-10 text-secondary mx-auto" />
          <p className="font-bold text-sm text-secondary">No Trust Rooms Found</p>
          <p className="text-xs text-muted">
            Create a new Trust Room or adjust your search filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => (
            <TrustRoomCard
              key={room.id}
              room={room}
              onSelect={(id) => setSelectedRoomId(id)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <TrustRoomCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onRoomCreated={(id) => setSelectedRoomId(id)}
      />
    </div>
  );
};
