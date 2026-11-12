import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { BADGE_OUTLINE_CLASSES, BADGE_PILL_BASE, type BadgeTone } from './badgeTones.ts'
import { CheckIcon, ChevronDownIcon, SpinnerIcon } from './icons.tsx'

export interface PillOption {
  value: string
  label: string
  tone: BadgeTone
}

interface PillSelectProps {
  /** The control's accessible name, e.g. "Status of Hippo Bag: Active". */
  label: string
  /** The listbox's accessible name, e.g. "Status of Hippo Bag". */
  menuLabel: string
  options: PillOption[]
  /** The value to show (the one being saved, while a save is in flight). */
  value: string
  saving?: boolean
  /** The backend's message when the last change failed. */
  error?: string
  onChange: (value: string) => void
  /** Width of the pill button (a Tailwind class). */
  widthClass?: string
}

/** Room the menu needs below the button, to decide whether to open upward. */
const MENU_HEIGHT = 150
const PILL = BADGE_PILL_BASE

/**
 * A value as a coloured pill with a dropdown: pick another and `onChange` is called (the caller
 * decides what to do — ask "are you sure?", then save). Every option keeps its colour in the menu,
 * so the choice reads the same as the result. The menu is drawn on top of the page (a portal), so a
 * table's scrolling area never clips it; it opens upward near the bottom of the screen, closes on
 * scroll, resize or an outside click, and works with the keyboard (arrows, Home/End, Enter/Space,
 * Escape). The same control the Products list uses for a product's status.
 */
export function PillSelect({
  label,
  menuLabel,
  options,
  value,
  saving = false,
  error,
  onChange,
  widthClass = 'w-24',
}: PillSelectProps) {
  const current = options.find((option) => option.value === value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState<{
    left: number
    top?: number
    bottom?: number
    minWidth: number
  } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return undefined
    menu.current?.focus()

    function close() {
      setOpen(false)
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    // A menu fixed to the screen would drift from its row, so any scroll or resize closes it.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function openMenu() {
    const rect = button.current?.getBoundingClientRect()
    if (!rect) return
    const upward =
      window.innerHeight - rect.bottom < MENU_HEIGHT && rect.top > MENU_HEIGHT
    setPlace({
      left: rect.left,
      minWidth: Math.max(rect.width, 140),
      ...(upward
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    })
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    )
    setOpen(true)
  }

  function closeMenu() {
    setOpen(false)
    button.current?.focus()
  }

  function pick(option: PillOption) {
    closeMenu()
    if (option.value !== value) onChange(option.value)
  }

  function onMenuKeyDown(event: KeyboardEvent) {
    const last = options.length - 1
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeMenu()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, last))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(last)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(options[active])
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        ref={button}
        type="button"
        disabled={saving}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-invalid={error ? true : undefined}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) openMenu()
          }
        }}
        className={`${PILL} focus-visible:outline-accent ${widthClass} cursor-pointer justify-center gap-1.5 focus-visible:outline-2 disabled:cursor-progress disabled:opacity-70 ${BADGE_OUTLINE_CLASSES[current?.tone ?? 'neutral']}`}
      >
        {current?.label ?? value}
        {saving ? (
          <SpinnerIcon width={12} height={12} className="animate-spin" />
        ) : (
          <ChevronDownIcon
            width={12}
            height={12}
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {error && (
        <span
          role="alert"
          className="text-danger max-w-40 text-[0.7rem] leading-tight whitespace-normal"
        >
          {error}
        </span>
      )}

      {open &&
        place &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="listbox"
            tabIndex={-1}
            aria-label={menuLabel}
            aria-activedescendant={`${menuId}-${options[active]?.value}`}
            onKeyDown={onMenuKeyDown}
            style={{
              left: place.left,
              top: place.top,
              bottom: place.bottom,
              minWidth: place.minWidth,
            }}
            className="border-border bg-bg fixed z-50 flex flex-col gap-0.5 rounded-xl border p-1.5 shadow-lg outline-none"
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${menuId}-${option.value}`}
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(option)}
                className={`flex cursor-pointer items-center justify-between gap-4 rounded-lg px-2 py-1.5 ${
                  index === active ? 'bg-surface' : ''
                }`}
              >
                <span className={`${PILL} ${BADGE_OUTLINE_CLASSES[option.tone]}`}>
                  {option.label}
                </span>
                {option.value === value && (
                  <CheckIcon width={14} height={14} className="text-accent" />
                )}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
