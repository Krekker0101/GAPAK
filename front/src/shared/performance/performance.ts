export interface PerformanceMeasurement {
  name: string;
  durationMs: number;
}

const now = (): number => typeof performance !== 'undefined' ? performance.now() : Date.now();

export const measureAsync = async <T>(name: string, operation: () => Promise<T>): Promise<{ value: T; measurement: PerformanceMeasurement }> => {
  const started = now();
  try {
    const value = await operation();
    return { value, measurement: { name, durationMs: Math.max(0, now() - started) } };
  } catch (error) {
    return Promise.reject(Object.assign(error instanceof Error ? error : new Error('Operation failed'), { performanceMeasurement: { name, durationMs: Math.max(0, now() - started) } }));
  }
};

export const getNavigationTiming = (): PerformanceNavigationTiming | null => {
  if (typeof performance === 'undefined' || !('getEntriesByType' in performance)) return null;
  return performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined ?? null;
};
