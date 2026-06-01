import { useState, useCallback } from 'react';

interface SubscriptionResponse {
  id: string;
  subscriberId: string;
  creatorId: string;
  status: string;
  subscriptionType: 'VISIBLE' | 'SILENT';
  subscribedAt: string;
  createdAt: string;
}

interface UseSubscriptionsReturn {
  isSubscribed: boolean;
  subscriptionType: 'VISIBLE' | 'SILENT' | null;
  isLoading: boolean;
  error: string | null;
  subscribe: (creatorId: string, type?: 'VISIBLE' | 'SILENT') => Promise<void>;
  unsubscribe: (creatorId: string) => Promise<void>;
  changeSubscriptionType: (creatorId: string, type: 'VISIBLE' | 'SILENT') => Promise<void>;
  clearError: () => void;
}

/**
 * useSubscriptions Hook
 * Управление подписками пользователя
 */
export const useSubscriptions = (initialCreatorId?: string): UseSubscriptionsReturn => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'VISIBLE' | 'SILENT' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const subscribe = useCallback(
    async (creatorId: string, type: 'VISIBLE' | 'SILENT' = 'VISIBLE') => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/subscriptions/${creatorId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({ subscriptionType: type }),
        });

        if (!response.ok) {
          throw new Error('Failed to subscribe');
        }

        const data: SubscriptionResponse = await response.json();
        setIsSubscribed(true);
        setSubscriptionType(data.subscriptionType);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const unsubscribe = useCallback(async (creatorId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/subscriptions/${creatorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to unsubscribe');
      }

      setIsSubscribed(false);
      setSubscriptionType(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const changeSubscriptionType = useCallback(
    async (creatorId: string, type: 'VISIBLE' | 'SILENT') => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/subscriptions/${creatorId}/type`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({ subscriptionType: type }),
        });

        if (!response.ok) {
          throw new Error('Failed to change subscription type');
        }

        const data: SubscriptionResponse = await response.json();
        setSubscriptionType(data.subscriptionType);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isSubscribed,
    subscriptionType,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    changeSubscriptionType,
    clearError,
  };
};

/**
 * useNotificationPreferences Hook
 * Управление уведомлениями от подписок
 */
interface NotificationPreferences {
  creatorId: string;
  notifyOnPost: boolean;
  notifyOnStory: boolean;
  notifyOnLive: boolean;
  notifyOnClip: boolean;
  isMuted: boolean;
  muteMinutes?: number;
}

interface UseNotificationPreferencesReturn {
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  error: string | null;
  fetchPreferences: (creatorId: string) => Promise<void>;
  updatePreferences: (
    creatorId: string,
    updates: Partial<Omit<NotificationPreferences, 'creatorId'>>
  ) => Promise<void>;
  toggleNotification: (
    creatorId: string,
    key: 'notifyOnPost' | 'notifyOnStory' | 'notifyOnLive' | 'notifyOnClip'
  ) => Promise<void>;
  mute: (creatorId: string, minutes: number) => Promise<void>;
  unmute: (creatorId: string) => Promise<void>;
  clearError: () => void;
}

export const useNotificationPreferences = (): UseNotificationPreferencesReturn => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchPreferences = useCallback(async (creatorId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/subscriptions/${creatorId}/notifications`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }

      const data: NotificationPreferences = await response.json();
      setPreferences(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(
    async (
      creatorId: string,
      updates: Partial<Omit<NotificationPreferences, 'creatorId'>>
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/subscriptions/${creatorId}/notifications`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error('Failed to update preferences');
        }

        setPreferences(prev => prev ? { ...prev, ...updates } : null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const toggleNotification = useCallback(
    async (
      creatorId: string,
      key: 'notifyOnPost' | 'notifyOnStory' | 'notifyOnLive' | 'notifyOnClip'
    ) => {
      if (!preferences) return;

      const newValue = !preferences[key];
      await updatePreferences(creatorId, { [key]: newValue });
    },
    [preferences, updatePreferences]
  );

  const mute = useCallback(async (creatorId: string, minutes: number) => {
    await updatePreferences(creatorId, { muteMinutes: minutes });
  }, [updatePreferences]);

  const unmute = useCallback(async (creatorId: string) => {
    await updatePreferences(creatorId, { muteMinutes: 0 });
  }, [updatePreferences]);

  return {
    preferences,
    isLoading,
    error,
    fetchPreferences,
    updatePreferences,
    toggleNotification,
    mute,
    unmute,
    clearError,
  };
};

/**
 * useSubscriptionsList Hook
 * Получение списков подписчиков и авторов
 */
interface Subscriber {
  id: string;
  username: string;
  displayName: string;
  avatarFileId?: string;
  bio?: string;
  isFollowing?: boolean;
  isFriend?: boolean;
  subscriptionType?: 'VISIBLE' | 'SILENT';
}

interface UseSubscriptionsListReturn {
  items: Subscriber[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  fetchSubscribers: (userId: string, page?: number, limit?: number) => Promise<void>;
  fetchFollowing: (page?: number, limit?: number) => Promise<void>;
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;
  clearError: () => void;
}

export const useSubscriptionsList = (): UseSubscriptionsListReturn => {
  const [items, setItems] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<string>('');

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchData = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);
    setEndpoint(url);

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch list');
      }

      const data = await response.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSubscribers = useCallback(
    async (userId: string, pageNum: number = 1, limit: number = 20) => {
      setPage(pageNum);
      setPageSize(limit);
      await fetchData(
        `/api/v1/subscriptions/${userId}/subscribers?page=${pageNum}&limit=${limit}`
      );
    },
    [fetchData]
  );

  const fetchFollowing = useCallback(
    async (pageNum: number = 1, limit: number = 20) => {
      setPage(pageNum);
      setPageSize(limit);
      await fetchData(`/api/v1/subscriptions/following?page=${pageNum}&limit=${limit}`);
    },
    [fetchData]
  );

  const nextPage = useCallback(async () => {
    const newPage = page + 1;
    setPage(newPage);
    await fetchData(`${endpoint}?page=${newPage}&limit=${pageSize}`);
  }, [page, pageSize, endpoint, fetchData]);

  const previousPage = useCallback(async () => {
    if (page > 1) {
      const newPage = page - 1;
      setPage(newPage);
      await fetchData(`${endpoint}?page=${newPage}&limit=${pageSize}`);
    }
  }, [page, pageSize, endpoint, fetchData]);

  return {
    items,
    total,
    page,
    pageSize,
    hasMore,
    isLoading,
    error,
    fetchSubscribers,
    fetchFollowing,
    nextPage,
    previousPage,
    clearError,
  };
};

export default {
  useSubscriptions,
  useNotificationPreferences,
  useSubscriptionsList,
};
