import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { ChevronDownIcon, type IconProps } from './icons.tsx'

interface PopoverButtonProps {
  /** The button's text, and its accessible name. */
  label: string
  icon?: ComponentType<IconProps>
  /** Which edge of the button the panel lines up with. */
  align?: 'left' | 'right'
  tone?: 'neutral' | 'primary'
  disabled?: boolean
  /** Called each time the panel opens (e.g. to warm a cache before a choice is made). */
  onOpen?: () => void
  /** The panel's content; `close` dismisses it (call it after a choice is made). */
  children: (close: () => void) => ReactNode
}

const TONES = {
  neutral:
    'border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint',
  primary:
    'border-transparent bg-accent text-accent-contrast hover:bg-accent-hover shadow-sm',
}

/**
 * A button that opens a small floating panel under it (a menu of choices, a
 * list of checkboxes). Closes on a click outside, on Escape (focus returns to
 * the button) and when the content calls `close`.
 */
export function PopoverButton({
  label,
  icon: Icon,
  align = 'left',
  tone = 'neutral',
  disabled = false,
  onOpen,
  children,
}: PopoverButtonProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function toggle() {
    if (!open) onOpen?.()
    setOpen((current) => !current)
  }

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
        type="button"
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
        className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${TONES[tone]}`}
      >
        {Icon && <Icon width={16} height={16} />}
        {label}
        <ChevronDownIcon
          width={14}
          height={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="group"
          aria-label={label}
          className={`border-border bg-bg absolute top-full z-30 mt-1.5 min-w-64 rounded-xl border p-1.5 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
