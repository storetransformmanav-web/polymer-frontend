import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRightIcon } from './icons.tsx'

interface ScrollRowProps {
  /** Accessible name of the list. */
  label: string
  /** The row's items — render each as an `<li>` (give them a fixed width and `shrink-0`). */
  children: ReactNode
  className?: string
}

const ARROW =
  'border-border bg-bg text-text hover:border-accent absolute top-1/2 z-[1] flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border shadow-md transition-colors'

/**
 * One horizontally scrolling row of items (a filmstrip). It scrolls natively —
 * touch, trackpad, shift + wheel, keyboard focus moving along the items — and
 * snaps item to item. Arrow buttons appear only on the sides that have more
 * to show, and scroll by most of a screenful. The scrollbar is hidden; the
 * arrows (and the clipped last item) say there is more.
 */
export function ScrollRow({ label, children, className = '' }: ScrollRowProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const [canScrollBack, setCanScrollBack] = useState(false)
  const [canScrollForward, setCanScrollForward] = useState(false)

  const update = useCallback(() => {
    const list = listRef.current
    if (!list) return
    // Sub-pixel rounding can leave a fraction of a pixel — treat "almost" as the end.
    setCanScrollBack(list.scrollLeft > 1)
    setCanScrollForward(list.scrollLeft + list.clientWidth < list.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    update()
    list.addEventListener('scroll', update, { passive: true })
    // Resizes (and items arriving) change what fits; not every environment has the observer.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(list)
    for (const child of Array.from(list.children)) observer?.observe(child)
    return () => {
      list.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [update, children])

  function scrollBy(direction: 1 | -1) {
    const list = listRef.current
    if (!list) return
    list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div className={`relative ${className}`}>
      {canScrollBack && (
        <button
          type="button"
          aria-label={`Scroll ${label} back`}
          onClick={() => scrollBy(-1)}
          className={`${ARROW} -left-3`}
        >
          <ChevronRightIcon width={16} height={16} className="rotate-180" />
        </button>
      )}

      <ul
        ref={listRef}
        aria-label={label}
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-2 overflow-x-auto scroll-smooth motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>

      {canScrollForward && (
        <button
          type="button"
          aria-label={`Scroll ${label} forward`}
          onClick={() => scrollBy(1)}
          className={`${ARROW} -right-3`}
        >
          <ChevronRightIcon width={16} height={16} />
        </button>
      )}
    </div>
  )
}
