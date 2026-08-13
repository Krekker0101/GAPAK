import type { PersistedUploadPart, PersistedUploadSession } from './UploadSessionStore';

/**
 * Outcome of trying to resume a persisted upload session with a freshly
 * re-selected file. Every branch is explicit and fail-closed: nothing here
 * ever claims a session is resumable without positive confirmation.
 */
export type ReconciliationOutcome =
  | { kind: 'RESUMABLE' }
  | { kind: 'FILE_MISMATCH' }
  | { kind: 'HASH_MISMATCH' }
  | { kind: 'EXPIRED' }
  | { kind: 'NOT_FOUND' };

export interface SelectableFileInfo {
  name: string;
  size: number;
}

/** Client-side TTL check only. The server remains authoritative — see reconcileSelectedFile. */
export const isPersistedSessionExpired = (session: PersistedUploadSession, nowMs: number = Date.now()): boolean =>
  Number.isNaN(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= nowMs;

/** Cheap pre-check (name/size) so we never hash a file that obviously isn't the right one. */
export const quickMatchesFile = (session: PersistedUploadSession, file: SelectableFileInfo): boolean =>
  session.fileName === file.name && session.fileSize === file.size;

/**
 * Decide whether a persisted session can resume, given a re-selected file and its
 * already-computed SHA-256 hash. Does not itself contact the server — the caller
 * is responsible for the final server-side reconciliation (see GlobalUploadManager);
 * this function only encodes the client-provable checks (TTL, identity, integrity).
 */
export const reconcileSelectedFile = (
  session: PersistedUploadSession | undefined,
  file: SelectableFileInfo,
  computedHash: string,
  nowMs: number = Date.now(),
): ReconciliationOutcome => {
  if (!session) return { kind: 'NOT_FOUND' };
  if (isPersistedSessionExpired(session, nowMs)) return { kind: 'EXPIRED' };
  if (!quickMatchesFile(session, file)) return { kind: 'FILE_MISMATCH' };
  if (computedHash !== session.contentHash) return { kind: 'HASH_MISMATCH' };
  return { kind: 'RESUMABLE' };
};

/** Bytes durably accounted for by already-completed parts, given the chunk size in effect. */
export const offsetFromCompletedParts = (
  completedParts: PersistedUploadPart[],
  fileSize: number,
  chunkSizeBytes: number,
): number => {
  if (!chunkSizeBytes || chunkSizeBytes <= 0) return 0;
  return completedParts.reduce(
    (sum, part) => sum + Math.min(chunkSizeBytes, Math.max(0, fileSize - (part.partNumber - 1) * chunkSizeBytes)),
    0,
  );
};

/** Percentage progress for the recovery-prompt UI, bounded to [0, 100]. */
export const progressPercent = (offsetBytes: number, fileSize: number): number => {
  if (fileSize <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((offsetBytes / fileSize) * 100)));
};
