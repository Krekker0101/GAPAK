/**
 * Client-side realtime cursor.
 *
 * A "cursor" here is the highest backend `sequence` (chat message
 * `sequenceNumber`) the client has successfully applied for a given
 * chat/room. It is purely a client bookkeeping structure: the backend is
 * the source of truth for ordering and gap-filling. On reconnect the
 * transport reads the stored cursor for a chat and asks the backend to
 * resume "after" it, using the existing `subscribe` contract:
 *
 *   {"type":"subscribe","data":{"chat_id":"...","after_sequence":<cursor>}}
 *
 * This class only tracks the cursor value per channel/room; it does not
 * talk to the network and does not guarantee gapless delivery by itself
 * (see docs/REALTIME.md for the client/backend guarantee split).
 */
export class RealtimeCursorStore {
  private readonly cursors = new Map<string, number>();

  /** Highest applied sequence for a channel, or undefined if nothing was ever applied. */
  get(channelId: string): number | undefined {
    return this.cursors.get(channelId);
  }

  /** Advances the cursor for a channel. No-op if `sequence` is not newer than the stored value. */
  advance(channelId: string, sequence: number): void {
    if (!Number.isSafeInteger(sequence)) return;
    const current = this.cursors.get(channelId);
    if (current === undefined || sequence > current) this.cursors.set(channelId, sequence);
  }

  /** True if a cursor has been recorded for this channel. */
  has(channelId: string): boolean {
    return this.cursors.has(channelId);
  }

  /** Removes the cursor for a single channel (e.g. on unsubscribe). */
  clearChannel(channelId: string): void {
    this.cursors.delete(channelId);
  }

  /** Drops every stored cursor (e.g. on logout/dispose). */
  clear(): void {
    this.cursors.clear();
  }

  /** Read-only snapshot, mainly for devtools/tests. */
  snapshot(): ReadonlyMap<string, number> {
    return new Map(this.cursors);
  }
}
