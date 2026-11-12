import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, SearchIcon, type IconProps } from './icons.tsx'

/** How many matches are drawn before the list says to type more. */
const MAX_SHOWN = 100
/** The room a list wants under its button before it opens upward instead (px). */
const LIST_ROOM = 280

interface Place {
  left: number
  width: number
  top?: number
  bottom?: number
  visible: boolean
}

interface SearchableSelectFieldProps {
  id: string
  label: string
  /** The chosen value, '' for "all". */
  value: string
  /** Every value that can be chosen. */
  values: readonly string[]
  /** What the empty choice says, e.g. "All Tags". */
  allLabel: string
  onChange: (value: string) => void
  icon?: ComponentType<IconProps>
  /** A smaller control for a dense grid of filters (same as `SelectField`'s). */
  compact?: boolean
}

/**
 * A dropdown with a search box, for a long list (every tag a store has): the button looks like a
 * `SelectField`; opening it shows a box to type in and the values that contain what was typed
 * (those starting with it first), plus the "all" choice. Click one, or use ↑/↓ and Enter;
 * Escape or a click outside closes it. The list is drawn over the page (so no scrolling card
 * clips it) and follows its button while the page scrolls.
 */
export function SearchableSelectField({
  id,
  label,
  value,
  values,
  allLabel,
  onChange,
  icon: Icon,
  compact = false,
}: SearchableSelectFieldProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState<Place | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const needle = query.trim().toLowerCase()
  const matches = useMemo(() => {
    const hits = values.filter((item) => !needle || item.toLowerCase().includes(needle))
    const starts = (item: string) => (item.toLowerCase().startsWith(needle) ? 0 : 1)
    return needle
      ? [...hits].sort(
          (a, b) =>
            starts(a) - starts(b) || a.localeCompare(b, 'en', { sensitivity: 'base' }),
        )
      : hits
  }, [values, needle])
  const shown = matches.slice(0, MAX_SHOWN)
  // The "all" choice leads the list while nothing is typed.
  const rows = needle ? shown : ['', ...shown]

  function close(returnFocus = true) {
    setOpen(false)
    setQuery('')
    if (returnFocus) button.current?.focus()
  }

  function choose(next: string) {
    onChange(next)
    close()
  }

  function openList() {
    setActive(Math.max(0, value ? values.indexOf(value) + 1 : 0))
    setOpen(true)
  }

  // Placed under the button (or above it with no room), fixed to the screen.
  useEffect(() => {
    if (!open) return undefined
    function measure() {
      const rect = button.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom
      const upward = below < LIST_ROOM && rect.top > below
      setPlace({
        left: rect.left,
        width: Math.max(rect.width, 224),
        ...(upward
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
        // A box that isn't laid out can't be off screen; otherwise it must be in view.
        visible:
          (rect.width === 0 && rect.height === 0) ||
          (rect.bottom > 0 && rect.top < window.innerHeight),
      })
    }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open])

  // A click anywhere else closes it.
  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (panel.current?.contains(target) || button.current?.contains(target)) return
      close(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Keep the highlighted row in view while moving with the arrow keys.
  useEffect(() => {
    if (!open) return
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, listId])

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + rows.length) % rows.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (rows[active] !== undefined) choose(rows[active])
    }
  }

  const size = compact
    ? 'h-8 pr-7 pl-2.5 text-[0.76rem]'
    : 'h-10 pr-9 pl-3 text-[0.85rem]'

  return (
    <div className={`flex min-w-0 flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}>
      <label
        htmlFor={id}
        className={`text-text flex shrink-0 items-center gap-1.5 font-semibold ${
          compact ? 'text-[0.72rem]' : 'text-[0.82rem]'
        }`}
      >
        {Icon && (
          <Icon
            width={compact ? 14 : 16}
            height={compact ? 14 : 16}
            className="text-text-muted"
          />
        )}
        {label}
      </label>
      <div className="relative min-w-0">
        <button
          ref={button}
          id={id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => (open ? close(false) : openList())}
          className={`border-border bg-bg text-text focus:border-accent focus:outline-accent-tint w-full min-w-0 cursor-pointer truncate rounded-lg border text-left font-medium transition-colors outline-none focus:outline-2 ${size} ${
            open ? 'border-accent' : ''
          }`}
        >
          {value || allLabel}
        </button>
        <ChevronDownIcon
          width={compact ? 14 : 16}
          height={compact ? 14 : 16}
          className={`text-text-muted pointer-events-none absolute top-1/2 -translate-y-1/2 transition-transform ${
            compact ? 'right-2' : 'right-3'
          } ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open &&
        place?.visible &&
        createPortal(
          <div
            ref={panel}
            style={{
              position: 'fixed',
              left: place.left,
              width: place.width,
              top: place.top,
              bottom: place.bottom,
            }}
            className="border-border bg-bg z-[70] flex flex-col overflow-hidden rounded-xl border shadow-lg"
          >
            <div className="border-border flex items-center gap-2 border-b px-3 py-2">
              <SearchIcon width={14} height={14} className="text-text-muted shrink-0" />
              <input
                autoFocus
                type="search"
                role="searchbox"
                aria-label={`Search ${label.toLowerCase()}`}
                aria-controls={listId}
                autoComplete="off"
                spellCheck={false}
                maxLength={100}
                placeholder={`Search ${label.toLowerCase()}…`}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
                onKeyDown={handleKeyDown}
                className="text-text min-w-0 flex-1 border-none bg-transparent text-[0.82rem] outline-none [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
            <ul
              id={listId}
              role="listbox"
              aria-label={label}
              className="m-0 max-h-64 list-none overflow-y-auto p-1"
            >
              {rows.map((row, index) => {
                const selected = row === value
                return (
                  <li
                    key={row || '__all__'}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={selected}
                    // Pressing (not clicking) so the search box keeps the focus until it closes.
                    onMouseDown={(event) => {
                      event.preventDefault()
                      choose(row)
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={`cursor-pointer truncate rounded-lg px-2.5 py-1.5 text-[0.82rem] font-medium ${
                      index === active
                        ? 'bg-accent-tint/60'
                        : selected
                          ? 'bg-accent-tint'
                          : ''
                    } ${selected ? 'font-semibold' : ''}`}
                  >
                    {row || allLabel}
                  </li>
                )
              })}
              {needle && shown.length === 0 && (
                <li className="text-text-muted px-2.5 py-2 text-[0.8rem]">
                  No {label.toLowerCase()} match “{query.trim()}”.
                </li>
              )}
            </ul>
            {matches.length > MAX_SHOWN && (
              <p className="text-text-muted border-border m-0 border-t px-3 py-1.5 text-[0.72rem]">
                Showing {MAX_SHOWN} of {matches.length.toLocaleString('en-GB')} — keep
                typing to narrow the list.
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
