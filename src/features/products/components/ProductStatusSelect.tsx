import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { BADGE_TONE_CLASSES } from '../../../components/ui/badgeTones.ts'
import { CheckIcon, ChevronDownIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import {
  PRODUCT_EDIT_STATUSES,
  type ProductEditStatus,
} from '../../../lib/api/endpoints.ts'
import { statusLabel, statusTone } from '../utils/format.ts'

interface ProductStatusSelectProps {
  /** The product's name, for the control's accessible name. */
  title: string
  /** The status to show (the one being saved, while a save is in flight). */
  value: string | null
  saving: boolean
  /** The backend's message when the last change failed. */
  error?: string
  onChange: (status: ProductEditStatus) => void
}

/** Room the menu needs below the button (three rows and padding), to decide whether to open upward. */
const MENU_HEIGHT = 150
const PILL =
  'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

interface Option {
  value: string
  disabled: boolean
}

/**
 * A product's status as a pill with a dropdown: pick a status and it is saved
 * at once. Every status keeps its colour in the menu too — Active green, Draft
 * grey, Archived red — so the choice reads the same as the result. Only the
 * statuses the API can set are offered; one it cannot set (Unlisted) is shown,
 * but can only be moved away from.
 *
 * The menu is drawn on top of the page (a portal), so the table's scrolling
 * area never clips it, and it works with the keyboard: Arrow keys move, Enter
 * or Space picks, Escape closes.
 */
export function ProductStatusSelect({
  title,
  value,
  saving,
  error,
  onChange,
}: ProductStatusSelectProps) {
  const current = (value ?? '').toUpperCase()
  const options: Option[] = [
    ...(PRODUCT_EDIT_STATUSES.some((status) => status === current) || !current
      ? []
      : [{ value: current, disabled: true }]),
    ...PRODUCT_EDIT_STATUSES.map((status) => ({ value: status, disabled: false })),
  ]

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // Where the menu goes: under the button, or above it near the bottom of the screen.
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
      minWidth: Math.max(rect.width, 160),
      ...(upward
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    })
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === current),
      ),
    )
    setOpen(true)
  }

  function closeMenu() {
    setOpen(false)
    button.current?.focus()
  }

  function pick(option: Option) {
    if (option.disabled) return
    closeMenu()
    if (option.value !== current) onChange(option.value as ProductEditStatus)
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
        aria-label={`Status of ${title}: ${statusLabel(current)}`}
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
        className={`${PILL} focus-visible:outline-accent w-[5.5rem] cursor-pointer justify-center gap-1.5 border-none focus-visible:outline-2 disabled:cursor-progress disabled:opacity-70 ${BADGE_TONE_CLASSES[statusTone(current)]}`}
      >
        {statusLabel(current)}
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
            aria-label={`Status of ${title}`}
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
                aria-selected={option.value === current}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(option)}
                className={`flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 ${
                  option.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                } ${index === active ? 'bg-surface' : ''}`}
              >
                <span
                  className={`${PILL} ${BADGE_TONE_CLASSES[statusTone(option.value)]}`}
                >
                  {statusLabel(option.value)}
                </span>
                {option.value === current && (
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
