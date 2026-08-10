import React, { PropsWithChildren, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../domains/auth/AuthContext';
import { realtimeManager } from './RealtimeManager';
import { presenceEngine } from '../../domains/chats/presence/PresenceEngine';

export const RealtimeProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const queryClient = useQueryClient();
  const { state, logout, user } = useAuth();

  useEffect(() => {
    realtimeManager.initialize(queryClient);
    return () => realtimeManager.dispose();
  }, [queryClient]);

  useEffect(() => {
    if (state === 'AUTHENTICATED' && user) {
      void realtimeManager.connect();
      presenceEngine.start(user.id);
    } else if (state === 'UNAUTHENTICATED' || state === 'AUTH_ERROR') {
      realtimeManager.disconnect('session_unavailable');
      presenceEngine.stop();
    }
  }, [state, user]);

  useEffect(() => realtimeManager.onAuthFailure(() => { void logout(); }), [logout]);
  useEffect(() => () => presenceEngine.stop(), []);

  return <>{children}</>;
};
