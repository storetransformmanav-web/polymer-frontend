import { useEffect, useState } from 'react'

const STORAGE_KEY = 'polymer-crm:sidebar-collapsed'

function getStoredValue() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Whether the app sidebar is collapsed to icons-only, persisted across
 * sessions. Only the Navbar reads this today — see the same note on
 * `useTheme` about promoting to context if a second consumer needs it.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(getStoredValue)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(collapsed))
    } catch {
      // localStorage unavailable — collapse state just won't persist.
    }
  }, [collapsed])

  return [collapsed, setCollapsed]
}
