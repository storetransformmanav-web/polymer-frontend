import { useCallback, useState } from 'react'

export interface LockTab {
  /** The lock's handle (its address, `/locks/<handle>`). */
  id: string
  /** The protected product's name; null until it is known (opened from a bare URL). */
  title: string | null
}

/** How many opened locks the strip keeps — the oldest is dropped past this. */
const MAX_TABS = 10

/**
 * What the Locks page keeps when it is left (the person goes to another page and comes back): the
 * strip of opened locks, and the lock that was on screen — with the store it belongs to — so
 * coming back reopens it instead of landing on the list. Plain module state: it lives as long
 * as the tab does, and the page itself decides when it is no longer true (the list was shown).
 */
export const lockMemory: {
  tabs: LockTab[]
  open: { shop: string; path: string } | null
} = { tabs: [], open: null }

/**
 * The strip of opened locks, as the products page has. It belongs to the Locks page alone, so
 * it is plain local state (the page stays mounted while a lock is open), not a store slice — but
 * it starts from `lockMemory`, so the strip survives a visit to another page.
 */
export function useLockTabs() {
  const [tabs, setTabsState] = useState<LockTab[]>(() => lockMemory.tabs)
  const setTabs = useCallback((update: (current: LockTab[]) => LockTab[]) => {
    setTabsState((current) => {
      const next = update(current)
      lockMemory.tabs = next
      return next
    })
  }, [])

  /** Adds the tab if it is new; fills in a title that was not known before. */
  const openTab = useCallback(
    (tab: LockTab) => {
      setTabs((current) => {
        const existing = current.find((item) => item.id === tab.id)
        if (!existing) return [...current, tab].slice(-MAX_TABS)
        if (existing.title || !tab.title) return current
        return current.map((item) => (item.id === tab.id ? { ...item, ...tab } : item))
      })
    },
    [setTabs],
  )

  const closeTab = useCallback(
    (id: string) => setTabs((current) => current.filter((tab) => tab.id !== id)),
    [setTabs],
  )
  const clearTabs = useCallback(() => setTabs(() => []), [setTabs])

  return { tabs, openTab, closeTab, clearTabs }
}
