/**
 * GAPAK Battles Subcomponent: CreateBattleModal
 * Form to launch 1v1 Creator Battles and issue opponent invitations.
 */

import React, { useState } from 'react';
import { Swords, Calendar, Users, ShieldCheck, Flame, Plus } from 'lucide-react';
import { Dialog, Input, Textarea, Select, Button } from '../../../shared/design-system/primitives';
import { BattleService } from './BattleService';
import { UserProfile } from '../../../shared/types';

interface CreateBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBattleCreated: (battleId: string) => void;
}

const SAMPLE_OPPONENTS: UserProfile[] = [
  {
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
  },
  {
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
  },
];

export const CreateBattleModal: React.FC<CreateBattleModalProps> = ({
  isOpen,
  onClose,
  onBattleCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('TECH & CODING');
  const [opponentId, setOpponentId] = useState(SAMPLE_OPPONENTS[0].id);
  const [totalRounds, setTotalRounds] = useState(3);
  const [scheduledAt, setScheduledAt] = useState('2026-08-09T18:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedOpponent = SAMPLE_OPPONENTS.find((u) => u.id === opponentId) || SAMPLE_OPPONENTS[0];

    setIsSubmitting(true);
    setTimeout(() => {
      const battle = BattleService.createBattle(
        title.trim(),
        description.trim(),
        category,
        selectedOpponent,
        totalRounds,
        new Date(scheduledAt).toISOString()
      );
      setIsSubmitting(false);
      onClose();
      onBattleCreated(battle.id);
    }, 400);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Issue 1v1 Arena Battle Challenge" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Battle Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., ZK Proofs vs Optimistic Rollups Speed Run"
          required
        />

        <Textarea
          label="Arena Challenge Rules & Overview"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Specify the criteria, evaluation metrics, and audience voting instructions..."
          rows={3}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { value: 'TECH & CODING', label: 'Tech & Coding' },
              { value: 'DESIGN & PRODUCT', label: 'Design & Product' },
              { value: 'AI & DATA', label: 'AI & Data' },
              { value: 'PROTOCOL DEBATE', label: 'Protocol Debate' },
            ]}
          />

          <Select
            label="Opponent (Host B)"
            value={opponentId}
            onChange={(e) => setOpponentId(e.target.value)}
            options={SAMPLE_OPPONENTS.map((op) => ({
              value: op.id,
              label: `${op.displayName} (@${op.username})`,
            }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Total Rounds"
            value={String(totalRounds)}
            onChange={(e) => setTotalRounds(Number(e.target.value))}
            options={[
              { value: '1', label: '1 Sudden Death Round' },
              { value: '3', label: '3 Standard Rounds' },
              { value: '5', label: '5 Championship Rounds' },
            ]}
          />

          <Input
            label="Scheduled Date & Time"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
          <Button variant="ghost" onClick={onClose} type="button" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            leftIcon={<Swords className="w-4 h-4" />}
          >
            Send Challenge Invitation
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
