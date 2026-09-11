export type PresencePreference = 'online' | 'away' | 'busy' | 'invisible';

export function readPresencePreference(value: unknown): PresencePreference | undefined {
  return value === 'online' || value === 'away' || value === 'busy' || value === 'invisible'
    ? value : undefined;
}

/** Serialize writes so a slower earlier selection cannot overwrite a later one. */
export function createPresenceSaveQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(save: () => Promise<T>): Promise<T> {
    const operation = tail.then(save);
    // A rejected save must remain visible to its caller, but not poison retries.
    tail = operation.catch(() => undefined);
    return operation;
  };
}
