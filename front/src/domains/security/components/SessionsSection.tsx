import React, { useState } from 'react';
import { Laptop, Smartphone, Trash2, AlertTriangle, MapPin, Globe } from 'lucide-react';
import type { BackendSession } from '../../../shared/api/backendContracts';
import { SecurityService } from '../SecurityService';
import { Badge, Button, Dialog } from '../../../shared/design-system/primitives';

interface SessionsSectionProps { sessions: BackendSession[]; }

export const SessionsSection: React.FC<SessionsSectionProps> = ({ sessions }) => {
  const [selected, setSelected] = useState<BackendSession | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revoke = async () => {
    if (!selected) return;
    setBusy(true); setError(null);
    try { await SecurityService.revokeSession(selected.id); setSelected(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to revoke session.'); }
    finally { setBusy(false); }
  };

  const revokeOthers = async () => {
    setBusy(true); setError(null);
    try { await SecurityService.revokeOtherSessions(); setConfirmOthers(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to revoke other sessions.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <div className="p-4 md:p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-base font-extrabold text-primary flex items-center gap-2"><Laptop className="w-5 h-5 text-indigo-400" />Active Sessions</h2>
        <p className="text-xs text-tertiary mt-0.5">Server-authoritative authentication sessions. Revocation is performed by the backend.</p>
      </div>
      {sessions.some((s) => !s.isCurrent) && <Button onClick={() => setConfirmOthers(true)} variant="danger" size="sm" leftIcon={<Trash2 className="w-4 h-4" />}>Revoke All Other Sessions</Button>}
    </div>
    {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
    <div className="space-y-3">
      {sessions.length === 0 ? <div className="p-8 text-center border border-dashed border-subtle rounded-2xl text-sm text-muted">No sessions returned by the server.</div> : sessions.map((session) => {
        const mobile = /mobile|iphone|android/i.test(session.deviceName ?? '') || /mobile|iphone|android/i.test(session.userAgent ?? '');
        const location = [session.city, session.countryCode].filter(Boolean).join(', ');
        return <div key={session.id} className={`p-4 rounded-[var(--radius-2xl)] bg-surface border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${session.isCurrent ? 'border-indigo-500/50' : 'border-subtle'}`}>
          <div className="flex items-start gap-3.5 min-w-0">
            <div className={`p-2.5 rounded-xl shrink-0 ${session.isCurrent ? 'bg-indigo-600/20 text-indigo-400' : 'bg-surface-muted text-secondary'}`}>{mobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}</div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-primary truncate">{session.deviceName || 'Unnamed device'}</h3>
                {session.isCurrent && <Badge variant="success" size="sm">CURRENT SESSION</Badge>}
                {session.securityLevel && <Badge variant="neutral" size="sm">{session.securityLevel}</Badge>}
              </div>
              <p className="text-xs text-secondary font-mono flex items-center gap-2 flex-wrap">
                {session.userAgent && <span>{session.userAgent}</span>}
                {session.ipAddress && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{session.ipAddress}</span>}
                {location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{location}</span>}
              </p>
              <div className="text-[11px] text-muted font-mono flex gap-3 flex-wrap">
                <span>Last active: {new Date(session.lastUsedAt).toLocaleString()}</span>
                <span>Created: {new Date(session.createdAt).toLocaleDateString()}</span>
                <span>Expires: {new Date(session.expiresAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          {!session.isCurrent && <Button onClick={() => setSelected(session)} variant="outline" size="sm" className="text-rose-400 border-rose-500/30" leftIcon={<Trash2 className="w-3.5 h-3.5" />}>Revoke Session</Button>}
        </div>;
      })}
    </div>
    <Dialog isOpen={!!selected} onClose={() => !busy && setSelected(null)} title="Revoke Session Authorization">
      <div className="space-y-4"><p className="text-xs text-secondary">Revoke <strong>{selected?.deviceName || 'this session'}</strong>? The backend will invalidate that session.</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setSelected(null)} disabled={busy}>Cancel</Button><Button variant="danger" onClick={() => void revoke()} isLoading={busy}>Revoke Session</Button></div></div>
    </Dialog>
    <Dialog isOpen={confirmOthers} onClose={() => !busy && setConfirmOthers(false)} title="Revoke All Other Sessions">
      <div className="space-y-4"><div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>This calls DELETE /sessions/others. The current session is excluded by the backend.</span></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmOthers(false)} disabled={busy}>Cancel</Button><Button variant="danger" onClick={() => void revokeOthers()} isLoading={busy}>Revoke Other Sessions</Button></div></div>
    </Dialog>
  </div>;
};
