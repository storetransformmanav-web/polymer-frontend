import { useId, useMemo, useState, type KeyboardEvent } from 'react'

/** How many suggestions fit before the list scrolls. */
const MAX_VISIBLE = 50

/** The suggestions that contain what was typed (any case), those starting with it first. */
function matches(suggestions: readonly string[], typed: string): string[] {
  const needle = typed.trim().toLowerCase()
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
}: SuggestInputProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const shown = useMemo(() => matches(suggestions, value), [suggestions, value])
  const expanded = open && shown.length > 0

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
    <div className="relative">
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
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          className="border-border bg-bg absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border p-1 shadow-lg"
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
                index === active ? 'bg-accent-tint' : 'hover:bg-accent-tint/60'
              }`}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
