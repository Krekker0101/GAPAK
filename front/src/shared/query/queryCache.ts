export type QueryKey = readonly unknown[];
export type QueryListener = () => void;

const serialize = (key: QueryKey) => JSON.stringify(key);

class QueryCache {
  private values = new Map<string, unknown>();
  private listeners = new Map<string, Set<QueryListener>>();

  get<T>(key: QueryKey): T | undefined { return this.values.get(serialize(key)) as T | undefined; }

  set<T>(key: QueryKey, value: T): void {
    const id = serialize(key);
    this.values.set(id, value);
    this.listeners.get(id)?.forEach((listener) => listener());
  }

  remove(key: QueryKey): void {
    const id = serialize(key);
    this.values.delete(id);
    this.listeners.get(id)?.forEach((listener) => listener());
  }

  clear(): void {
    this.values.clear();
    this.listeners.forEach((listeners) => listeners.forEach((listener) => listener()));
  }

  invalidate(prefix: QueryKey): void {
    [...this.values.keys()].forEach((id) => {
      try {
        const parsed = JSON.parse(id) as unknown[];
        const matches = prefix.every((value, index) => JSON.stringify(parsed[index]) === JSON.stringify(value));
        if (matches) this.values.delete(id);
      } catch { /* ignore malformed internal keys */ }
    });
    this.listeners.forEach((listeners) => listeners.forEach((listener) => listener()));
  }

  subscribe(key: QueryKey, listener: QueryListener): () => void {
    const id = serialize(key);
    const listeners = this.listeners.get(id) ?? new Set<QueryListener>();
    listeners.add(listener);
    this.listeners.set(id, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(id);
    };
  }
}

export const queryCache = new QueryCache();
