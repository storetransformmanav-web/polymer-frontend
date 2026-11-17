import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { InfoIcon } from './icons.tsx'

const TIP_WIDTH = 256
const GAP = 8
const EDGE = 8

interface Placement {
  left: number
  top: number
  /** Where the little pointer sits, from the tooltip's left edge. */
  pointer: number
  above: boolean
}

/**
 * A small (i) button that explains something in a tooltip when the pointer rests on it or it has
 * keyboard focus. The tooltip is drawn on the page body with fixed positioning, so no card, table or
 * scrolling box around it can cut it off; it opens below the icon (above when there is no room),
 * stays inside the window, and closes on Escape, scroll or resize. Nothing happens on a click, so
 * it can sit beside a clickable title without pressing it.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [place, setPlace] = useState<Placement | null>(null)
  const id = useId()

  function show() {
    if (!anchor) return
    const box = anchor.getBoundingClientRect()
    const centre = box.left + box.width / 2
    const left = Math.min(
      Math.max(centre - TIP_WIDTH / 2, EDGE),
      Math.max(window.innerWidth - TIP_WIDTH - EDGE, EDGE),
    )
    // Not enough room under the icon for a typical tooltip: open above it instead.
    const above = window.innerHeight - box.bottom < 140 && box.top > 140
    setPlace({
      left,
      top: above ? box.top - GAP : box.bottom + GAP,
      pointer: Math.min(Math.max(centre - left, 14), TIP_WIDTH - 14),
      above,
    })
  }
  const hide = () => setPlace(null)

  useEffect(() => {
    if (!place) return
    const close = () => setPlace(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPlace(null)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [place])

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={place ? id : undefined}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="text-text-muted hover:text-accent focus-visible:outline-accent inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border-none bg-transparent p-0 transition-colors focus-visible:outline-2"
      >
        <InfoIcon width={14} height={14} />
      </button>
      {place &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{
              left: place.left,
              top: place.top,
              width: TIP_WIDTH,
              transform: place.above ? 'translateY(-100%)' : undefined,
            }}
            className="bg-text text-bg pointer-events-none fixed z-[100] rounded-lg px-3.5 py-2.5 text-left text-[0.76rem] leading-relaxed font-medium tracking-normal normal-case shadow-lg"
          >
            <span
              aria-hidden="true"
              style={{ left: place.pointer - 5 }}
              className={`bg-text absolute h-2.5 w-2.5 rotate-45 ${
                place.above ? '-bottom-[5px]' : '-top-[5px]'
              }`}
            />
            <span className="relative">{text}</span>
          </span>,
          document.body,
        )}
    </>
  )
}
