import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, httpClient } from '../api/httpClient';
import type { SyncResponse } from '../api/backendContracts';
import { useAuth } from '../../domains/auth/AuthContext';
import { telemetry } from '../telemetry/telemetry';

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
  const running = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!user) return;
    const storageKey = `gapak.sync.cursor.${user.id}`;
    const synchronize = () => {
      if (running.current) return running.current;
      running.current = (async () => {
        let cursor = window.sessionStorage.getItem(storageKey) ?? undefined;
        const changedRoots = new Set<string>();
        let notificationsChanged = false;
        const seenCursors = new Set<string>();
        while (true) {
          let response: SyncResponse;
          try {
            response = await httpClient.get<SyncResponse>('/sync', { params: { cursor, limit: 100 } });
          } catch (error) {
            const canResetCursor = cursor && error instanceof ApiError
              && (error.code === 'sync.cursor_expired' || error.code === 'sync.cursor_invalid');
            if (!canResetCursor) throw error;
            window.sessionStorage.removeItem(storageKey);
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
          if (cursor) window.sessionStorage.setItem(storageKey, cursor);
          if (!response.hasMore || !response.nextCursor) break;
          seenCursors.add(response.nextCursor);
        }
        await Promise.all([...changedRoots].map((root) => queryClient.invalidateQueries({ queryKey: [root] })));
        if (notificationsChanged) await onNotificationsChanged?.();
      })().catch((error) => {
        telemetry.trackError('Incremental sync failed', error instanceof Error ? error : new Error('Incremental sync failed'));
      }).finally(() => { running.current = null; });
      return running.current;
    };
    void synchronize();
    const onOnline = () => { void synchronize(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [onNotificationsChanged, queryClient, user]);
  return null;
};
