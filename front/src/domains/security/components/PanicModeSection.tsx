import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Trash2, CheckCircle2, Lock, Radio, XOctagon } from 'lucide-react';
import { SecurityService } from '../SecurityService';
import { realtimeManager } from '../../../shared/realtime/RealtimeManager';
import { globalUploadManager } from '../../media/GlobalUploadManager';
import { deviceCryptoManager } from '../../chats/crypto/DeviceCryptoManager';
import type { PanicModeResponse, BackendSession } from '../../../shared/api/backendContracts';
import { Badge, Button, Dialog } from '../../../shared/design-system/primitives';

interface PanicModeSectionProps { sessions: BackendSession[]; }

export const PanicModeSection: React.FC<PanicModeSectionProps> = ({ sessions }) => {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PanicModeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentSessionId = sessions.find((session) => session.isCurrent)?.id;

  const execute = async () => {
    setBusy(true); setError(null);
    try {
      const response = await SecurityService.executePanicMode({ preserveCurrentSession: true, currentSessionId, reason: 'user_triggered' });
      realtimeManager.disconnect('panic_mode');
      realtimeManager.clearChatSubscriptions();
      globalUploadManager.abortAll('panic_mode');
      await deviceCryptoManager.destroyAll();
      window.dispatchEvent(new CustomEvent('gapak:panic'));
      setResult(response); setConfirm(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Panic mode execution failed.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/40"><div className="flex items-center gap-2"><XOctagon className="w-6 h-6 text-rose-400"/><h2 className="text-lg font-extrabold text-rose-300">Panic Safeguard</h2></div><p className="text-xs text-secondary mt-3">This action is executed by the backend. The frontend does not fabricate or locally reset panic state because no reset endpoint exists.</p></div>
    {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
    {!result ? <div className="p-6 rounded-2xl bg-surface border border-subtle space-y-5"><div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs"><div className="p-4 rounded-xl bg-app border border-subtle"><span className="font-bold text-rose-400 flex gap-1.5"><Trash2 className="w-4 h-4"/>Sessions</span><p className="text-tertiary mt-2">The backend will revoke sessions according to its panic-mode policy.</p></div><div className="p-4 rounded-xl bg-app border border-subtle"><span className="font-bold text-amber-400 flex gap-1.5"><Lock className="w-4 h-4"/>Grants</span><p className="text-tertiary mt-2">The backend reports revoked grants after execution.</p></div><div className="p-4 rounded-xl bg-app border border-subtle"><span className="font-bold text-indigo-400 flex gap-1.5"><Radio className="w-4 h-4"/>Uploads</span><p className="text-tertiary mt-2">The backend reports aborted uploads after execution.</p></div></div><Button onClick={() => setConfirm(true)} variant="danger" leftIcon={<XOctagon className="w-4 h-4"/>}>Execute Panic Safeguard</Button></div> : <div className="p-6 rounded-2xl bg-surface border-2 border-rose-500/50 space-y-5"><div className="flex items-center gap-3"><CheckCircle2 className="w-8 h-8 text-rose-400"/><div><h3 className="font-extrabold text-primary">Backend execution accepted</h3><p className="text-xs text-tertiary">Audit event: {result.auditEventId}</p></div></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs"><Metric label="Sessions revoked" value={result.revokedSessionCount}/><Metric label="Grants revoked" value={result.revokedGrantCount}/><Metric label="Uploads aborted" value={result.abortedUploadCount}/></div></div>}
    <Dialog isOpen={confirm} onClose={() => !busy && setConfirm(false)} title="Confirm Panic Safeguard Execution"><div className="space-y-4"><div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0"/>This calls POST /security/panic-mode and cannot be locally undone because the backend exposes no reset endpoint.</div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>Cancel</Button><Button variant="danger" onClick={() => void execute()} isLoading={busy}>Execute</Button></div></div></Dialog>
  </div>;
};
const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => <div className="p-3 rounded-xl bg-app border border-subtle"><p className="text-[10px] text-muted uppercase">{label}</p><p className="text-2xl font-extrabold text-rose-400">{value}</p></div>;
