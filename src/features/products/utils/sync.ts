/** How a push to the store is going. */
export type SyncState = 'syncing' | 'synced' | 'failed'

/**
 * The backend reports a push's status as free text. "…fail…" / "…error…" is a
 * failure, "success" / "synced" / "done" / "complete" is finished, and anything
 * else (pending, running, queued) means it is still in progress.
 */
export function classifySync(status: string | null | undefined): SyncState {
  const value = (status ?? '').toLowerCase()
  if (/fail|error/.test(value)) return 'failed'
  if (/success|synced|done|complete|^ok$/.test(value)) return 'synced'
  return 'syncing'
}
