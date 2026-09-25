import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../app/store/hooks.ts'
import { THEME_STORAGE_KEY, themeSet, type Theme } from '../app/store/uiSlice.ts'

export { THEME_STORAGE_KEY }
export type { Theme }

/**
 * Light/dark theme, backed by the `ui` Redux slice (persisted to
 * localStorage there) and applied here via `[data-theme]` on `<html>`
 * (see src/styles/globals.css). Defaults to `'light'` when nothing is
 * stored yet; `'system'` is still available as an explicit choice and
 * defers to the OS preference instead of forcing a mode.
 */
export function useTheme() {
  const theme = useAppSelector((state) => state.ui.theme)
  const dispatch = useAppDispatch()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  function setTheme(next: Theme) {
    dispatch(themeSet(next))
  }

  return { theme, setTheme }
}
