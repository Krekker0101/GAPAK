import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, httpClient } from '../api/httpClient';
import type { SyncResponse } from '../api/backendContracts';
import { useAuth } from '../../domains/auth/AuthContext';
import { telemetry } from '../telemetry/telemetry';
import { isLocallyUsableSyncCursor } from './syncCursor';

const queryRoots: Record<keyof SyncResponse['changes'], string[]> = {
  users: ['users'],
  connections: ['connections'],
  chats: ['chats'],
  messages: ['chat'],
  notifications: ['notifications'],
  stories: ['stories'],
  subscriptions: ['subscriptions'],
  live: ['live'],
};

interface SyncBridgeProps {
  onNotificationsChanged?: () => Promise<void> | void;
}

export const SyncBridge: React.FC<SyncBridgeProps> = ({ onNotificationsChanged }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const notificationsCallback = useRef(onNotificationsChanged);
  notificationsCallback.current = onNotificationsChanged;
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let running: Promise<void> | null = null;
    let failures = 0;
    let nextAttemptAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const storageKey = `gapak.sync.cursor.${userId}`;
    const storedAtKey = `${storageKey}.storedAt`;
    const synchronize = () => {
      if (controller.signal.aborted || !navigator.onLine || document.visibilityState === 'hidden' || Date.now() < nextAttemptAt) return;
      if (running) return running;
      running = (async () => {
        let cursor = window.sessionStorage.getItem(storageKey) ?? undefined;
        // Avoid a guaranteed 400 for a cursor that is visibly malformed or
        // older than the backend's 24-hour TTL. Signature/user validation still
        // happens server-side, and that error path is reset below as before.
        if (cursor && !isLocallyUsableSyncCursor(cursor, window.sessionStorage.getItem(storedAtKey))) {
          window.sessionStorage.removeItem(storageKey);
          window.sessionStorage.removeItem(storedAtKey);
          cursor = undefined;
        }
        const changedRoots = new Set<string>();
        let notificationsChanged = false;
        const seenCursors = new Set<string>();
        while (true) {
          let response: SyncResponse;
          try {
            response = await httpClient.get<SyncResponse>('/sync', { params: { cursor, limit: 100 }, signal: controller.signal, retryCount: 0 });
            if (controller.signal.aborted) return;
          } catch (error) {
            const canResetCursor = cursor && error instanceof ApiError
              && (error.code === 'sync.cursor_expired' || error.code === 'sync.cursor_invalid');
            if (!canResetCursor) throw error;
            window.sessionStorage.removeItem(storageKey);
            window.sessionStorage.removeItem(storedAtKey);
            cursor = undefined;
            seenCursors.clear();
            continue;
          }
          (Object.keys(response.changes) as Array<keyof SyncResponse['changes']>).forEach((domain) => {
            if (response.changes[domain].length) queryRoots[domain].forEach((root) => changedRoots.add(root));
          });
          notificationsChanged ||= response.changes.notifications.length > 0;
          response.deleted.forEach((item) => {
            const normalized = item.entityType.toLowerCase();
            Object.entries(queryRoots).forEach(([domain, roots]) => {
              if (normalized.includes(domain.replace(/s$/, ''))) roots.forEach((root) => changedRoots.add(root));
            });
            if (normalized.includes('notification')) notificationsChanged = true;
          });
          const nextCursor = response.nextCursor || response.cursor;
          if (response.hasMore && (!nextCursor || nextCursor === cursor || seenCursors.has(nextCursor))) {
            throw new Error('The sync endpoint returned a non-advancing cursor.');
          }
          cursor = nextCursor;
          if (cursor) {
            window.sessionStorage.setItem(storageKey, cursor);
            window.sessionStorage.setItem(storedAtKey, String(Date.now()));
          }
          if (!response.hasMore || !response.nextCursor) break;
          seenCursors.add(response.nextCursor);
        }
        await Promise.all([...changedRoots].map((root) => queryClient.invalidateQueries({ queryKey: [root] })));
        if (notificationsChanged) await notificationsCallback.current?.();
        failures = 0;
      })().catch((error) => {
        if (controller.signal.aborted) return;
        failures += 1;
        telemetry.trackError('Incremental sync failed', error instanceof Error ? error : new Error('Incremental sync failed'));
      }).finally(() => {
        running = null;
        if (controller.signal.aborted) return;
        const delay = Math.min(120_000, 15_000 * 2 ** Math.min(failures, 3));
        nextAttemptAt = Date.now() + delay;
        clearTimeout(timer);
        timer = setTimeout(() => { void synchronize(); }, delay);
      });
      return running;
    };
    void synchronize();
    const onOnline = () => { void synchronize(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onOnline);
    return () => {
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onOnline);
    };
  }, [queryClient, userId]);
  return null;
};
