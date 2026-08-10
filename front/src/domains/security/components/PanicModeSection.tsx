/**
 * GAPAK Security Subcomponent: PanicModeSection
 * Destructive Security Safeguard Operation & Real Execution Metrics Display
 */

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Trash2, CheckCircle2, Lock, Radio, XOctagon, RotateCcw } from 'lucide-react';
import { SecurityFlags, PanicExecutionResult } from '../../../shared/types/security';
import { SecurityService } from '../SecurityService';
import { realtimeManager } from '../../../shared/realtime/RealtimeManager';
import { globalUploadManager } from '../../media/GlobalUploadManager';
import { deviceCryptoManager } from '../../chats/crypto/DeviceCryptoManager';
import { Badge, Button, Dialog } from '../../../shared/design-system/primitives';

interface PanicModeSectionProps {
  flags: SecurityFlags;
}

export const PanicModeSection: React.FC<PanicModeSectionProps> = ({ flags }) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<PanicExecutionResult | null>(null);

  const handleExecutePanic = async () => {
    setIsExecuting(true);
    try {
      const result = await SecurityService.executePanicMode();
      realtimeManager.disconnect('panic_mode');
      realtimeManager.clearChatSubscriptions();
      globalUploadManager.abortAll('panic_mode');
      await deviceCryptoManager.destroyAll();
      window.dispatchEvent(new CustomEvent('gapak:panic'));
      setIsConfirmOpen(false);
      setExecutionResult(result);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleResetPanic = async () => {
    await SecurityService.resetPanicMode();
    setExecutionResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Panic Mode Header */}
      <div className="p-6 rounded-[var(--radius-2xl)] bg-rose-500/10 border border-rose-500/40 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <XOctagon className="w-6 h-6 text-rose-400 animate-pulse" />
            <h2 className="text-lg font-extrabold text-rose-300">Panic Safeguard Mode (`Destructive Operation`)</h2>
          </div>

          {flags.panicModeActive && (
            <Badge variant="danger" size="sm" className="font-mono font-bold animate-pulse">
              PANIC MODE ENGAGED
            </Badge>
          )}
        </div>

        <p className="text-xs text-secondary leading-relaxed max-w-2xl">
          Panic Mode is a emergency threat response operation. Triggering this safeguard immediately locks down your GAPAK account, purges remote sessions, revokes API keys, and halts ongoing uploads.
        </p>
      </div>

      {/* BEFORE EXECUTION: Explicit Consequences Explanation */}
      {!executionResult ? (
        <div className="p-6 rounded-[var(--radius-2xl)] bg-surface border border-subtle space-y-5">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Explicit System Execution Consequences
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-[var(--radius-xl)] bg-app border border-subtle space-y-1.5">
              <span className="font-bold text-rose-400 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" />
                1. Sessions Revoked
              </span>
              <p className="text-tertiary leading-normal">
                All active session tokens across mobile, desktop, and web browsers (except current active session) will be purged instantly.
              </p>
            </div>

            <div className="p-4 rounded-[var(--radius-xl)] bg-app border border-subtle space-y-1.5">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                2. Grants & Keys Revoked
              </span>
              <p className="text-tertiary leading-normal">
                Third-party OAuth integrations, API client tokens, and delegated access permissions will be revoked.
              </p>
            </div>

            <div className="p-4 rounded-[var(--radius-xl)] bg-app border border-subtle space-y-1.5">
              <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                <Radio className="w-4 h-4" />
                3. Uploads Aborted
              </span>
              <p className="text-tertiary leading-normal">
                Any active media uploads, live stream ingress buffers, or WebSocket channels will be forcefully disconnected.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-subtle flex items-center justify-between">
            <span className="text-xs text-muted font-mono">
              Status: Ready for Trigger
            </span>

            <Button
              onClick={() => setIsConfirmOpen(true)}
              variant="danger"
              leftIcon={<XOctagon className="w-4 h-4" />}
              className="font-bold"
            >
              Initiate Panic Safeguard Execution
            </Button>
          </div>
        </div>
      ) : (
        /* AFTER EXECUTION: Real Backend Results Display */
        <div className="p-6 rounded-[var(--radius-2xl)] bg-surface border-2 border-rose-500/50 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-[var(--radius-xl)] bg-rose-500/20 text-rose-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-primary">
                Panic Safeguard Execution Completed
              </h3>
              <p className="text-xs text-tertiary font-mono">
                Executed at: {new Date(executionResult.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Actual Backend Result Values */}
          <div className="p-4 rounded-[var(--radius-xl)] bg-app border border-subtle space-y-3">
            <p className="text-xs font-bold text-primary uppercase tracking-wider font-mono">
              Realtime Backend Execution Telemetry (`PanicExecutionResult`)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3 rounded-[var(--radius-lg)] bg-surface border border-subtle">
                <p className="text-[10px] text-muted uppercase">revokedSessionCount</p>
                <p className="text-2xl font-extrabold text-rose-400">{executionResult.revokedSessionCount}</p>
                <p className="text-[10px] text-tertiary mt-1">Active Sessions Revoked</p>
              </div>

              <div className="p-3 rounded-[var(--radius-lg)] bg-surface border border-subtle">
                <p className="text-[10px] text-muted uppercase">revokedGrantCount</p>
                <p className="text-2xl font-extrabold text-amber-400">{executionResult.revokedGrantCount}</p>
                <p className="text-[10px] text-tertiary mt-1">OAuth Grants Purged</p>
              </div>

              <div className="p-3 rounded-[var(--radius-lg)] bg-surface border border-subtle">
                <p className="text-[10px] text-muted uppercase">abortedUploadCount</p>
                <p className="text-2xl font-extrabold text-indigo-400">{executionResult.abortedUploadCount}</p>
                <p className="text-[10px] text-tertiary mt-1">Live Uploads Aborted</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={handleResetPanic}
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Clear Panic State
            </Button>
          </div>
        </div>
      )}

      {/* Destructive Confirmation Dialog */}
      <Dialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Confirm Panic Safeguard Execution"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-[var(--radius-xl)] bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-2">
            <p className="font-bold flex items-center gap-2 text-sm text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              WARNING: Irreversible Security Action
            </p>
            <p>
              You are about to execute Panic Mode. This will immediately log out all other active devices, cancel access grants, and abort open media streams.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isExecuting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isExecuting}
              onClick={handleExecutePanic}
              leftIcon={<XOctagon className="w-4 h-4" />}
            >
              Execute Panic Mode Now
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
