/**
 * GAPAK Connections & Trusted Circle Management View
 */

import React, { useState } from 'react';
import { UserCheck, UserX, Star, Users, Search, ShieldCheck, UserPlus, Check, X } from 'lucide-react';
import { UserProfile, ConnectionRequest, ExtendedUserProfile } from '../../shared/types';
import { Avatar, Button, Badge } from '../../shared/design-system/primitives';
import { useToast } from '../../shared/ux/ToastContext';

interface ConnectionsViewProps {
  currentUser: UserProfile;
  requests: ConnectionRequest[];
  sampleUsers: ExtendedUserProfile[];
  onAcceptRequest: (reqId: string) => void;
  onRejectRequest: (reqId: string) => void;
  onToggleTrustedCircle: (userId: string) => void;
  onUserClick?: (userId: string) => void;
}

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  currentUser,
  requests,
  sampleUsers,
  onAcceptRequest,
  onRejectRequest,
  onToggleTrustedCircle,
  onUserClick,
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'requests' | 'connections' | 'trusted_circle'>('requests');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title & Header */}
      <div className="p-6 rounded-[var(--radius-3xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface shadow-token-sm space-y-2">
        <h2 className="text-xl font-bold text-primary dark:text-primary flex items-center space-x-2">
          <Users className="w-5 h-5 text-indigo-500" />
          <span>Connections & Trusted Circle</span>
        </h2>
        <p className="text-xs text-muted dark:text-tertiary">
          Manage direct encrypted contacts, incoming access requests, and your confidential Trusted Circle.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-subtle dark:border-subtle pb-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-[var(--radius-xl)] text-xs font-semibold transition ${
            activeTab === 'requests'
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-surface dark:bg-surface text-secondary dark:text-secondary'
          }`}
        >
          <span>Requests</span>
          {requests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-[var(--radius-pill)] text-[10px] font-bold bg-rose-500 text-white">
              {requests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('connections')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-[var(--radius-xl)] text-xs font-semibold transition ${
            activeTab === 'connections'
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-surface dark:bg-surface text-secondary dark:text-secondary'
          }`}
        >
          <span>All Connections</span>
        </button>

        <button
          onClick={() => setActiveTab('trusted_circle')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-[var(--radius-xl)] text-xs font-semibold transition ${
            activeTab === 'trusted_circle'
              ? 'bg-amber-500 text-white shadow'
              : 'bg-surface dark:bg-surface text-secondary dark:text-secondary'
          }`}
        >
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>Trusted Circle</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {requests.length > 0 ? (
            requests.map((req) => {
              const reqUser = req.sender || req.fromUser;
              if (!reqUser) return null;
              return (
                <div
                  key={req.id}
                  className="p-4 rounded-[var(--radius-2xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface shadow-token-sm flex items-center justify-between"
                >
                  <div
                    className="flex items-center space-x-3 cursor-pointer"
                    onClick={() => onUserClick?.(reqUser.id)}
                  >
                    <Avatar
                      src={reqUser.avatarUrl}
                      alt={reqUser.displayName || 'User'}
                      fallback={reqUser.displayName ? reqUser.displayName[0] : 'U'}
                      size="lg"
                    />
                    <div>
                      <h4 className="font-semibold text-sm text-primary dark:text-primary">
                        {reqUser.displayName || 'Unknown User'}
                      </h4>
                      <span className="text-xs text-muted">@{reqUser.username || 'user'}</span>
                      {req.note && <p className="text-xs text-secondary dark:text-tertiary mt-1">{req.note}</p>}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        onAcceptRequest(req.id);
                        addToast(`Accepted connection request from @${reqUser.username || 'user'}`, 'success');
                      }}
                      className="flex items-center space-x-1 text-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>Accept</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onRejectRequest(req.id);
                        addToast(`Rejected request from @${reqUser.username || 'user'}`, 'info');
                      }}
                      className="flex items-center space-x-1 text-xs"
                    >
                      <X className="w-4 h-4" />
                      <span>Decline</span>
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center border border-subtle dark:border-subtle rounded-[var(--radius-3xl)] bg-surface dark:bg-surface text-muted text-xs">
              No pending connection requests.
            </div>
          )}
        </div>
      )}

      {activeTab === 'connections' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sampleUsers.map((usr) => (
            <div
              key={usr.id}
              className="p-4 rounded-[var(--radius-2xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface shadow-token-sm flex items-center justify-between"
            >
              <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onUserClick?.(usr.id)}>
                <Avatar src={usr.avatarUrl} alt={usr.displayName} fallback={usr.displayName[0]} size="md" />
                <div>
                  <h4 className="font-semibold text-xs text-primary dark:text-primary">{usr.displayName}</h4>
                  <span className="text-[11px] text-muted">@{usr.username}</span>
                </div>
              </div>

              <button
                onClick={() => onToggleTrustedCircle(usr.id)}
                className={`p-2 rounded-[var(--radius-xl)] text-xs font-semibold transition flex items-center space-x-1 ${
                  usr.isInTrustedCircle
                    ? 'bg-amber-500 text-white'
                    : 'bg-surface-subtle dark:bg-surface-muted text-secondary dark:text-secondary'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${usr.isInTrustedCircle ? 'fill-white' : ''}`} />
                <span>{usr.isInTrustedCircle ? 'Trusted' : 'Circle'}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'trusted_circle' && (
        <div className="space-y-3">
          <div className="p-4 rounded-[var(--radius-2xl)] bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
            Contacts in your Trusted Circle can view restricted confidential posts, expiring media, and direct stories.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sampleUsers
              .filter((u) => u.isInTrustedCircle)
              .map((usr) => (
                <div
                  key={usr.id}
                  className="p-4 rounded-[var(--radius-2xl)] border border-amber-200 dark:border-amber-900/40 bg-surface dark:bg-surface shadow-token-sm flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onUserClick?.(usr.id)}>
                    <Avatar src={usr.avatarUrl} alt={usr.displayName} fallback={usr.displayName[0]} size="md" />
                    <div>
                      <h4 className="font-semibold text-xs text-primary dark:text-primary">{usr.displayName}</h4>
                      <span className="text-[11px] text-muted">@{usr.username}</span>
                    </div>
                  </div>

                  <Badge variant="accent" className="bg-amber-500 text-white border-none text-[10px]">
                    Trusted
                  </Badge>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
