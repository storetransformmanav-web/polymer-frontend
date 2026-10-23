import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const SLOT_ID = 'app-bar-actions'

/**
 * The spot in the top bar, just before the global actions, where a page can put its own
 * buttons (see `InAppBar`). It takes no room while nothing is in it.
 */
export function AppBarSlot() {
  return <div id={SLOT_ID} className="flex min-w-0 items-center gap-3 empty:hidden" />
}

/**
 * Shows `children` in the top bar's `AppBarSlot` while this component is mounted, however
 * deep in the page it is — so the page keeps the state behind a button (what it exports,
 * which filters it has) and the button sits beside the bar's other actions. Without a bar
 * (a page rendered on its own) the children stay where they are.
 */
export function InAppBar({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  // The bar and the page mount together, so the slot is only there once they have.
  useEffect(() => {
    setSlot(document.getElementById(SLOT_ID))
  }, [])

  return slot ? createPortal(children, slot) : children
}
