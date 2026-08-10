/**
 * GAPAK Trust Rooms Subcomponent: TrustRoomCard
 * High-trust visual representation with security indicators, privacy badges, and retention policy.
 */

import React from 'react';
import {
  Lock,
  EyeOff,
  ShieldCheck,
  Users,
  Clock,
  Key,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { TrustRoom } from '../../../shared/types/trustRooms';
import { Badge } from '../../../shared/design-system/primitives';

interface TrustRoomCardProps {
  room: TrustRoom;
  onSelect: (roomId: string) => void;
}

export const TrustRoomCard: React.FC<TrustRoomCardProps> = ({ room, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(room.id)}
      className="group relative cursor-pointer rounded-[var(--radius-2xl)] border border-subtle bg-surface-glass hover:bg-surface hover:border-indigo-500/50 p-5 transition-all duration-200 shadow-token-md hover:shadow-token-lg hover:shadow-indigo-500/5 flex flex-col justify-between overflow-hidden"
    >
      {/* Top Security Gradient Accent */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          room.privacy === 'SECRET'
            ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500'
            : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-500'
        }`}
      />

      <div className="space-y-4">
        {/* Header Badges Bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {room.privacy === 'SECRET' ? (
              <Badge variant="danger" size="sm" className="flex items-center gap-1 font-bold">
                <EyeOff className="w-3 h-3" />
                <span>SECRET</span>
              </Badge>
            ) : (
              <Badge variant="brand" size="sm" className="flex items-center gap-1 font-bold">
                <Lock className="w-3 h-3" />
                <span>PRIVATE</span>
              </Badge>
            )}

            <Badge variant="neutral" size="sm" className="text-[10px] uppercase font-mono tracking-wider">
              {room.accessMode.replace('_', ' ')}
            </Badge>
          </div>

          <div className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{room.securityScore}% TRUST</span>
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <h3 className="text-base font-extrabold text-primary group-hover:text-indigo-400 transition-colors line-clamp-1">
            {room.title}
          </h3>
          <p className="text-xs text-tertiary mt-1 line-clamp-2 leading-relaxed">
            {room.description}
          </p>
        </div>

        {/* Security Policies Chips */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-subtle">
          <div className="flex items-center gap-1.5 text-[11px] text-tertiary">
            <Key className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">
              2FA: {room.settings.requireTwoFactor ? 'Enforced' : 'Optional'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-tertiary">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Purge: {room.settings.messageRetention}</span>
          </div>
        </div>
      </div>

      {/* Footer Info & Action */}
      <div className="mt-4 pt-3 border-t border-subtle flex items-center justify-between text-xs text-tertiary">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-secondary font-medium">
            <Users className="w-3.5 h-3.5 text-tertiary" />
            {room.memberCount} Members
          </span>

          {room.currentUserRole && (
            <span className="px-2 py-0.5 rounded-[var(--radius-md)] bg-surface-muted text-indigo-300 font-mono text-[10px] font-bold">
              {room.currentUserRole}
            </span>
          )}
        </div>

        <div className="flex items-center text-indigo-400 group-hover:translate-x-1 transition-transform text-xs font-bold">
          <span>Enter Workspace</span>
          <ChevronRight className="w-4 h-4 ml-0.5" />
        </div>
      </div>
    </div>
  );
};
