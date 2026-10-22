import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, XIcon } from './icons.tsx'
import {
  RANGE_PRESETS,
  formatDayLong,
  matchingPreset,
  monthGrid,
  parseYmd,
  toYmd,
} from './dateRange.ts'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Date(2026, month, 1).toLocaleDateString('en-GB', { month: 'long' }),
)
const CUSTOM = 'Custom Range'
/** Space kept between a popup and the edges of the window. */
const EDGE = 12

const CONTROL =
  'border-border bg-bg text-text hover:border-accent focus-within:border-accent focus-within:outline-accent-tint relative flex h-10 min-w-0 items-center rounded-lg border text-[0.85rem] font-medium transition-colors focus-within:outline-2'
const CLEAR_BUTTON =
  'absolute top-1/2 right-2 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0'
const SELECT_RESET =
  'text-text min-w-0 cursor-pointer appearance-none border-none bg-transparent font-bold outline-none'

interface DateRangePickerProps {
  /** The group's accessible name (e.g. "Date range"). */
  label: string
  id?: string
  /** `YYYY-MM-DD` or '' — both empty means "All Time". Either side may stay empty. */
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}

type Side = 'from' | 'to'

interface Month {
  year: number
  month: number
}

interface Place {
  top: number
  left: number
  minWidth?: number
}

const monthOf = (date: Date): Month => ({
  year: date.getFullYear(),
  month: date.getMonth(),
})

/**
 * Puts a portalled popup under its anchor (or above it, or against the other edge, when
 * there is no room) and keeps it there while the page scrolls or resizes — so no
 * container with `overflow: hidden` (a collapsing filter grid, a table's scroll area)
 * can clip it. `anchor` is the element to line up with (the input's box, for a field).
 */
function usePopupPlace(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  popup: RefObject<HTMLDivElement | null>,
  useParent = false,
): Place | null {
  const [position, setPosition] = useState<Place | null>(null)

  useLayoutEffect(() => {
    if (!open) return undefined
    function place() {
      const element = useParent ? anchor.current?.parentElement : anchor.current
      const trigger = element?.getBoundingClientRect()
      const box = popup.current
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
      setPosition({ top, left, minWidth: trigger.width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor, popup, useParent])

  return position
}

interface DateFieldProps {
  side: Side
  label: string
  value: string
  invalid: boolean
  inputRef: RefObject<HTMLInputElement | null>
  onOpen: (side: Side) => void
  onCommit: (value: string) => void
}

/** A typed `yyyy-mm-dd` box. It applies a value as soon as it is a real day (or empty). */
function DateField({
  side,
  label,
  value,
  invalid,
  inputRef,
  onOpen,
  onCommit,
}: DateFieldProps) {
  // What is being typed; null = show the chosen day.
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <div className={`${CONTROL} w-36`}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder="yyyy-mm-dd"
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={draft ?? value}
        onFocus={() => onOpen(side)}
        onClick={() => onOpen(side)}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          if (next === '') onCommit('')
          else if (parseYmd(next)) onCommit(next)
        }}
        className="text-text placeholder:text-text-muted h-full min-w-0 flex-1 rounded-lg border-none bg-transparent pr-8 pl-3 outline-none"
      />
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            setDraft(null)
            onCommit('')
            inputRef.current?.focus()
          }}
          className={`${CLEAR_BUTTON} text-danger hover:bg-danger-bg`}
        >
          <XIcon width={12} height={12} />
        </button>
      )}
    </div>
  )
}

/**
 * A date-range filter in the style of the order-management design: a dropdown of quick
 * choices — All Time, Today, Last 7/30/60 Days, **Custom Range**. Choosing Custom Range
 * (or opening a range that isn't one of the quick choices) shows two typed `yyyy-mm-dd`
 * boxes beside it, with a month calendar that opens under the active box: choose the
 * first day, the calendar moves on to the last day and greys out the days before the
 * first. A choice applies as soon as it is made, and either end may be left open.
 */
