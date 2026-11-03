import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon } from './icons.tsx'

/** How many suggestions fit before the list scrolls. */
const MAX_VISIBLE = 50

/** The room a list wants under its box before it opens upward instead (px). */
const LIST_ROOM = 220

/** Where the open list goes: fixed to the screen, under the box (or above it with no room). */
interface ListPlace {
  left: number
  width: number
  top?: number
  bottom?: number
  visible: boolean
}

/** The suggestions that contain what was typed (any case), those starting with it first. */
function matches(
  suggestions: readonly string[],
  typed: string,
  asSelect: boolean,
): string[] {
  const needle = typed.trim().toLowerCase()
  if (asSelect) {
    // Like a dropdown: every value, in the order given — also when the box already holds one of
    // them, so the choice can be changed — narrowed only while something else is being typed.
    const holdsOne = suggestions.some((value) => value.toLowerCase() === needle)
    return suggestions
      .filter((value) => !needle || holdsOne || value.toLowerCase().includes(needle))
      .slice(0, MAX_VISIBLE)
  }
  const hits = suggestions.filter((value) => {
    const lower = value.toLowerCase()
    // The value that is already in the box is not a suggestion.
    return lower !== needle && (!needle || lower.includes(needle))
  })
  const starts = (value: string) => (value.toLowerCase().startsWith(needle) ? 0 : 1)
  return hits
    .sort(
      (a, b) =>
        starts(a) - starts(b) || a.localeCompare(b, 'en', { sensitivity: 'base' }),
    )
    .slice(0, MAX_VISIBLE)
}

interface SuggestInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  /** Values that already exist, offered as you type (any value can still be typed). */
  suggestions: readonly string[]
  className: string
  placeholder?: string
  invalid?: boolean
  maxLength?: number
  /**
   * Draw it as a dropdown (a chevron at the right; the whole list, in its own order, even when a
   * value is already chosen, which is marked) rather than a box that suggests as you type. The box
   * stays free text, so a value that is not in the list can still be typed. The caller leaves room
   * for the chevron in `className` (`pr-9`).
   */
  asSelect?: boolean
}

/**
 * A text box that suggests values that already exist: focusing it (or typing) opens a list
 * under it, narrowed to what was typed; click one, or use ↑/↓ and Enter, to fill the box,
 * Escape to close the list. It is still a free-text box — a value that is not in the list is
 * simply what you type. The list is drawn over the page (it doesn't push the form down) and is
 * a real `listbox` of `option`s for assistive technology.
 */
export function SuggestInput({
  id,
  value,
  onChange,
  suggestions,
  className,
  placeholder,
  invalid = false,
  maxLength,
  asSelect = false,
}: SuggestInputProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const box = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<ListPlace | null>(null)
  const shown = useMemo(
    () => matches(suggestions, value, asSelect),
    [suggestions, value, asSelect],
  )
  const expanded = open && shown.length > 0

  // The list is drawn on the page body, fixed to the screen under its box — so no ancestor that
  // clips (a window, an accordion, a scrolling card) can cut it off or leave it under the next
  // field — and follows the box while the page scrolls or resizes.
  useEffect(() => {
    if (!expanded) return undefined
    function measure() {
      const rect = box.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom
      const upward = below < LIST_ROOM && rect.top > below
      setPlace({
        left: rect.left,
        width: rect.width,
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
  }, [expanded])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    setActive(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (shown.length === 0) return
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + shown.length) % shown.length)
      return
    }
    if (event.key === 'Enter' && expanded && active >= 0) {
      event.preventDefault()
      choose(shown[active])
    }
  }

  return (
    <div ref={box} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          expanded && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setActive(-1)
        }}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={handleKeyDown}
        className={className}
      />
      {asSelect && (
        <ChevronDownIcon
          width={16}
          height={16}
          className={`text-text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      )}
      {expanded &&
        place?.visible &&
        createPortal(
          <ul
            id={listId}
            role="listbox"
            style={{
              position: 'fixed',
              left: place.left,
              width: place.width,
              top: place.top,
              bottom: place.bottom,
            }}
            className="border-border bg-bg z-[70] max-h-56 overflow-y-auto rounded-xl border p-1 shadow-lg"
          >
            {shown.map((suggestion, index) => (
              <li
                key={suggestion}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // Pressing (not clicking) so the box keeps the focus and doesn't close first.
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(suggestion)
                }}
                onMouseEnter={() => setActive(index)}
                className={`cursor-pointer truncate rounded-lg px-2.5 py-2 text-[0.85rem] font-medium ${
                  index === active
                    ? 'bg-accent-tint'
                    : asSelect && suggestion.toLowerCase() === value.trim().toLowerCase()
                      ? 'bg-accent-tint font-semibold'
                      : 'hover:bg-accent-tint/60'
                }`}
              >
                {suggestion}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
