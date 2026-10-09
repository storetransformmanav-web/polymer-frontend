import { useSyncExternalStore } from 'react'

/**
 * Subscribes to a CSS media query. Returns `fallback` where `matchMedia`
 * doesn't exist (SSR, jsdom), so components render the desktop layout by
 * default in tests.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () =>
      typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : fallback,
    () => fallback,
  )
}
