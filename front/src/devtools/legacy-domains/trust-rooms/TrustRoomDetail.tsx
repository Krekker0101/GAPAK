/**
 * GAPAK Trust Rooms Subcomponent: TrustRoomDetail
 * Comprehensive Workspace with Security State, Permission-Aware Role System,
 * Encrypted Content Feed, Audit Log, and Settings.
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  EyeOff,
  Users,
  Clock,
  Key,
  Send,
  UserCheck,
  UserX,
  Shield,
  Activity,
  Settings,
  MessageSquare,
  AlertTriangle,
  Trash2,
  CheckCircle,
  XCircle,
  FileText,
} from 'lucide-react';
import {
  TrustRoom,
  TrustRoomRole,
  TrustRoomMember,
  MessageRetentionMode,
  TrustRoomPrivacy,
  TrustRoomAccessMode,
} from '../../../shared/types/trustRooms';
import { TrustRoomService, MOCK_CURRENT_USER } from './TrustRoomService';
import { Avatar, Badge, Button, Select, Switch } from '../../../shared/design-system/primitives';

interface TrustRoomDetailProps {
  roomId: string;
  onBack: () => void;
}

export const TrustRoomDetail: React.FC<TrustRoomDetailProps> = ({ roomId, onBack }) => {
  const [room, setRoom] = useState<TrustRoom | undefined>(() => TrustRoomService.getRoomById(roomId));
  const [activeTab, setActiveTab] = useState<'content' | 'members' | 'activity' | 'settings'>('content');
  const [messageInput, setMessageInput] = useState('');

  React.useEffect(() => {
    const unsub = TrustRoomService.subscribe((rooms) => {
      const updated = rooms.find((r) => r.id === roomId);
      setRoom(updated);
    });
    return () => unsub();
  }, [roomId]);

  if (!room) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-tertiary text-sm">Trust Room not found or deleted.</p>
        <Button onClick={onBack} variant="outline" size="sm">
          Return to List
        </Button>
      </div>
    );
  }

  const currentUserRole: TrustRoomRole = room.currentUserRole || 'MEMBER';
  const isOwner = currentUserRole === 'OWNER';
  const isAdmin = isOwner || currentUserRole === 'ADMIN';
  const isModerator = isAdmin || currentUserRole === 'MODERATOR';
  const isAuditor = currentUserRole === 'AUDITOR';

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isAuditor) return;

    TrustRoomService.sendMessage(room.id, messageInput.trim());
    setMessageInput('');
  };

  return (
    <div className="flex flex-col h-full bg-app text-primary overflow-y-auto space-y-6 p-4 md:p-6">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between border-b border-subtle pb-4">
        <div className="flex items-center gap-3">
          <Button onClick={onBack} variant="ghost" size="sm" className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-primary">{room.title}</h1>
              {room.privacy === 'SECRET' ? (
                <Badge variant="danger" size="sm" className="font-bold flex items-center gap-1">
                  <EyeOff className="w-3 h-3" />
                  <span>SECRET</span>
                </Badge>
              ) : (
                <Badge variant="brand" size="sm" className="font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>PRIVATE</span>
                </Badge>
              )}
            </div>
            <p className="text-xs text-tertiary mt-0.5">{room.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-xl)] bg-surface border border-subtle text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-mono font-bold text-emerald-400">{room.securityScore}% Trust</span>
          </div>

          <div className="px-3 py-1 rounded-[var(--radius-xl)] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold">
            Role: {currentUserRole}
          </div>
        </div>
      </div>

      {/* Security State Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-surface-glass-strong p-4 rounded-[var(--radius-2xl)] border border-subtle">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-[var(--radius-xl)] bg-indigo-500/10 text-indigo-400">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-tertiary">2FA Enforcement</p>
            <p className="text-xs font-bold text-primary">
              {room.settings.requireTwoFactor ? '2FA Required' : 'Optional'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-[var(--radius-xl)] bg-amber-500/10 text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-tertiary">Message Retention</p>
            <p className="text-xs font-bold text-primary">
              Purge ({room.settings.messageRetention})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-[var(--radius-xl)] bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-tertiary">Access Mode</p>
            <p className="text-xs font-bold text-primary">
              {room.accessMode.replace('_', ' ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-[var(--radius-xl)] bg-purple-500/10 text-purple-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-tertiary">Active Members</p>
            <p className="text-xs font-bold text-primary">{room.memberCount} Verified</p>
          </div>
        </div>
      </div>

      {/* Workspace Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-subtle pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2 rounded-[var(--radius-xl)] text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'content'
              ? 'bg-indigo-600 text-white shadow-token-lg'
              : 'bg-surface text-tertiary hover:text-primary'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Encrypted Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-[var(--radius-xl)] text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'members'
              ? 'bg-indigo-600 text-white shadow-token-lg'
              : 'bg-surface text-tertiary hover:text-primary'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Members & Roles ({room.memberCount})</span>
          {room.pendingRequests.length > 0 && isModerator && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-on-brand text-[10px] rounded-[var(--radius-pill)] font-bold">
              {room.pendingRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 rounded-[var(--radius-xl)] text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'activity'
              ? 'bg-indigo-600 text-white shadow-token-lg'
              : 'bg-surface text-tertiary hover:text-primary'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Audit Trail ({room.auditLogs.length})</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-[var(--radius-xl)] text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-token-lg'
                : 'bg-surface text-tertiary hover:text-primary'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Room Settings</span>
          </button>
        )}
      </div>

      {/* Tab 1: Encrypted Content Feed */}
      {activeTab === 'content' && (
        <div className="space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-3 overflow-y-auto max-h-[480px] p-2">
            {room.messages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 rounded-[var(--radius-2xl)] bg-surface border border-subtle space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      src={msg.author.avatarUrl}
                      alt={msg.author.displayName}
                      size="sm"
                    />
                    <div>
                      <p className="text-xs font-bold text-primary">
                        {msg.author.displayName}
                      </p>
                      <p className="text-[10px] text-muted">@{msg.author.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="brand" size="sm" className="text-[9px] font-mono">
                      E2EE Encrypted
                    </Badge>
                    <span className="text-[10px] text-muted">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-primary leading-relaxed font-sans">{msg.text}</p>
              </div>
            ))}
          </div>

          {/* Input Box / Auditor Mode */}
          {isAuditor ? (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-[var(--radius-xl)] text-center text-xs text-amber-300 font-semibold flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Auditor Mode: Read-Only Access. Communication input is restricted.</span>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex gap-2 bg-surface p-2 rounded-[var(--radius-2xl)] border border-subtle">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Send end-to-end encrypted message to trust room..."
                className="flex-1 bg-app border border-subtle rounded-[var(--radius-xl)] px-4 py-2.5 text-xs text-primary placeholder-slate-500 outline-none focus:border-indigo-500"
              />
              <Button type="submit" variant="primary" size="sm" leftIcon={<Send className="w-4 h-4" />}>
                Send
              </Button>
            </form>
          )}
        </div>
      )}

      {/* Tab 2: Members & Roles */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Pending Requests Queue */}
          {isModerator && room.pendingRequests.length > 0 && (
            <div className="p-4 rounded-[var(--radius-2xl)] bg-amber-500/10 border border-amber-500/20 space-y-3">
              <h3 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Pending Join Requests ({room.pendingRequests.length})
              </h3>

              <div className="space-y-2">
                {room.pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-[var(--radius-xl)] bg-surface border border-subtle"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={req.user.avatarUrl} alt={req.user.displayName} size="sm" />
                      <div>
                        <p className="text-xs font-bold text-primary">{req.user.displayName}</p>
                        <p className="text-[10px] text-tertiary">
                          Trust: {req.trustScore} • 2FA: {req.hasTwoFactor ? 'Active' : 'No'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-emerald-400 hover:bg-emerald-500/10 text-xs"
                        onClick={() => TrustRoomService.approveRequest(room.id, req.id)}
                        leftIcon={<CheckCircle className="w-4 h-4" />}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-400 hover:bg-rose-500/10 text-xs"
                        onClick={() => TrustRoomService.rejectRequest(room.id, req.id)}
                        leftIcon={<XCircle className="w-4 h-4" />}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Members List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-secondary uppercase tracking-wider">
              Room Members ({room.members.length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {room.members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 rounded-[var(--radius-2xl)] bg-surface border border-subtle flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={member.user.avatarUrl} alt={member.user.displayName} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-primary">{member.user.displayName}</p>
                        {member.hasTwoFactor && (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted">@{member.user.username}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-tertiary">Trust: {member.trustScore}</span>
                        <span className="text-[10px] text-tertiary">• Age: {member.accountAgeDays}d</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Role selector for Admin/Owner */}
                    {isAdmin && member.user.id !== room.ownerId ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          TrustRoomService.updateMemberRole(
                            room.id,
                            member.id,
                            e.target.value as TrustRoomRole
                          )
                        }
                        className="bg-app border border-subtle rounded-[var(--radius-lg)] px-2 py-1 text-[11px] font-bold text-indigo-300 outline-none"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="MODERATOR">MODERATOR</option>
                        <option value="MEMBER">MEMBER</option>
                        <option value="AUDITOR">AUDITOR</option>
                      </select>
                    ) : (
                      <Badge variant="brand" size="sm" className="font-mono text-[10px]">
                        {member.role}
                      </Badge>
                    )}

                    {isAdmin && member.user.id !== MOCK_CURRENT_USER.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => TrustRoomService.removeMember(room.id, member.id)}
                        className="text-rose-400 p-1.5 hover:bg-rose-500/10"
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Audit Trail */}
      {activeTab === 'activity' && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-secondary uppercase tracking-wider">
            Room Audit Trail ({room.auditLogs.length})
          </h3>

          <div className="space-y-2">
            {room.auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-[var(--radius-xl)] bg-surface border border-subtle flex items-start gap-3"
              >
                <div
                  className={`p-2 rounded-[var(--radius-lg)] shrink-0 ${
                    log.severity === 'critical'
                      ? 'bg-rose-500/10 text-rose-400'
                      : log.severity === 'warn'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-indigo-500/10 text-indigo-400'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">{log.action}</span>
                    <span className="text-[10px] text-muted">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-secondary">{log.details}</p>
                  <p className="text-[10px] text-muted">Actor: {log.actor.displayName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Room Settings (ADMIN / OWNER) */}
      {activeTab === 'settings' && isAdmin && (
        <div className="space-y-6 max-w-2xl bg-surface p-6 rounded-[var(--radius-2xl)] border border-subtle">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            Security & Governance Controls
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-xl)] bg-app border border-subtle">
              <div>
                <p className="text-xs font-bold text-primary">Require Two-Factor Authentication</p>
                <p className="text-[11px] text-tertiary">Force hardware 2FA check for entry</p>
              </div>
              <Switch
                checked={room.settings.requireTwoFactor}
                onChange={(checked) =>
                  TrustRoomService.updateSettings(room.id, { requireTwoFactor: checked })
                }
              />
            </div>

            <Select
              label="Privacy Mode"
              value={room.privacy}
              onChange={(e) =>
                TrustRoomService.updateSettings(room.id, {
                  privacy: e.target.value as TrustRoomPrivacy,
                })
              }
              options={[
                { value: 'SECRET', label: 'SECRET' },
                { value: 'PRIVATE', label: 'PRIVATE' },
              ]}
            />

            <Select
              label="Access Policy Mode"
              value={room.accessMode}
              onChange={(e) =>
                TrustRoomService.updateSettings(room.id, {
                  accessMode: e.target.value as TrustRoomAccessMode,
                })
              }
              options={[
                { value: 'OWNER_APPROVAL', label: 'OWNER APPROVAL' },
                { value: 'REQUEST', label: 'REQUEST' },
                { value: 'INVITE_ONLY', label: 'INVITE ONLY' },
              ]}
            />

            <Select
              label="Message Retention Policy"
              value={room.settings.messageRetention}
              onChange={(e) =>
                TrustRoomService.updateSettings(room.id, {
                  messageRetention: e.target.value as MessageRetentionMode,
                })
              }
              options={[
                { value: '24h', label: '24 Hours' },
                { value: '7d', label: '7 Days' },
                { value: '30d', label: '30 Days' },
                { value: 'burn_on_read', label: 'Burn on Read' },
                { value: 'forever', label: 'Permanent' },
              ]}
            />

            {isOwner && (
              <div className="pt-4 border-t border-rose-500/20">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (confirm('Are you sure you want to permanently delete this Trust Room?')) {
                      TrustRoomService.deleteRoom(room.id);
                      onBack();
                    }
                  }}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                >
                  Permanently Delete Room
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
