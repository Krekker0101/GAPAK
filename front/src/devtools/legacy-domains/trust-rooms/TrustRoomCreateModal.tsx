/**
 * GAPAK Trust Rooms Subcomponent: TrustRoomCreateModal
 * Modal to configure high-trust spaces with privacy policies and 2FA requirements.
 */

import React, { useState } from 'react';
import { ShieldCheck, Lock, EyeOff, Key, Clock, ShieldAlert, Plus } from 'lucide-react';
import { TrustRoomPrivacy, TrustRoomAccessMode, MessageRetentionMode } from '../../../shared/types/trustRooms';
import { Dialog, Input, Textarea, Select, Switch, Button } from '../../../shared/design-system/primitives';
import { TrustRoomService } from './TrustRoomService';

interface TrustRoomCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (roomId: string) => void;
}

export const TrustRoomCreateModal: React.FC<TrustRoomCreateModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<TrustRoomPrivacy>('SECRET');
  const [accessMode, setAccessMode] = useState<TrustRoomAccessMode>('OWNER_APPROVAL');
  const [requireTwoFactor, setRequireTwoFactor] = useState(true);
  const [minAccountAgeDays, setMinAccountAgeDays] = useState(90);
  const [messageRetention, setMessageRetention] = useState<MessageRetentionMode>('24h');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const room = TrustRoomService.createRoom(
        title.trim(),
        description.trim(),
        privacy,
        accessMode,
        requireTwoFactor,
        Number(minAccountAgeDays),
        messageRetention
      );
      setIsSubmitting(false);
      onClose();
      onRoomCreated(room.id);
    }, 400);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Initialize High-Trust Room" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title & Description */}
        <Input
          label="Trust Room Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Core Architecture & Key Governance Enclave"
          required
        />

        <Textarea
          label="Purpose & Governance Statement"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the objective, access guidelines, and expectations for members..."
          rows={3}
        />

        {/* Privacy & Access Mode Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Privacy Mode"
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as TrustRoomPrivacy)}
            options={[
              { value: 'SECRET', label: 'SECRET (Zero-Knowledge / Hidden)' },
              { value: 'PRIVATE', label: 'PRIVATE (Encrypted / Invite Only)' },
            ]}
            helperText="Secret rooms are unsearchable to unauthorized users."
          />

          <Select
            label="Access Policy"
            value={accessMode}
            onChange={(e) => setAccessMode(e.target.value as TrustRoomAccessMode)}
            options={[
              { value: 'OWNER_APPROVAL', label: 'Owner Approval Required' },
              { value: 'REQUEST', label: 'Request & Vetting' },
              { value: 'INVITE_ONLY', label: 'Strict Invite Only' },
            ]}
          />
        </div>

        {/* Security Enforcements */}
        <div className="p-4 rounded-[var(--radius-xl)] border border-subtle bg-surface-glass space-y-3">
          <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Security & Compliance Enforcements
          </h4>

          {/* 2FA Switch */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                Enforce Two-Factor Authentication (2FA)
              </p>
              <p className="text-[11px] text-tertiary">
                Only users with hardware/app-backed 2FA can enter
              </p>
            </div>
            <Switch checked={requireTwoFactor} onChange={setRequireTwoFactor} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-subtle">
            <Select
              label="Minimum Account Age"
              value={String(minAccountAgeDays)}
              onChange={(e) => setMinAccountAgeDays(Number(e.target.value))}
              options={[
                { value: '0', label: 'No Restriction' },
                { value: '30', label: 'At least 30 Days' },
                { value: '90', label: 'At least 90 Days' },
                { value: '180', label: 'At least 180 Days' },
              ]}
            />

            <Select
              label="Message Retention Policy"
              value={messageRetention}
              onChange={(e) => setMessageRetention(e.target.value as MessageRetentionMode)}
              options={[
                { value: '24h', label: 'Auto-Purge after 24 Hours' },
                { value: '7d', label: 'Auto-Purge after 7 Days' },
                { value: '30d', label: 'Auto-Purge after 30 Days' },
                { value: 'burn_on_read', label: 'Burn on Read' },
                { value: 'forever', label: 'Permanent Encrypted Retention' },
              ]}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
          <Button variant="ghost" onClick={onClose} type="button" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Trust Room
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
