import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { ChevronDownIcon, type IconProps } from './icons.tsx'

interface PopoverButtonProps {
  /** The button's text, and its accessible name. */
  label: string
  icon?: ComponentType<IconProps>
  /** Which edge of the button the panel lines up with. */
  align?: 'left' | 'right'
  tone?: 'neutral' | 'primary'
  /**
   * `toolbar`: a small borderless trigger for a toolbar (the label stays for screen
   * readers unless `showLabel`), and pressing it does not take focus from, say, a
   * text editor, so the editor's selection survives.
   */
  variant?: 'button' | 'toolbar'
  /** Toolbar variant only: also show the label as text (e.g. the current block style). */
  showLabel?: boolean
  /** Show the little arrow next to the label/icon (default). Off for toolbar buttons that open a form. */
  chevron?: boolean
  /** Button variant only: a square, icon-only trigger (the label stays as its accessible name and tooltip). */
  iconOnly?: boolean
  /** Is the thing this opens in use (e.g. the text has a colour)? Styled as pressed. */
  active?: boolean
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
  variant = 'button',
  showLabel = false,
  chevron = true,
  iconOnly = false,
  active = false,
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
        onMouseDown={
          variant === 'toolbar' ? (event) => event.preventDefault() : undefined
        }
        title={variant === 'toolbar' || iconOnly ? label : undefined}
        aria-label={(variant === 'toolbar' && !showLabel) || iconOnly ? label : undefined}
        className={
          variant === 'toolbar'
            ? `inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border-none px-1.5 text-[0.85rem] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                active || open
                  ? 'bg-accent-tint text-accent'
                  : 'text-text-muted hover:bg-surface hover:text-text bg-transparent'
              }`
            : iconOnly
              ? `inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-50 ${TONES[tone]}`
              : `inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${TONES[tone]}`
        }
      >
        {Icon && <Icon width={iconOnly ? 18 : 16} height={iconOnly ? 18 : 16} />}
        {(variant === 'toolbar' && !showLabel) || iconOnly ? null : label}
        {chevron && (
          <ChevronDownIcon
            width={variant === 'toolbar' ? 12 : 14}
            height={variant === 'toolbar' ? 12 : 14}
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && (
        <div
          role="group"
          aria-label={label}
          className={`border-border bg-bg absolute top-full z-30 mt-1.5 rounded-xl border p-1.5 shadow-lg ${
            variant === 'toolbar' ? 'min-w-44' : 'min-w-64'
          } ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
