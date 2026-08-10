/**
 * GAPAK Security Subcomponent: SessionsSection
 * Manages active user sessions, device tokens, and session revocation.
 */

import React, { useState } from 'react';
import { Laptop, Smartphone, Radio, Trash2, AlertTriangle, ShieldCheck, MapPin, Globe } from 'lucide-react';
import { UserSession } from '../../../shared/types/security';
import { SecurityService } from '../SecurityService';
import { Badge, Button, Dialog } from '../../../shared/design-system/primitives';

interface SessionsSectionProps {
  sessions: UserSession[];
}

export const SessionsSection: React.FC<SessionsSectionProps> = ({ sessions }) => {
  const [selectedSessionToRevoke, setSelectedSessionToRevoke] = useState<UserSession | null>(null);
  const [isConfirmRevokeOthersOpen, setIsConfirmRevokeOthersOpen] = useState(false);

  const handleRevokeSingle = () => {
    if (selectedSessionToRevoke) {
      void SecurityService.revokeSession(selectedSessionToRevoke.id);
      setSelectedSessionToRevoke(null);
    }
  };

  const handleRevokeOthers = () => {
    void SecurityService.revokeOtherSessions();
    setIsConfirmRevokeOthersOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Sessions Top Header */}
      <div className="p-4 md:p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
            <Laptop className="w-5 h-5 text-indigo-400" />
            Active Session Management (`GET /sessions/`)
          </h2>
          <p className="text-xs text-tertiary mt-0.5">
            Monitor and revoke authentication tokens across devices, browsers, and remote geographic locations.
          </p>
        </div>

        {sessions.length > 1 && (
          <Button
            onClick={() => setIsConfirmRevokeOthersOpen(true)}
            variant="danger"
            size="sm"
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Revoke All Other Sessions
          </Button>
        )}
      </div>

      {/* Sessions Table / Cards List */}
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`p-4 rounded-[var(--radius-2xl)] bg-surface border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
              session.isCurrent
                ? 'border-indigo-500/50 shadow-token-md shadow-indigo-500/5'
                : session.isSuspicious
                ? 'border-rose-500/50 bg-rose-500/5'
                : 'border-subtle hover:border-default'
            }`}
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={`p-2.5 rounded-[var(--radius-xl)] shrink-0 ${
                  session.isCurrent
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : session.isSuspicious
                    ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                    : 'bg-surface-muted text-secondary'
                }`}
              >
                {session.device.toLowerCase().includes('iphone') || session.device.toLowerCase().includes('mobile') ? (
                  <Smartphone className="w-5 h-5" />
                ) : (
                  <Laptop className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-primary truncate">{session.device}</h3>
                  {session.isCurrent && (
                    <Badge variant="success" size="sm" className="font-mono text-[9px] font-bold">
                      CURRENT SESSION
                    </Badge>
                  )}
                  {session.isSuspicious && (
                    <Badge variant="danger" size="sm" className="font-mono text-[9px] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      SUSPICIOUS ACTIVITY
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-secondary font-mono flex items-center gap-2 flex-wrap">
                  <span>{session.browser}</span>
                  <span className="text-secondary">•</span>
                  <span className="flex items-center gap-1 text-tertiary">
                    <Globe className="w-3 h-3 text-muted" />
                    {session.ip}
                  </span>
                  {session.location && (
                    <>
                      <span className="text-secondary">•</span>
                      <span className="flex items-center gap-1 text-tertiary">
                        <MapPin className="w-3 h-3 text-muted" />
                        {session.location}
                      </span>
                    </>
                  )}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-muted font-mono pt-0.5">
                  <span>Last Active: {session.lastActivity}</span>
                  <span>Created: {new Date(session.createdAt).toLocaleDateString()}</span>
                  {session.trustScore && <span>Trust Rating: {session.trustScore}%</span>}
                </div>
              </div>
            </div>

            {/* Actions */}
            {!session.isCurrent && (
              <Button
                onClick={() => setSelectedSessionToRevoke(session)}
                variant="outline"
                size="sm"
                className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 shrink-0 text-xs font-bold"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Revoke Session
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Modal: Confirm Single Session Revocation */}
      <Dialog
        isOpen={!!selectedSessionToRevoke}
        onClose={() => setSelectedSessionToRevoke(null)}
        title="Revoke Session Authorization"
      >
        <div className="space-y-4">
          <p className="text-xs text-secondary leading-relaxed">
            Are you sure you want to revoke the session on <strong className="text-primary">{selectedSessionToRevoke?.device}</strong> ({selectedSessionToRevoke?.ip})? This device will be instantly logged out.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-subtle">
            <Button variant="ghost" size="sm" onClick={() => setSelectedSessionToRevoke(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleRevokeSingle}>
              Revoke Session
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Modal: Confirm Revoke All Other Sessions */}
      <Dialog
        isOpen={isConfirmRevokeOthersOpen}
        onClose={() => setIsConfirmRevokeOthersOpen(false)}
        title="Revoke All Other Sessions (`DELETE /sessions/others`)"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-[var(--radius-xl)] bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Mass Session Revocation Action
            </p>
            <p>
              This will immediately terminate all active sessions except your current device session ({sessions.find(s => s.isCurrent)?.device}).
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-subtle">
            <Button variant="ghost" size="sm" onClick={() => setIsConfirmRevokeOthersOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleRevokeOthers}>
              Revoke All Other Sessions
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
