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
 * A card of the form. `title` names the region for assistive technology; it is also shown
 * as the card's heading — inside the card, or (`outside`) above it, the way the store admin
 * puts "Price", "Variants" and "Search engine listing" — unless `hideTitle` (the first card
 * has no heading). `action` sits at the heading's right edge.
 */
export function CreateCard({
  title,
  regionLabel = title,
  description,
  outside = false,
  hideTitle = false,
  flush = false,
  action,
  children,
}: {
  title: string
  /** What the region is called for assistive technology, when that differs from the heading. */
  regionLabel?: string
  description?: string
  outside?: boolean
  hideTitle?: boolean
  /** No padding or gaps inside: the content brings its own (rows that run edge to edge). */
  flush?: boolean
  action?: ReactNode
  children: ReactNode
}) {
  const heading = !hideTitle && (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[0.95rem] font-semibold">{title}</h3>
        {description && (
          <p className="text-text-muted mt-0.5 text-[0.8rem]">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
  return (
    <section aria-label={regionLabel} className="flex min-w-0 flex-col gap-2.5">
      {outside && heading}
      <div
        className={`${CARD} flex flex-col ${flush ? 'overflow-hidden' : 'gap-4 p-4 sm:p-5'}`}
      >
        {!outside && heading}
        {children}
      </div>
    </section>
  )
}

/** A pill in a card's footer row ("Compare-at", "Charge tax Yes"…): a button that opens its fields. */
export function Chip({
  children,
  value,
  pressed,
  onClick,
}: {
  children: ReactNode
  /** A value shown in a small tag inside the pill ("Yes", "Off"). */
  value?: string
  pressed?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[0.78rem] font-medium transition-colors ${
        pressed
          ? 'border-accent bg-accent-tint text-text'
          : 'bg-surface text-text hover:border-border-strong border-transparent'
      }`}
    >
      {children}
      {value !== undefined && (
        <span className="bg-bg rounded px-1.5 py-px text-[0.7rem] font-semibold">
          {value}
        </span>
      )}
    </button>
  )
}

/**
 * The footer of a card: a row of pills and a chevron at the right that opens the card's extra
 * fields (`children`) — the store admin's "Compare-at · Unit price · Charge tax · Cost per item ⌄".
 */
export function CardFooter({
  chips,
  open,
  onToggle,
  expandable = true,
  children,
}: {
  chips: ReactNode
  open: boolean
  onToggle: () => void
  /** False when there are no extra fields to open (no chevron then). */
  expandable?: boolean
  children?: ReactNode
}) {
  return (
    <div className="border-border -mx-4 -mb-4 border-t sm:-mx-5 sm:-mb-5">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">{chips}</div>
        {expandable && (
          <button
            type="button"
            aria-label={open ? 'Hide more options' : 'Show more options'}
            aria-expanded={open}
            onClick={onToggle}
            className="text-text-muted hover:text-text inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
          >
            <ChevronDownIcon
              width={16}
              height={16}
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>
      {open && expandable && (
        <div className="border-border bg-surface/40 flex flex-col gap-4 border-t px-4 py-4 sm:px-5">
          {children}
        </div>
      )}
    </div>
  )
}
