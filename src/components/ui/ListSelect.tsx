import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronDownIcon } from './icons.tsx'
import type { SelectOption } from './SelectField.tsx'

/** The height the list is drawn at most (px) before it scrolls. */
const MAX_LIST = 240
/** Each choice's height plus the list's padding, to know how much room it wants (px). */
const ROW = 32

interface Place {
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
  visible: boolean
}

/**
 * A dropdown for a short, fixed list of choices (what to check, how). It looks like a compact
 * `SelectField`, but the list is drawn on the page body, **fixed to the screen right under the
 * button** (above it only when there is clearly no room below), so a scrolling card or a window can
 * never leave it somewhere else. It follows the button while the page scrolls, scrolls itself when it is long, and
 * is keyboard-operable (↑/↓, Enter, Escape, Tab closes).
 */
export function ListSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  large = false,
  invalid = false,
}: {
  id: string
  /** The accessible name (the box shows only the chosen choice). */
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  /** Form-field size (40px, 0.85rem) instead of the compact filter size. */
  large?: boolean
  /** Red border, for a field with a problem. */
  invalid?: boolean
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [place, setPlace] = useState<Place | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLUListElement>(null)
  const current = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return undefined
    function measure() {
      const rect = button.current?.getBoundingClientRect()
      if (!rect) return
      const want = Math.min(options.length * ROW + 12, MAX_LIST)
      const below = window.innerHeight - rect.bottom - 8
      const upward = below < want && rect.top > below
      setPlace({
        left: rect.left,
        width: rect.width,
        ...(upward
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
        maxHeight: Math.max(120, Math.min(MAX_LIST, (upward ? rect.top : below) - 8)),
        visible: rect.bottom > 0 && rect.top < window.innerHeight,
      })
    }
    function outside(event: MouseEvent) {
      const target = event.target as Node
      if (!button.current?.contains(target) && !panel.current?.contains(target)) {
        setOpen(false)
      }
    }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    document.addEventListener('mousedown', outside)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
      document.removeEventListener('mousedown', outside)
    }
  }, [open, options.length])

  function openList() {
    if (disabled) return
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    )
    setOpen(true)
  }

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    button.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      return
    }
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openList()
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((now) => (now + step + options.length) % options.length)
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && open && active >= 0) {
      event.preventDefault()
      choose(options[active].value)
    }
  }

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        className={`border-border bg-surface text-text hover:border-accent focus:border-accent focus:outline-accent-tint flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border text-left font-medium transition-colors outline-none focus:outline-2 disabled:cursor-not-allowed disabled:opacity-60 ${
          large ? 'bg-bg h-10 px-3 text-[0.85rem]' : 'h-8 px-2.5 text-[0.76rem]'
        } ${invalid ? 'border-danger' : ''}`}
      >
        <span className="min-w-0 truncate">{current?.label ?? ''}</span>
        <ChevronDownIcon
          width={14}
          height={14}
          className={`text-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open &&
        place &&
        createPortal(
          <ul
            ref={panel}
            id={listId}
            role="listbox"
            aria-label={label}
            style={{
              left: place.left,
              width: place.width,
              top: place.top,
              bottom: place.bottom,
              maxHeight: place.maxHeight,
              visibility: place.visible ? 'visible' : 'hidden',
            }}
            className="border-border bg-bg fixed z-[60] m-0 flex list-none flex-col gap-0.5 overflow-y-auto rounded-xl border p-1.5 shadow-lg"
          >
            {options.map((option, index) => {
              const selected = option.value === value
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={selected}
                  // Pressing must not move focus off the button before the choice is made.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option.value)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 ${large ? 'text-[0.85rem]' : 'text-[0.76rem]'} ${
                    selected ? 'font-semibold' : ''
                  } ${
                    index === active
                      ? 'bg-accent-tint/60'
                      : selected
                        ? 'bg-accent-tint'
                        : ''
                  }`}
                >
                  <span className="flex w-3 shrink-0 justify-center">
                    {selected && <CheckIcon width={12} height={12} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </>
  )
}
