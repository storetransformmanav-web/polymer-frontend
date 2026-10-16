import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarIcon, ChevronDownIcon, ChevronRightIcon } from './icons.tsx'
import {
  RANGE_PRESETS,
  describeRange,
  formatDayLong,
  matchingPreset,
  monthGrid,
  parseYmd,
  toYmd,
} from './dateRange.ts'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
/** Space kept between the panel and the edges of the window. */
const EDGE = 12

interface DateRangePickerProps {
  /** The button's accessible name (e.g. "Date range"). */
  label: string
  id?: string
  /** `YYYY-MM-DD` or '' — both empty means "All Time". */
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}

interface Month {
  year: number
  month: number
}

const monthOf = (date: Date): Month => ({
  year: date.getFullYear(),
  month: date.getMonth(),
})

/**
 * A date-range filter: one button that opens a panel with quick choices (Today,
 * Last 7 days, This month…) beside a month calendar. Click a day, then a second
 * day, to pick any range; a quick choice applies at once. The range is only
 * reported when it is complete, so a half-picked range never reaches a query.
 */
export function DateRangePicker({ label, id, from, to, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<Month>(() => monthOf(new Date()))
  // The first day of a range being picked, waiting for the second.
  const [anchor, setAnchor] = useState<string | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // The panel is portalled to the page and positioned from the button, so no
  // container with `overflow: hidden` (a collapsing filter grid, a table's
  // scroll area) can clip it. It lines up under the button, moves to the other
  // edge or above it when there isn't room, and follows scrolling and resizing.
  const place = useCallback(() => {
    const trigger = button.current?.getBoundingClientRect()
    const box = panel.current
    if (!trigger || !box) return
    const { offsetWidth: width, offsetHeight: height } = box
    let left = trigger.left
    if (left + width > window.innerWidth - EDGE) {
      left = Math.max(EDGE, trigger.right - width)
    }
    let top = trigger.bottom + 6
    if (top + height > window.innerHeight - EDGE && trigger.top - 6 - height >= EDGE) {
      top = trigger.top - 6 - height
    }
    setPosition({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) return undefined
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!root.current?.contains(target) && !panel.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const today = new Date()
  const active = matchingPreset({ from, to }, today)

  function toggle() {
    if (!open) {
      const start = parseYmd(from) ?? new Date()
      setView(monthOf(start))
      setAnchor(null)
    }
    setOpen((current) => !current)
  }

  function apply(range: { from: string; to: string }) {
    onChange(range)
    setAnchor(null)
    setOpen(false)
    button.current?.focus()
  }

  function pick(day: Date) {
    const ymd = toYmd(day)
    if (anchor === null) {
      setAnchor(ymd)
      return
    }
    apply(anchor <= ymd ? { from: anchor, to: ymd } : { from: ymd, to: anchor })
  }

  function step(delta: number) {
    setView(({ year, month }) => monthOf(new Date(year, month + delta, 1)))
  }

  // What the calendar highlights: the range being picked, or the chosen one.
  const low = anchor ?? (from || to)
  const high = anchor ?? (to || from)
  const todayYmd = toYmd(today)
  const title = new Date(view.year, view.month, 1)

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
          button.current?.focus()
        }
      }}
    >
      <button
        ref={button}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${describeRange({ from, to }, today)}`}
        onClick={toggle}
        className="border-border bg-bg text-text hover:border-accent focus-visible:border-accent focus-visible:outline-accent-tint flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-left text-[0.85rem] font-medium transition-colors focus-visible:outline-2"
      >
        <CalendarIcon width={16} height={16} className="text-text-muted shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {describeRange({ from, to }, today)}
        </span>
        <ChevronDownIcon
          width={14}
          height={14}
          className={`text-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={label}
            style={{ top: position?.top ?? 0, left: position?.left ?? 0 }}
            className="border-border bg-bg fixed z-50 flex w-[min(34rem,calc(100vw-1.5rem))] flex-col gap-3 rounded-xl border p-3 shadow-lg sm:flex-row"
          >
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:w-40 sm:shrink-0 sm:flex-col">
              {RANGE_PRESETS.map((preset) => {
                const selected = preset === active
                return (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => apply(preset.range(today))}
                    className={`h-9 cursor-pointer rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors ${
                      selected
                        ? 'border-accent bg-accent-tint text-accent'
                        : 'border-border bg-bg text-text hover:border-accent hover:text-accent'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => step(-1)}
                  className="text-text-muted hover:text-accent hover:bg-accent-tint flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
                >
                  <ChevronRightIcon width={16} height={16} className="rotate-180" />
                </button>
                <p aria-live="polite" className="text-[0.95rem] font-bold">
                  <span className="text-accent">
                    {title.toLocaleDateString('en-GB', { month: 'long' })}
                  </span>{' '}
                  <span className="text-text-muted">{view.year}</span>
                </p>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => step(1)}
                  className="text-text-muted hover:text-accent hover:bg-accent-tint flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
                >
                  <ChevronRightIcon width={16} height={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-y-0.5 text-center">
                {WEEKDAYS.map((day) => (
                  <span key={day} className="text-text py-1.5 text-[0.78rem] font-bold">
                    {day}
                  </span>
                ))}
                {monthGrid(view.year, view.month).map((day) => {
                  const ymd = toYmd(day)
                  const inMonth = day.getMonth() === view.month
                  const isEdge = ymd === low || ymd === high
                  const inRange = !!low && !!high && ymd >= low && ymd <= high
                  return (
                    <button
                      key={ymd}
                      type="button"
                      aria-label={formatDayLong(day)}
                      aria-pressed={inRange}
                      onClick={() => pick(day)}
                      className={`mx-auto h-9 w-full cursor-pointer border-none text-[0.85rem] font-medium transition-colors ${
                        isEdge
                          ? 'bg-accent text-accent-contrast rounded-lg font-bold'
                          : inRange
                            ? 'bg-accent-tint text-accent'
                            : `hover:bg-accent-tint rounded-lg bg-transparent ${
                                inMonth ? 'text-text' : 'text-text-muted/50'
                              }`
                      } ${ymd === todayYmd && !isEdge ? 'text-accent font-bold' : ''}`}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>

              {anchor !== null && (
                <p className="text-text-muted mt-2 text-[0.78rem]">
                  Now pick the last day of the range.
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
