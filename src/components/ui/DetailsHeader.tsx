import type { ComponentType, ReactNode } from 'react'
import type { BadgeTone } from './Badge.tsx'
import { ArrowLeftIcon, type IconProps } from './icons.tsx'

/**
 * The header every details page shares (an order, a customer, a product, a variant, a user, a
 * lock): a tile on the left (an icon, initials or the record's picture), a thin divider, the title
 * with its status pill and — under it — the record's facts as small rounded chips; at the right
 * its own buttons and a rounded **Back to list**.
 */

/** The tile: an icon or initials in a rounded square with the accent tint. */
export function HeaderTile({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="bg-accent-tint text-accent inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
    >
      {children}
    </span>
  )
}

/** A fact in the header's second line, as a small rounded chip: an icon, then the value. */
export function HeaderChip({
  icon: Icon,
  label,
  children,
}: {
  icon?: ComponentType<IconProps>
  /** What it is, for the tooltip and for screen readers ("Order date"). */
  label: string
  children: ReactNode
}) {
  return (
    <span
      className="border-border bg-bg flex min-w-0 items-center gap-2 rounded-full border px-3 py-1"
      title={label}
    >
      {Icon && <Icon width={16} height={16} className="text-text-muted shrink-0" />}
      <span className="sr-only">{label}: </span>
      <span className="min-w-0 break-words">{children}</span>
    </span>
  )
}

const PILL_TONES: Record<BadgeTone, string> = {
  default: 'bg-accent-tint text-accent',
  success: 'bg-accent-tint text-accent',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-surface text-text-muted',
}

/** The record's state as a pill with a dot: Open (amber), Active / Completed (green), red… */
export function StatusPill({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.85rem] font-semibold ${PILL_TONES[tone]}`}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  )
}

/** The rounded **Back to list** button (arrow only on a phone). */
export function HeaderBackButton({
  onClick,
  label = 'Back to list',
  disabled = false,
}: {
  onClick: () => void
  label?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
    >
      <ArrowLeftIcon width={16} height={16} />
      <span className="hidden sm:inline" aria-hidden="true">
        {label}
      </span>
    </button>
  )
}

interface DetailsHeaderProps {
  /** The tile (`HeaderTile`) or the record's own picture. */
  visual: ReactNode
  /** The heading's content (the name or number). */
  title: ReactNode
  /** Tooltip for a long title. */
  titleHint?: string
  /** Beside the title: the status pill and anything small that belongs with it. */
  status?: ReactNode
  /** Under the title: the facts, as `HeaderChip`s. */
  chips?: ReactNode
  /** The page's own buttons, before Back to list. */
  actions?: ReactNode
  onBack: () => void
  backLabel?: string
  /** Replaces the header's own padding / edge, for a page whose card is laid out differently. */
  className?: string
}

/** See the file's comment. */
export function DetailsHeader({
  visual,
  title,
  titleHint,
  status,
  chips,
  actions,
  onBack,
  backLabel,
  className = 'shrink-0 p-4 sm:p-6',
}: DetailsHeaderProps) {
  return (
    <header className={className}>
      <div className="flex items-start gap-4">
        {visual}
        <div
          className="bg-border hidden h-14 w-px shrink-0 sm:block"
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1
              className="m-0 min-w-0 text-lg leading-snug font-bold break-words sm:text-2xl"
              title={titleHint}
            >
              {title}
            </h1>
            {status}
          </div>
          {chips && (
            <div className="flex flex-wrap items-center gap-2 text-[0.82rem] font-medium">
              {chips}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
          <HeaderBackButton onClick={onBack} label={backLabel} />
        </div>
      </div>
    </header>
  )
}
