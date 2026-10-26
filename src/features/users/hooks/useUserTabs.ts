import { useCallback, useState } from 'react'

export interface UserTab {
  id: string
  /** The person's name; null until it is known (opened from a bare URL). */
  name: string | null
  email: string | null
}

/** How many opened users the strip keeps — the oldest is dropped past this. */
const MAX_TABS = 10

/**
 * The strip of opened users. It belongs to the Users page alone, so it is plain local state
 * (the page stays mounted while a user is open), not a store slice.
 */
export function useUserTabs() {
  const [tabs, setTabs] = useState<UserTab[]>([])

  /** Adds the tab if it is new; fills in a name that was not known before. */
  const openTab = useCallback((tab: UserTab) => {
    setTabs((current) => {
      const existing = current.find((item) => item.id === tab.id)
      if (!existing) return [...current, tab].slice(-MAX_TABS)
      if (existing.name || !tab.name) return current
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
