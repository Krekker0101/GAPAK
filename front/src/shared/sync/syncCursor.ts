const SYNC_CURSOR_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Screens a persisted cursor by the time this client received it. Cursor
 * contents stay opaque: only the backend validates its HMAC and payload.
 */
export const isLocallyUsableSyncCursor = (raw: string, storedAt: string | null, nowMs = Date.now()): boolean => {
  if (!raw || raw.split('.').length !== 2 || !storedAt) return false;
  const storedAtMs = Number(storedAt);
  if (!Number.isSafeInteger(storedAtMs) || storedAtMs <= 0) return false;
  const ageMs = nowMs - storedAtMs;
  return ageMs >= 0 && ageMs <= SYNC_CURSOR_TTL_MS;
};
