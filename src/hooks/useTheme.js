import { useEffect, useState } from 'react'

// Keep in sync with the inline script in index.html, which reads this
// same key to set [data-theme] before first paint (avoids a flash of
// the wrong theme).
export const THEME_STORAGE_KEY = 'polymer-crm:theme'
const THEMES = ['system', 'light', 'dark']

function getStoredTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return THEMES.includes(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Light/dark theme, persisted to localStorage and applied via
 * `[data-theme]` on `<html>` (see src/styles/globals.css). `'system'`
 * defers to the OS preference instead of forcing a mode.
 *
 * Only one component (ThemeToggle) reads this today, so it's a plain
 * hook rather than context — if a second, unrelated consumer needs the
 * same live value, promote this to a context provider instead of
 * having two independent instances drift.
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
    setThemeState(THEMES.includes(next) ? next : 'system')
  }

  function cycleTheme() {
    setThemeState((current) => THEMES[(THEMES.indexOf(current) + 1) % THEMES.length])
  }

  return { theme, setTheme, cycleTheme }
}
