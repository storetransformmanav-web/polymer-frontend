import type { ComponentType, ReactNode } from 'react'
import { DETAIL_CARD, DetailSection } from '../../../components/ui/DetailSection.tsx'
import type { IconProps } from '../../../components/ui/icons.tsx'
import { recordFields } from '../utils/format.ts'

/**
 * The small pieces the order's details pages are built from: thin-bordered cards with a slim title
 * row, label / value rows, compact tables and pills — one small type size, tight spacing, no
 * shadows.
 */

/**
 * A card of the order's pages: the same card as on a product's and a customer's details page
 * (`DetailSection`) — a sage border, a title row with an icon, the title and a count that takes the
 * hover tint, a chevron that folds it, and a padded body. `after` is something small after the
 * title (a chip with an id) and `aside` sits at the title row's right edge (a status pill).
 */
export function MiniCard({
  title,
  icon,
  count,
  after,
  aside,
  children,
}: {
  title: string
  icon: ComponentType<IconProps>
  count?: number
  after?: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <DetailSection
      title={title}
      icon={icon}
      count={count}
      titleExtra={after}
      actions={aside ?? undefined}
    >
      {children}
    </DetailSection>
  )
}

/**
 * The same card, with a way to start folded (`defaultOpen`), to stay open while its content is
 * being edited (`forceOpen`) and controls at the title row's right edge (`actions`: the pencil,
 * or ✓ and ✕).
 */
export function FoldCard({
  title,
  icon,
  count,
  defaultOpen = true,
  actions,
  forceOpen = false,
  children,
}: {
  title: string
  icon: ComponentType<IconProps>
  count?: number
  defaultOpen?: boolean
  /** Controls at the row's right edge (the pencil, or ✓ and ✕). */
  actions?: ReactNode
  /** Stays open whatever the title row says (while its content is being edited). */
  forceOpen?: boolean
  children: ReactNode
}) {
  return (
    <DetailSection
      title={title}
      icon={icon}
      count={count}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      actions={actions}
    >
      {children}
    </DetailSection>
  )
}

/** Label / value rows, one per line, separated by thin rules. */
export function Rows({ children }: { children: ReactNode }) {
  return <dl className="m-0 flex flex-col">{children}</dl>
}

/** One row: the label muted on the left, the value on the right (`strong` for a total). */
export function Row({
  label,
  strong = false,
  children,
}: {
  label: string
  strong?: boolean
  children: ReactNode
}) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className="border-border flex items-baseline justify-between gap-3 border-b py-1.5 text-[0.78rem] last:border-b-0">
      <dt className="text-text-muted shrink-0">{label}</dt>
      <dd
        className={`m-0 min-w-0 text-right break-words ${
          strong ? 'text-[0.9rem] font-bold' : 'font-medium'
        }`}
      >
        {empty ? <span className="text-text-muted">—</span> : children}
      </dd>
    </div>
  )
}

/** A plain sentence for a card with nothing in it. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-text-muted m-0 py-1 text-[0.78rem]">{children}</p>
}

/** Small tags. */
export function Chips({ items }: { items: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0 py-1">
      {items.map((item) => (
        <li
          key={item}
          className="bg-accent-tint text-accent rounded-full px-2 py-0.5 text-[0.7rem] font-semibold"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

// --- Compact tables ---------------------------------------------------------------

/** A header cell and a body cell of a compact table (text wraps — nothing scrolls sideways). */
export const MINI_TH =
  'text-text border-border-strong bg-accent-tint/60 border-b px-3 py-2 text-left text-[0.66rem] font-bold tracking-wide uppercase'
export const MINI_TD = 'px-3 py-1.5 align-middle text-[0.78rem]'
export const MINI_ROW = 'border-border border-b last:border-b-0'

/** A thin-bordered table that fits its card. */
export function MiniTable({ children }: { children: ReactNode }) {
  return (
    <div className={`${DETAIL_CARD} overflow-x-auto`}>
      <table className="w-full border-collapse">{children}</table>
    </div>
  )
}

/** The plain fields of records whose shape isn't documented, one small bordered block each. */
export function RecordList({
  records,
  empty,
}: {
  records: Record<string, unknown>[]
  empty: string
}) {
  const usable = records.map(recordFields).filter((fields) => fields.length > 0)
  if (usable.length === 0) return <EmptyNote>{empty}</EmptyNote>
  return (
    <ul className="m-0 grid list-none gap-2 p-0 py-1 md:grid-cols-2">
      {usable.map((fields, index) => (
        <li
          key={index}
          className="border-border bg-surface/40 rounded-lg border px-2.5 py-1"
        >
          <Rows>
            {fields.map(([label, value]) => (
              <Row key={label} label={label}>
                {value}
              </Row>
            ))}
          </Rows>
        </li>
      ))}
    </ul>
  )
}
