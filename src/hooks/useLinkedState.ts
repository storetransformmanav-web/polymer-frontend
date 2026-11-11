import { useLocation } from 'react-router-dom'

/**
 * The router state a link carries when it opens a record (a customer, a product) inside another
 * page as a tab: the name for the tab, and the address it was opened from. Closing that tab goes
 * back to that address — not "back in the browser's history", which could be a different page
 * entirely when the person left and came back with the Back button.
 */
export function useLinkedState() {
  const location = useLocation()
  const from = location.pathname + location.search
  return (name?: string | null) => ({ linkedName: name ?? undefined, from })
}

/** The address a linked tab was opened from, when it is inside `prefix` (else null). */
export function readLinkedFrom(state: unknown, prefix: string): string | null {
  const from = (state as { from?: unknown } | null)?.from
  return typeof from === 'string' &&
    (from === prefix || from.startsWith(`${prefix}/`) || from.startsWith(`${prefix}?`))
    ? from
    : null
}
