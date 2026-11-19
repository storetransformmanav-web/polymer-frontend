import type { ComponentType, ReactNode } from 'react'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import type { IconProps } from '../../../components/ui/icons.tsx'

/**
 * The cards of a Sage customer's page (after the shared reference design): a bordered card with a
 * light sage header band — an icon tile, the title and, at the right, an optional action — and the
 * content under it. `flush` drops the body's padding for a table that draws its own edge-to-edge cells.
 */
export function CardShell({
  title,
  icon: Icon,
  action,
  badge,
  flush = false,
  compact = false,
  className = '',
  children,
}: {
  title: string
  icon: ComponentType<IconProps>
  /** A link or button at the right of the header ("View All →"). */
  action?: ReactNode
  /** A small pill after the title ("Main Contact", a count). */
  badge?: ReactNode
  flush?: boolean
  /** Smaller type and tighter padding (the addresses). */
  compact?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`${DETAIL_CARD} flex min-w-0 flex-col overflow-hidden ${className}`}
    >
      <header
        className={`bg-accent-tint/60 border-border-strong flex items-center gap-2.5 border-b ${
          compact ? 'px-3 py-1.5' : 'px-4 py-3'
        }`}
      >
        <span
          aria-hidden="true"
          className={`bg-accent-tint text-accent flex shrink-0 items-center justify-center rounded-lg ${
            compact ? 'size-6' : 'size-8'
          }`}
        >
          <Icon width={compact ? 14 : 17} height={compact ? 14 : 17} />
        </span>
        <h3
          className={`min-w-0 truncate font-semibold ${compact ? 'text-[0.8rem]' : 'text-[0.95rem]'}`}
        >
          {title}
        </h3>
        {badge}
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </header>
      <div className={flush ? '' : compact ? 'p-3' : 'p-4'}>{children}</div>
    </section>
  )
}

/** A small pill after a card's title. */
export function CardBadge({ children }: { children: ReactNode }) {
  return (
    <span className="bg-accent-tint text-accent border-border rounded-full border px-2 py-0.5 text-[0.68rem] font-bold">
      {children}
    </span>
  )
}

/** Rows of "label … value", each divided from the next by a thin line. */
export function RowList({ children }: { children: ReactNode }) {
  return <dl className="m-0 flex flex-col">{children}</dl>
}

/** One row of a `RowList`: the label muted on the left, the value beside it; a dash when empty. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className="border-border grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-3 border-b py-2.5 text-[0.85rem] last:border-b-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="m-0 min-w-0 font-medium break-words">
        {empty ? <span className="text-text-muted">—</span> : children}
      </dd>
    </div>
  )
}

const FIGURE_TONES = {
  accent: 'bg-accent-tint/70 text-accent',
  neutral: 'bg-surface text-text',
  good: 'bg-accent-tint/40 text-accent',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
}

/**
 * A headline figure of the overview: a tinted card with an icon tile, the label, the big value and an
 * optional note at the right ("Total orders").
 */
export function FigureCard({
  label,
  value,
  note,
  icon: Icon,
  tone = 'accent',
}: {
  label: string
  value: ReactNode
  note?: string
  icon: ComponentType<IconProps>
  tone?: keyof typeof FIGURE_TONES
}) {
  return (
    <div className="border-border bg-bg flex min-w-0 items-center gap-4 rounded-xl border p-4">
      <span
        aria-hidden="true"
        className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${FIGURE_TONES[tone]}`}
      >
        <Icon width={22} height={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-text m-0 truncate text-[0.85rem] font-semibold">{label}</p>
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-[1.5rem] leading-tight font-bold">{value}</span>
          {note && <span className="text-text-muted text-[0.75rem]">{note}</span>}
        </div>
      </div>
    </div>
  )
}

/** A page's heading: an icon tile, the title, a line saying what the page holds and, at the right, its buttons. */
export function PageHeading({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: ComponentType<IconProps>
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span
        aria-hidden="true"
        className="bg-accent-tint text-accent flex size-12 shrink-0 items-center justify-center rounded-xl"
      >
        <Icon width={24} height={24} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="m-0 text-[1.3rem] leading-tight font-bold">{title}</h2>
        <p className="text-text-muted m-0 text-[0.85rem]">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
