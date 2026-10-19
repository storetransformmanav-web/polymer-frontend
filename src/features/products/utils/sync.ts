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

/**
 * The backend passes the store's error on as a dump (`[{'message': '…', 'locations': …}]`).
 * This pulls out the first human-readable message, or returns the text as it came.
 */
export function readableSyncError(raw: string): string {
  const single = /'message':\s*'((?:[^'\\]|\\.)*)'/.exec(raw)
  const double = /"message":\s*"((?:[^"\\]|\\.)*)"/.exec(raw)
  const match = single ?? double
  return match ? match[1].replace(/\\(['"])/g, '$1') : raw
}

/**
 * A short explanation when retrying cannot help: the store refused because the
 * app connected to it lacks a permission, which has to be fixed in the store / backend.
 */
export function syncFailureHint(raw: string): string | null {
  return /ACCESS_DENIED|access denied|access scope/i.test(raw)
    ? "The store's app connection is missing a permission, so Retry will not help — it has to be granted in Shopify (or the backend's app settings) first."
    : null
}
