import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ExpandableChipsProps {
  values: string[]
  /** How many chips show before the "+N" button. */
  limit?: number
  /** Tailwind max-width class for one chip. */
  chipWidth?: string
  /** Centre the chips (a centred column). */
  centered?: boolean
  /** What the values are, for the dropdown's heading and name ("Keys", "Hidden from"…). */
  label?: string
}

const CHIP =
  'bg-surface border-border truncate rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold'

const TOGGLE =
  'text-text-muted hover:text-accent hover:bg-accent-tint focus-visible:outline-accent cursor-pointer rounded-full px-1.5 py-0.5 text-[0.7rem] font-semibold transition-colors focus-visible:outline-2 aria-expanded:bg-accent-tint aria-expanded:text-accent'

/** Width of the dropdown (rem × 15px root), used to keep it on the screen. */
const PANEL_WIDTH = 272

/**
 * A row of chips for a table cell: the first few, then a "+N" button. Clicking it opens a small
 * dropdown with **every** value (drawn on the page body, fixed to the screen, so a table's scroll
 * box never clips it); it closes on an outside click, Escape, or a scroll or resize. Generic —
 * it only knows a list of words.
 */
export function ExpandableChips({
  values,
  limit = 2,
  chipWidth = 'max-w-32',
  centered = false,
  label = 'All values',
}: ExpandableChipsProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const hidden = values.length - limit
  const open = position !== null

  useEffect(() => {
    if (!open) return undefined
    const close = () => setPosition(null)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panel.current?.contains(target) || button.current?.contains(target)) return
      close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        button.current?.focus()
      }
    }
    // A menu fixed to the screen would drift from its row, so a scroll or resize closes it.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    if (open) {
      setPosition(null)
      return
    }
    const rect = button.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8))
    setPosition({ top: rect.bottom + 6, left })
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${centered ? 'justify-center' : ''}`}
    >
      {(hidden > 0 ? values.slice(0, limit) : values).map((value) => (
        <span key={value} className={`${CHIP} ${chipWidth}`} title={value}>
          {value}
        </span>
      ))}
      {hidden > 0 && (
        <button
          ref={button}
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          title={`Show all ${values.length}`}
          onClick={toggle}
          className={TOGGLE}
        >
          +{hidden}
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="group"
            aria-label={label}
            style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
            className="border-border bg-bg fixed z-50 flex flex-col gap-2 rounded-xl border p-3 shadow-lg"
          >
            <p className="text-text-muted m-0 text-[0.68rem] font-bold tracking-wide uppercase">
              {label} ({values.length})
            </p>
            <ul className="m-0 flex max-h-56 list-none flex-wrap gap-1.5 overflow-auto p-0">
              {values.map((value) => (
                <li
                  key={value}
                  className="bg-surface border-border rounded-full border px-2.5 py-0.5 text-[0.75rem] font-semibold break-all"
                >
                  {value}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </span>
  )
}