export function DateRangePicker({ label, id, from, to, onChange }: DateRangePickerProps) {
  const today = new Date()
  const todayYmd = toYmd(today)
  const hasRange = Boolean(from || to)
  const preset = matchingPreset({ from, to }, today)

  // "Custom Range" stays chosen while its days are being typed, even when they happen
  // to equal a quick choice; a range that isn't a quick choice is always custom.
  const [customChosen, setCustomChosen] = useState(false)
  const custom = customChosen || (hasRange && !preset)
  const current = custom ? CUSTOM : (preset?.label ?? CUSTOM)

  const [menuOpen, setMenuOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [side, setSide] = useState<Side>('from')
  const [view, setView] = useState<Month>(() => monthOf(new Date()))
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const calendar = useRef<HTMLDivElement>(null)
  const fromInput = useRef<HTMLInputElement>(null)
  const focusFrom = useRef(false)
  const toInput = useRef<HTMLInputElement>(null)

  const menuPosition = usePopupPlace(menuOpen, trigger, menu)
  const calendarPosition = usePopupPlace(
    calendarOpen,
    side === 'from' ? fromInput : toInput,
    calendar,
    true,
  )
  const wrongOrder = Boolean(from && to && from > to)

  useEffect(() => {
    if (!menuOpen && !calendarOpen) return undefined
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (
        !root.current?.contains(target) &&
        !menu.current?.contains(target) &&
        !calendar.current?.contains(target)
      ) {
        setMenuOpen(false)
        setCalendarOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen, calendarOpen])

  // The menu's first focus goes to the chosen option.
  useEffect(() => {
    if (!menuOpen) return
    const options = menu.current?.querySelectorAll<HTMLElement>('[role="option"]')
    const chosen = menu.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    ;(chosen ?? options?.[0])?.focus()
  }, [menuOpen])

  // "Custom Range" was just chosen: once its boxes exist, the cursor goes to the first.
  useEffect(() => {
    if (focusFrom.current && fromInput.current) {
      focusFrom.current = false
      fromInput.current.focus()
    }
  })

  function openCalendarFor(next: Side) {
    setSide(next)
    if (!calendarOpen || next !== side) {
      const day = parseYmd(next === 'from' ? from || to : to || from)
      setView(monthOf(day ?? new Date()))
    }
    setMenuOpen(false)
    setCalendarOpen(true)
  }

  function choose(name: string) {
    setMenuOpen(false)
    if (name === CUSTOM) {
      setCustomChosen(true)
      // The cursor goes to the first box, which opens the calendar under it.
      if (fromInput.current) fromInput.current.focus()
      else focusFrom.current = true
      return
    }
    const quick = RANGE_PRESETS.find((item) => item.label === name)
    if (!quick) return
    setCustomChosen(false)
    setCalendarOpen(false)
    onChange(quick.range(today))
    trigger.current?.focus()
  }

  function clearAll() {
    setCustomChosen(false)
    setCalendarOpen(false)
    onChange({ from: '', to: '' })
    trigger.current?.focus()
  }

  function setDay(which: Side, value: string) {
    setCustomChosen(true)
    onChange(which === 'from' ? { from: value, to } : { from, to: value })
  }

  function pick(day: Date) {
    const ymd = toYmd(day)
    setCustomChosen(true)
    if (side === 'from') {
      onChange({ from: ymd, to })
      if (to) {
        setCalendarOpen(false)
      } else {
        // On to the last day, with the calendar left open.
        setSide('to')
        toInput.current?.focus()
      }
    } else {
      onChange({ from, to: ymd })
      setCalendarOpen(false)
    }
  }

  function step(delta: number) {
    setView(({ year, month }) => monthOf(new Date(year, month + delta, 1)))
  }

  function onMenuKey(event: KeyboardEvent) {
    const options = [
      ...(menu.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []),
    ]
    const index = options.indexOf(document.activeElement as HTMLElement)
    const move = (to: number) => {
      event.preventDefault()
      options[(to + options.length) % options.length]?.focus()
    }
    if (event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(options.length - 1)
  }

  // What the calendar highlights: the chosen range.
  const low = from || to
  const high = to || from
  const firstYear = Math.min(today.getFullYear() - 10, view.year)
  const lastYear = Math.max(today.getFullYear() + 2, view.year)
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i)
  const choices = [...RANGE_PRESETS.map((item) => item.label), CUSTOM]

  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-2"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && (menuOpen || calendarOpen)) {
          event.stopPropagation()
          setMenuOpen(false)
          setCalendarOpen(false)
          if (menuOpen) trigger.current?.focus()
        }
      }}
    >
      <div
        className={`${CONTROL} ${menuOpen ? 'border-accent outline-accent-tint outline-2' : ''} ${
          custom ? 'w-44' : 'w-40'
        }`}
      >
        <button
          ref={trigger}
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-label={`${label}: ${current}`}
          onClick={() => {
            setCalendarOpen(false)
            setMenuOpen((open) => !open)
          }}
          className="text-text h-full min-w-0 flex-1 cursor-pointer rounded-lg border-none bg-transparent pr-8 pl-3 text-left font-bold"
        >
          <span className="block truncate">{current}</span>
        </button>
        {custom ? (
          <button
            type="button"
            aria-label="Clear date range"
            onClick={clearAll}
            className={`${CLEAR_BUTTON} text-text-muted hover:text-danger hover:bg-danger-bg`}
          >
            <XIcon width={14} height={14} />
          </button>
        ) : (
          <ChevronDownIcon
            width={14}
            height={14}
            className={`text-text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 transition-transform ${
              menuOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </div>

      {custom && (
        <>
          <DateField
            side="from"
            label="From date"
            value={from}
            invalid={wrongOrder}
            inputRef={fromInput}
            onOpen={openCalendarFor}
            onCommit={(value) => setDay('from', value)}
          />
          <span aria-hidden="true" className="text-text-muted font-semibold">
            -
          </span>
          <DateField
            side="to"
            label="To date"
            value={to}
            invalid={wrongOrder}
            inputRef={toInput}
            onOpen={openCalendarFor}
            onCommit={(value) => setDay('to', value)}
          />
        </>
      )}

      {menuOpen &&
        createPortal(
          <div
            ref={menu}
            role="listbox"
            aria-label={`${label} quick choices`}
            onKeyDown={onMenuKey}
            style={{
              top: menuPosition?.top ?? 0,
              left: menuPosition?.left ?? 0,
              minWidth: Math.max(menuPosition?.minWidth ?? 0, 176),
            }}
            className="border-border bg-bg fixed z-50 flex flex-col gap-0.5 rounded-xl border p-1.5 shadow-lg"
          >
            {choices.map((name) => {
              const selected = name === current
              return (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(name)}
                  className={`hover:bg-accent-tint focus-visible:bg-accent-tint flex h-9 cursor-pointer items-center justify-between gap-3 rounded-lg border-none px-3 text-left text-[0.85rem] font-semibold outline-none ${
                    selected ? 'bg-accent-tint text-text' : 'text-text bg-transparent'
                  }`}
                >
                  {name}
                  {selected && (
                    <CheckIcon width={14} height={14} className="text-accent" />
                  )}
                </button>
              )
            })}
          </div>,
          document.body,
        )}

      {calendarOpen &&
        createPortal(
          <div
            ref={calendar}
            role="dialog"
            aria-label={label}
            style={{
              top: calendarPosition?.top ?? 0,
              left: calendarPosition?.left ?? 0,
            }}
            className="border-border bg-bg fixed z-50 w-[min(18.5rem,calc(100vw-1.5rem))] rounded-xl border p-4 shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => step(-1)}
                className="text-text-muted hover:text-accent hover:bg-accent-tint flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
              >
                <ChevronRightIcon width={16} height={16} className="rotate-180" />
              </button>
              <div className="flex items-center gap-3 text-[0.88rem]">
                <span className="relative flex items-center gap-1">
                  <select
                    aria-label="Month"
                    value={view.month}
                    onChange={(event) =>
                      setView({ ...view, month: Number(event.target.value) })
                    }
                    className={`${SELECT_RESET} pr-4`}
                  >
                    {MONTHS.map((name, month) => (
                      <option key={name} value={month}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon
                    width={11}
                    height={11}
                    className="text-text-muted pointer-events-none absolute right-0"
                  />
                </span>
                <span className="relative flex items-center gap-1">
                  <select
                    aria-label="Year"
                    value={view.year}
                    onChange={(event) =>
                      setView({ ...view, year: Number(event.target.value) })
                    }
                    className={`${SELECT_RESET} pr-4`}
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon
                    width={11}
                    height={11}
                    className="text-text-muted pointer-events-none absolute right-0"
                  />
                </span>
              </div>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => step(1)}
                className="text-text-muted hover:text-accent hover:bg-accent-tint flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
              >
                <ChevronRightIcon width={16} height={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center">
              {WEEKDAYS.map((day) => (
                <span
                  key={day}
                  className="text-text-muted py-1.5 text-[0.74rem] font-semibold"
                >
                  {day}
                </span>
              ))}
              {monthGrid(view.year, view.month).map((day) => {
                const ymd = toYmd(day)
                const inMonth = day.getMonth() === view.month
                const isEdge = ymd === low || ymd === high
                const inRange = !!low && !!high && ymd >= low && ymd <= high
                // The last day can't come before the first, nor the first after the last.
                const blocked = side === 'to' ? !!from && ymd < from : !!to && ymd > to
                return (
                  <button
                    key={ymd}
                    type="button"
                    disabled={blocked}
                    aria-label={formatDayLong(day)}
                    aria-pressed={inRange}
                    aria-current={ymd === todayYmd ? 'date' : undefined}
                    onClick={() => pick(day)}
                    className={`mx-auto h-9 w-9 rounded-lg border text-[0.85rem] font-medium transition-colors ${
                      blocked
                        ? 'bg-surface text-text-muted/40 cursor-not-allowed border-transparent'
                        : isEdge
                          ? 'bg-accent text-accent-contrast cursor-pointer border-transparent font-bold'
                          : inRange
                            ? 'bg-accent-tint text-accent cursor-pointer border-transparent'
                            : `hover:bg-accent-tint cursor-pointer bg-transparent ${
                                ymd === todayYmd
                                  ? 'border-accent text-text font-bold'
                                  : 'border-transparent'
                              } ${inMonth ? 'text-text' : 'text-text-muted/60'}`
                    }`}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
