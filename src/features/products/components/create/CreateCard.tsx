import type { ReactNode } from 'react'
import { ChevronDownIcon } from '../../../../components/ui/icons.tsx'
import type { CreateDraft } from '../../utils/createDraft.ts'
import type { DraftErrors } from '../../utils/editDraft.ts'

/** What each card of the "Add product" form receives. */
export interface CreateSectionProps {
  draft: CreateDraft
  /** Problems to show (none until a create has been attempted). */
  errors: DraftErrors
  /** Changes some fields of the draft (variants follow when the options change). */
  update: (patch: Partial<CreateDraft>) => void
}

/** The look of every card of the form (after the store admin's: a soft box with a thin border). */
export const CARD = 'border-border bg-bg min-w-0 rounded-2xl border'

/**
 * A card of the form (after the store admin's: a soft box with a thin border). `title` names the
 * region for assistive technology (unless `regionLabel` says otherwise) and is its heading: inside
 * the card at the top, or (`headingAbove`) above it the way the store admin puts "Price",
 * "Variants" and "Search engine listing" — unless `hideTitle` (the first card has no heading).
 * `action` sits at the heading's right edge. `flush` drops the content's padding and gaps (rows
 * that run edge to edge bring their own).
 */
export function CreateCard({
  title,
  regionLabel = title,
  hideTitle = false,
  headingAbove = false,
  flush = false,
  action,
  children,
}: {
  title: string
  /** What the region is called for assistive technology, when that differs from the heading. */
  regionLabel?: string
  hideTitle?: boolean
  /** The title sits above the card, as a plain heading, instead of inside it. */
  headingAbove?: boolean
  /** No padding or gaps inside: the content brings its own (rows that run edge to edge). */
  flush?: boolean
  action?: ReactNode
  children: ReactNode
}) {
  const heading = !hideTitle && (
    <div className="flex items-center justify-between gap-3">
      <h4 className="text-[0.95rem] font-semibold">{title}</h4>
      {action}
    </div>
  )
  return (
    <section aria-label={regionLabel} className="flex min-w-0 flex-col gap-2.5">
      {headingAbove && heading}
      <div
        className={`${CARD} flex flex-col ${flush ? 'overflow-hidden' : 'gap-4 p-4 sm:p-5'}`}
      >
        {!headingAbove && heading}
        {children}
      </div>
    </section>
  )
}

/** A pill in a card's footer row ("Compare-at", "Charge tax Yes"…): a button that opens its fields. */
export function Chip({
  children,
  value,
  onClick,
}: {
  children: ReactNode
  /** A value shown in a small tag inside the pill ("Yes", "12.00"). */
  value?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border bg-bg text-text hover:border-accent hover:text-accent focus-visible:outline-accent inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-medium transition-colors focus-visible:outline-2"
    >
      {children}
      {value !== undefined && (
        <span className="bg-surface rounded-md px-1.5 py-px text-[0.74rem] font-semibold">
          {value}
        </span>
      )}
    </button>
  )
}

/**
 * The footer of a card: a row of pills and a chevron at the right that opens the card's extra
 * fields (`children`) — the store admin's "Compare-at · Charge tax · Cost per item ⌄". It is
 * closed to begin with; pressing a pill or the chevron opens it (the chevron also closes it).
 */
export function CardFooter({
  chips,
  open,
  onToggle,
  children,
}: {
  chips: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border-border -mx-4 -mb-4 border-t sm:-mx-5 sm:-mb-5">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">{chips}</div>
        <button
          type="button"
          aria-label={open ? 'Hide more options' : 'Show more options'}
          aria-expanded={open}
          onClick={onToggle}
          className="text-text-muted hover:text-text inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
        >
          <ChevronDownIcon
            width={16}
            height={16}
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {open && (
        <div className="border-border bg-surface/40 flex flex-col gap-4 border-t px-4 py-4 sm:px-5">
          {children}
        </div>
      )}
    </div>
  )
}

/** What lets a section or strip run edge to edge inside a card's padded content. */
const EDGE = '-mx-4 sm:-mx-5'
const EDGE_BOTTOM = '-mb-4 sm:-mb-5'

/**
 * A collapsible section at the foot of a card ("Additional pricing options", "More details"): a
 * full-width header you click to open or close — its title and a chevron — and, when open, its
 * fields. It runs edge to edge under the card's fields; the last thing in a card says so with
 * `last`, so it also reaches the card's bottom edge.
 */
export function CardSection({
  title,
  open,
  onToggle,
  last = false,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  /** The card's last block: its bottom edge is the card's. */
  last?: boolean
  children: ReactNode
}) {
  return (
    <div className={`border-border border-t ${EDGE} ${last ? EDGE_BOTTOM : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="hover:bg-accent-tint/40 flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-3 text-left text-[0.85rem] font-semibold transition-colors sm:px-5"
      >
        {title}
        <ChevronDownIcon
          width={16}
          height={16}
          className={`text-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="flex flex-col gap-4 px-4 pb-4 sm:px-5">{children}</div>}
    </div>
  )
}

/** A row of small figures at the very bottom of a card (Cost · Profit · Margin). */
export function CardStrip({ children }: { children: ReactNode }) {
  return (
    <div
      className={`border-border bg-surface/40 flex flex-col gap-2 border-t px-4 py-3 sm:px-5 ${EDGE} ${EDGE_BOTTOM}`}
    >
      {children}
    </div>
  )
}
