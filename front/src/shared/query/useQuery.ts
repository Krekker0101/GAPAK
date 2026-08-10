import { useCallback, useEffect, useState } from 'react';
import { queryCache, QueryKey } from './queryCache';

interface UseQueryOptions<T> {
  enabled?: boolean;
  staleTime?: number;
  initialData?: T;
}

export const useQuery = <T>(key: QueryKey, queryFn: (signal: AbortSignal) => Promise<T>, options: UseQueryOptions<T> = {}) => {
  const { enabled = true, staleTime = 30_000, initialData } = options;
  const [data, setData] = useState<T | undefined>(() => queryCache.get<T>(key) ?? initialData);
  const [isLoading, setIsLoading] = useState(data === undefined && enabled);
  const [error, setError] = useState<unknown>(null);

  const execute = useCallback(async (signal?: AbortSignal) => {
    const cached = queryCache.get<T>(key);
    if (cached !== undefined) {
      setData(cached);
      setIsLoading(false);
      if (staleTime > 0) return cached;
    }
    const controller = signal ? null : new AbortController();
    setIsLoading(cached === undefined);
    setError(null);
    try {
      const result = await queryFn(signal ?? controller!.signal);
      queryCache.set(key, result);
      setData(result);
      return result;
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [key, queryFn, staleTime]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void execute(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [enabled, execute]);

  useEffect(() => queryCache.subscribe(key, () => setData(queryCache.get<T>(key))), [key]);

  return { data, error, isLoading, refetch: () => execute() };
};
