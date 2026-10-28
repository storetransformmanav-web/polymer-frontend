import { useEffect } from 'react'
import { installDevToolsGuard } from '../lib/devToolsGuard.ts'

/**
 * Turns off the right-click menu (outside text fields) and the shortcuts that open the browser's
 * developer tools or the page source, while `enabled` — see `lib/devToolsGuard.ts` for exactly
 * what is and isn't blocked, and why it is a deterrent and not security. Used once, by
 * `AppProviders`, with the `VITE_BLOCK_DEVTOOLS` setting.
 */
export function useDevToolsGuard(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined
    return installDevToolsGuard(document)
  }, [enabled])
}
