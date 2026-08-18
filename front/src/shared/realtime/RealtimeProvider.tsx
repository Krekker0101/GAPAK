import React, { PropsWithChildren, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../domains/auth/AuthContext';
import { realtimeManager } from './RealtimeManager';

export const RealtimeProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const queryClient = useQueryClient();
  const { state, user } = useAuth();

  useEffect(() => {
    realtimeManager.initialize(queryClient);
    return () => realtimeManager.dispose();
  }, [queryClient]);

  useEffect(() => {
    if (state === 'AUTHENTICATED' && user) {
      void realtimeManager.connect();
    } else if (state === 'UNAUTHENTICATED' || state === 'AUTH_ERROR') {
      realtimeManager.disconnect('session_unavailable');
    }
  }, [state, user]);

  useEffect(() => {
    const reconnectAfterRefresh = () => realtimeManager.connect();
    window.addEventListener('gapak:session-refreshed', reconnectAfterRefresh);
    return () => window.removeEventListener('gapak:session-refreshed', reconnectAfterRefresh);
  }, []);

  return <>{children}</>;
};
