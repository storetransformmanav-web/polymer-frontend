import { useId, useState, type ComponentType, type ReactNode } from 'react'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import { ChevronDownIcon, type IconProps } from '../../../components/ui/icons.tsx'
import { recordFields } from '../utils/format.ts'

/**
 * The small pieces the order's details pages are built from: thin-bordered cards with a slim title
 * row, label / value rows, compact tables and pills — one small type size, tight spacing, no
 * shadows.
 */

const COUNT =
  'bg-surface text-text-muted border-border rounded-full border px-1.5 text-[0.62rem] leading-4 font-bold'

/** A small card: a slim title row (icon, title, count) over its content. A labelled region. */
export function MiniCard({
  title,
  icon: Icon,
  count,
  className = '',
  children,
}: {
  title: string
  icon: ComponentType<IconProps>
  count?: number
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`${DETAIL_CARD} min-w-0 ${className}`}>
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <Icon width={14} height={14} className="text-accent shrink-0" />
        <h3 className="m-0 text-[0.8rem] font-semibold">{title}</h3>
        {count !== undefined && <span className={COUNT}>{count}</span>}
      </div>
      <div className="px-3 py-1.5">{children}</div>
    </section>
  )
}

/** The same card, but the title row folds it away (a chevron says which way it goes). */
export function FoldCard({
  title,
  icon: Icon,
  count,
  defaultOpen = true,
  shrinkWhenFolded = false,
  className = '',
  children,
}: {
  title: string
  icon: ComponentType<IconProps>
  count?: number
  defaultOpen?: boolean
  /** In a row of cards of one height: a folded card keeps only its title row. */
  shrinkWhenFolded?: boolean
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  return (
    <section
      aria-label={title}
      className={`${DETAIL_CARD} min-w-0 ${shrinkWhenFolded && !open ? 'self-start' : ''} ${className}`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className={`hover:bg-accent-tint/60 flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2 text-left transition-colors ${
          open ? 'rounded-t-[0.7rem]' : 'rounded-[0.7rem]'
        }`}
      >
        <Icon width={14} height={14} className="text-accent shrink-0" />
        <h3 className="m-0 text-[0.8rem] font-semibold">{title}</h3>
        {count !== undefined && <span className={COUNT}>{count}</span>}
        <ChevronDownIcon
          width={14}
          height={14}
          className={`text-text-muted ml-auto shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div id={bodyId} className="border-border border-t px-3 py-1.5">
          {children}
        </div>
      )}
    </section>
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
