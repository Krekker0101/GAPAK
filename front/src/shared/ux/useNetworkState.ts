/**
 * GAPAK Network State Infrastructure Hook
 * Monitors browser online/offline status
 */

import { useState, useEffect } from 'react';
import { telemetry } from '../telemetry/telemetry';

export interface NetworkState {
  isOnline: boolean;
  effectiveType?: string;
  rtt?: number;
}

export const useNetworkState = (): NetworkState => {
  const [state, setState] = useState<NetworkState>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  }));

  useEffect(() => {
    const handleOnline = () => {
      setState({ isOnline: true });
      telemetry.record('navigation', 'Network Reconnected (Online)', 'info');
    };

    const handleOffline = () => {
      setState({ isOnline: false });
      telemetry.record('navigation', 'Network Disconnected (Offline)', 'warn');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return state;
};
