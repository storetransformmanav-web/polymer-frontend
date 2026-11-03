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
 * The strip of opened locks, as the products page has. It belongs to the Locks page alone, so
 * it is plain local state (the page stays mounted while a lock is open), not a store slice.
 */
export function useLockTabs() {
  const [tabs, setTabs] = useState<LockTab[]>([])

  /** Adds the tab if it is new; fills in a title that was not known before. */
  const openTab = useCallback((tab: LockTab) => {
    setTabs((current) => {
      const existing = current.find((item) => item.id === tab.id)
      if (!existing) return [...current, tab].slice(-MAX_TABS)
      if (existing.title || !tab.title) return current
      return current.map((item) => (item.id === tab.id ? { ...item, ...tab } : item))
    })
  }, [])

  const closeTab = useCallback(
    (id: string) => setTabs((current) => current.filter((tab) => tab.id !== id)),
    [],
  )
  const clearTabs = useCallback(() => setTabs([]), [])

  return { tabs, openTab, closeTab, clearTabs }
}
