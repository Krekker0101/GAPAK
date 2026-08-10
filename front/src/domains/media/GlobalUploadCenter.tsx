/**
 * Global Upload Center UI
 * GAPAK Media Infrastructure - Phase 4
 *
 * Floating global status center and drawer for active/historical upload sessions.
 */

import React, { useState, useEffect } from 'react';
import {
  Upload,
  ChevronUp,
  ChevronDown,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Film,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { UploadSession } from '../../shared/types';
import { globalUploadManager } from './GlobalUploadManager';
import { Badge, Button } from '../../shared/design-system/primitives';

export const GlobalUploadCenter: React.FC = () => {
  const [sessions, setSessions] = useState<UploadSession[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = globalUploadManager.subscribe(setSessions);
    return () => unsubscribe();
  }, []);

  const activeSessions = sessions.filter(
    (s) => s.state === 'PREPARING' || s.state === 'UPLOADING' || s.state === 'PROCESSING'
  );

  if (sessions.length === 0) return null;

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec > 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  };

  const formatBytes = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full shadow-token-lg transition-all">
      {/* Floating Toggle Banner */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-surface border border-subtle rounded-[var(--radius-2xl)] cursor-pointer flex items-center justify-between shadow-token-lg hover:bg-surface-strong"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-[var(--radius-xl)] relative">
            <Upload className="w-4 h-4" />
            {activeSessions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-[var(--radius-pill)] animate-ping" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-primary">Global Upload Center</span>
              {activeSessions.length > 0 ? (
                <span className="px-2 py-0.5 bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold rounded-[var(--radius-pill)]">
                  {activeSessions.length} Active
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-[var(--radius-pill)]">
                  Completed
                </span>
              )}
            </div>
            <p className="text-[11px] text-tertiary truncate max-w-[220px]">
              {activeSessions.length > 0
                ? `${activeSessions[0].fileName} (${activeSessions[0].progress}%)`
                : `${sessions.length} total transfer sessions`}
            </p>
          </div>
        </div>

        <button type="button" className="text-tertiary hover:text-primary">
          {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded Sessions Drawer */}
      {isOpen && (
        <div className="mt-2 p-3 bg-surface-glass-strong backdrop-blur-md border border-subtle rounded-[var(--radius-2xl)] max-h-80 overflow-y-auto space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="p-2.5 bg-app border border-subtle rounded-[var(--radius-xl)] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Film className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-semibold text-primary truncate">{session.fileName}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="px-1.5 py-0.5 bg-surface-muted text-tertiary text-[9px] font-mono rounded">
                    {session.context}
                  </span>

                  {session.state === 'UPLOADING' && <Badge variant="warning">UPLOADING</Badge>}
                  {session.state === 'PROCESSING' && <Badge variant="brand">PROCESSING</Badge>}
                  {session.state === 'READY' && <Badge variant="success">READY</Badge>}
                  {session.state === 'FAILED' && <Badge variant="danger">FAILED</Badge>}
                  {session.state === 'CANCELLED' && <Badge variant="neutral">CANCELLED</Badge>}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-surface-muted h-1.5 rounded-[var(--radius-pill)] overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    session.state === 'FAILED'
                      ? 'bg-rose-500'
                      : session.state === 'READY'
                      ? 'bg-emerald-400'
                      : 'bg-indigo-500 animate-pulse'
                  }`}
                  style={{ width: `${session.progress}%` }}
                />
              </div>

              {/* Transfer Metrics Footer */}
              <div className="flex items-center justify-between text-[10px] text-tertiary font-mono">
                <span>
                  {formatBytes(session.uploadedBytes)} / {formatBytes(session.fileSize)}
                  {session.speedBytesPerSec > 0 && ` • ${formatSpeed(session.speedBytesPerSec)}`}
                </span>

                <div className="flex items-center gap-2">
                  {session.timeRemainingSec > 0 && session.state === 'UPLOADING' && (
                    <span>ETA: {session.timeRemainingSec}s</span>
                  )}

                  {session.state === 'FAILED' && (
                    <button
                      type="button"
                      onClick={() => globalUploadManager.retryUpload(session.id)}
                      className="text-amber-400 hover:underline flex items-center gap-0.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  )}

                  {(session.state === 'UPLOADING' || session.state === 'PREPARING') && (
                    <button
                      type="button"
                      onClick={() => globalUploadManager.cancelUpload(session.id)}
                      className="text-rose-400 hover:underline flex items-center gap-0.5"
                    >
                      <X className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>

              {session.processingStep && (
                <p className="text-[10px] text-muted italic">{session.processingStep}</p>
              )}
              {session.error && (
                <p className="text-[10px] text-rose-400 font-medium">{session.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
