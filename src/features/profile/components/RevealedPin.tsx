import { useEffect } from 'react'
import { useNow } from '../hooks/useNow.ts'
import { clock, secondsUntil } from '../utils/clock.ts'

/** A PIN the person has just verified their way to, and how long it may stay on screen. */
export interface ViewedPin {
  pin: string
  /** When it must be hidden again; null when the backend sets no limit. */
  hideAt: number | null
  changeRequired: boolean
}

/**
 * The verified PIN, shown on the profile page with its countdown. `onExpire` is called once the
 * backend's display time has passed, and the page puts the asterisks back.
 */
export function RevealedPin({
  viewed,
  onExpire,
}: {
  viewed: ViewedPin
  onExpire: () => void
}) {
  const now = useNow()
  const left = secondsUntil(viewed.hideAt, now)
  const timeUp = viewed.hideAt !== null && now >= viewed.hideAt

  useEffect(() => {
    if (timeUp) onExpire()
  }, [timeUp, onExpire])

  if (timeUp) return null
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span
        aria-label="Your security PIN"
        className="bg-accent-tint text-text rounded-md px-2 py-0.5 text-[0.95rem] font-bold tracking-[0.25em] break-all"
      >
        {viewed.pin}
      </span>
      {left !== null && (
        <span className="text-text-muted text-[0.75rem] font-normal whitespace-nowrap">
          Hides in {clock(left)}
        </span>
      )}
    </span>
  )
}
