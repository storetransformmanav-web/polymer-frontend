import { useEffect, useState } from 'react'

// Keep in sync with the inline script in index.html, which reads this
// same key to set [data-theme] before first paint (avoids a flash of
// the wrong theme).
export const THEME_STORAGE_KEY = 'polymer-crm:theme'
const THEMES = ['light', 'dark', 'system']
const DEFAULT_THEME = 'light'

function getStoredTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return THEMES.includes(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/**
 * Light/dark theme, persisted to localStorage and applied via
 * `[data-theme]` on `<html>` (see src/styles/globals.css). Defaults to
 * `'light'` when nothing is stored yet; `'system'` is still available
 * as an explicit choice and defers to the OS preference instead of
 * forcing a mode.
 *
 * Only one component (ThemeToggle, in the AppBar's UserMenu) reads
 * this today, so it's a plain hook rather than context — if a second,
 * unrelated consumer needs the same live value, promote this to a
 * context provider instead of having two independent instances drift.
 */
export function useTheme() {
  const [theme, setThemeState] = useState(getStoredTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // localStorage unavailable (private browsing, etc.) — the theme
      // still applies for this session via the DOM attribute above.
    }
  }, [theme])

  function setTheme(next) {
    setThemeState(THEMES.includes(next) ? next : DEFAULT_THEME)
  }

  return { theme, setTheme }
}
