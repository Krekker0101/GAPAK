/**
 * Upload recovery prompt.
 *
 * On mount, checks IndexedDB for upload sessions left over from a previous page
 * load (metadata only — the original File object is never persisted, see
 * UploadSessionStore.ts). For each one it asks the user to re-select the same
 * file so the client can verify identity (name/size) and integrity (SHA-256)
 * before asking the server whether the session can still be resumed.
 *
 * Every outcome is shown explicitly. Nothing here silently starts a fresh
 * upload or claims a resume succeeded without the server confirming it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, FileWarning, Clock3, XCircle } from 'lucide-react';
import { Button, Dialog } from '../../shared/design-system/primitives';
import { globalUploadManager, PersistedUploadSession, ReconciliationOutcome } from './GlobalUploadManager';
import { progressPercent } from './uploadReconciliation';

type RowStatus = { kind: 'idle' } | { kind: 'checking' } | { kind: 'failed'; outcome: ReconciliationOutcome };

const outcomeMessage = (outcome: ReconciliationOutcome): string => {
  switch (outcome.kind) {
    case 'FILE_MISMATCH':
      return 'That file has a different name or size than the interrupted upload. Select the original file to resume.';
    case 'HASH_MISMATCH':
      return "That file's contents don't match the interrupted upload. Select the original, unmodified file to resume.";
    case 'EXPIRED':
      return 'This upload session has expired on the server. Start a new upload instead.';
    case 'NOT_FOUND':
      return 'This upload session is no longer available. Start a new upload instead.';
    default:
      return '';
  }
};

const formatBytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const RecoveryRow: React.FC<{
  session: PersistedUploadSession;
  onResolved: (id: string) => void;
}> = ({ session, onResolved }) => {
  const [status, setStatus] = useState<RowStatus>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const progress = progressPercent(session.offsetBytes, session.fileSize);

  const handleFileChosen = async (file: File | undefined) => {
    if (!file) return;
    setStatus({ kind: 'checking' });
    const outcome = await globalUploadManager.reconcileRecoverableSession(session.id, file);
    if (outcome.kind === 'RESUMABLE') {
      onResolved(session.id);
      return;
    }
    setStatus({ kind: 'failed', outcome });
    if (outcome.kind === 'EXPIRED' || outcome.kind === 'NOT_FOUND') onResolved(session.id);
  };

  const handleDiscard = async () => {
    await globalUploadManager.discardRecoverableSession(session.id);
    onResolved(session.id);
  };

  return (
    <div className="p-3 bg-app border border-subtle rounded-[var(--radius-xl)] space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-primary truncate">{session.fileName}</p>
          <p className="text-[10px] text-tertiary">
            {formatBytes(session.offsetBytes)} / {formatBytes(session.fileSize)} already uploaded ({progress}%)
          </p>
        </div>
        <Clock3 className="w-4 h-4 text-amber-400 shrink-0" />
      </div>

      <div className="w-full bg-surface-muted h-1.5 rounded-[var(--radius-pill)] overflow-hidden">
        <div className="h-full bg-amber-400" style={{ width: `${progress}%` }} />
      </div>

      {status.kind === 'failed' && (
        <p className="flex items-start gap-1.5 text-[10px] text-rose-400">
          <FileWarning className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{outcomeMessage(status.outcome)}</span>
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => { void handleFileChosen(event.target.files?.[0]); event.target.value = ''; }}
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={status.kind === 'checking'}
          onClick={() => inputRef.current?.click()}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${status.kind === 'checking' ? 'animate-spin' : ''}`} />
          <span>{status.kind === 'checking' ? 'Checking…' : 'Select file to resume'}</span>
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleDiscard()} disabled={status.kind === 'checking'}>
          <XCircle className="w-3.5 h-3.5" />
          <span>Discard</span>
        </Button>
      </div>
    </div>
  );
};

export const UploadRecoveryPrompt: React.FC = () => {
  const [sessions, setSessions] = useState<PersistedUploadSession[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void globalUploadManager.loadRecoverableSessions().then((recoverable) => {
      if (!cancelled) setSessions(recoverable);
    });
    return () => { cancelled = true; };
  }, []);

  if (!sessions || sessions.length === 0) return null;

  const resolve = (id: string) => setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));

  return (
    <Dialog isOpen title="Resume interrupted uploads" onClose={() => setSessions([])} maxWidth="md" id="upload-recovery-dialog">
      <p className="text-xs text-tertiary mb-3">
        {sessions.length === 1 ? 'An upload was' : `${sessions.length} uploads were`} interrupted by a page reload.
        Re-select the same file for each to continue where it left off, or discard it to start over.
      </p>
      <div className="space-y-2">
        {sessions.map((session) => (
          <RecoveryRow key={session.id} session={session} onResolved={resolve} />
        ))}
      </div>
    </Dialog>
  );
};
