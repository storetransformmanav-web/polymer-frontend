import type { ComponentType, MouseEventHandler } from 'react'
import { SpinnerIcon, type IconProps } from './icons.tsx'

type Tone = 'neutral' | 'primary' | 'danger'

interface IconActionProps {
  /** What the button does. Shown as a tooltip on hover/focus and read by screen readers. */
  label: string
  /** Overrides the screen-reader name when it should say more than the tooltip (e.g. "Save specifications"). */
  accessibleLabel?: string
  icon: ComponentType<IconProps>
  onClick: MouseEventHandler<HTMLButtonElement>
  tone?: Tone
  disabled?: boolean
  /** Shows a spinner instead of the icon (an action is in progress). */
  busy?: boolean
}

const TONES: Record<Tone, string> = {
  neutral:
    'border-border bg-bg text-text-muted hover:border-accent hover:text-accent hover:bg-accent-tint',
  primary:
    'border-transparent bg-accent text-accent-contrast hover:bg-accent-hover shadow-sm',
  danger:
    'border-border bg-bg text-text-muted hover:border-danger hover:text-danger hover:bg-danger-bg',
}

/**
 * A round-cornered icon-only button that names itself in a tooltip when the
 * pointer rests on it or it receives keyboard focus ("Save", "Discard", "Edit").
 * The tooltip is pure CSS, so it needs no extra state and never steals focus.
 */
export function IconAction({
  label,
  accessibleLabel,
  icon: Icon,
  onClick,
  tone = 'neutral',
  disabled = false,
  busy = false,
}: IconActionProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={accessibleLabel ?? label}
        onClick={onClick}
        disabled={disabled || busy}
        className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-50 ${TONES[tone]}`}
      >
        {busy ? (
          <SpinnerIcon width={16} height={16} className="animate-spin" />
        ) : (
          <Icon width={16} height={16} />
        )}
      </button>
      <span
        role="tooltip"
        aria-hidden="true"
        className="bg-text text-bg pointer-events-none absolute top-full left-1/2 z-20 mt-1.5 -translate-x-1/2 rounded-md px-2 py-1 text-[0.72rem] leading-none font-semibold whitespace-nowrap opacity-0 shadow-md transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}
