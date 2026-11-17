import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import { AlertTriangleIcon, EyeIcon, LayersIcon } from '../../../components/ui/icons.tsx'
import { ROW_ACTION, ROW_ACTION_ICON } from '../../../components/ui/rowActions.ts'
import { ariaSort, SortButton } from '../../../components/ui/SortButton.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { CollectionListItem } from '../../../lib/api/endpoints.ts'
import type { CollectionFilters } from '../hooks/useCollections.ts'
import { formatDateTime } from '../../../lib/format.ts'
import { formatUpdatedAt } from '../../../lib/storeTime.ts'
import { CollectionImage, Message, TypeBadge } from './CollectionParts.tsx'
import { CONDITIONS_SHOWN, conditionTexts } from '../utils/conditions.ts'
import { count, MESSAGE_BUTTON } from '../utils/ui.ts'

// No alignment in the base classes: each column sets its own, header and cells alike.
const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-2.5 align-middle text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH_LEFT = `${TH_BASE} text-left`
const TH_CENTER = `${TH_BASE} text-center`
const TD = 'px-3 py-1.5 align-middle whitespace-nowrap'
const TD_CENTER = `${TD} text-center`
const SKELETON_ROWS = 8

// Every column gets a share of the table's width (it is fixed-layout), so the gaps between them
// stay even at any window width instead of the Collection column taking all the spare room.
const COLUMN_WIDTHS = {
  collection: 31,
  condition: 29,
  products: 10,
  store: 0,
  updated: 19,
  actions: 11,
}
const COLUMN_WIDTHS_WITH_STORE = {
  collection: 26,
  condition: 24,
  products: 9,
  store: 15,
  updated: 16,
  actions: 10,
}

interface CollectionsListProps {
  items: CollectionListItem[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  /** Several stores are listed (All shops): show which one each collection is in. */
  showStore: boolean
  /** The column the list is sorted by and which way (only Collection, Products and Updated sort). */
  sort: CollectionFilters['sort']
  order: CollectionFilters['order']
  /** A sortable header was pressed: sort by that column (the same one again flips the direction). */
  onSort: (sort: CollectionFilters['sort']) => void
  onOpen: (collection: CollectionListItem) => void
  onRetry: () => void
  onClearFilters: () => void
  /** The empty list's own call to action (Add collection). */
  emptyAction?: ReactNode
}

// "16 minutes ago", "Yesterday, 4:30 PM", "Monday, 4:30 PM" or "October 10, 2026" — worked out from
// the current time on every render; the full date and time is the hover text.
const updated = (value: string | null | undefined) =>
  value ? <span title={formatDateTime(value)}>{formatUpdatedAt(value) || '—'}</span> : '—'

/** Width of the dropdown, used to keep it on the screen. */
const PANEL_WIDTH = 340

/**
 * The conditions after the first two, as a small dropdown card under the "+ More Conditions" link
 * (like the "+N" of a tag list): drawn on the page body, fixed to the screen, so the table's scroll
 * box never clips it. It closes on an outside click, Escape, or a scroll or resize.
 */
function MoreConditions({
  collection,
  rest,
}: {
  collection: CollectionListItem
  rest: string[]
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const open = position !== null

  useEffect(() => {
    if (!open) return undefined
    const close = () => setPosition(null)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panel.current?.contains(target) || button.current?.contains(target)) return
      close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        button.current?.focus()
      }
    }
    // A card fixed to the screen would drift from its row, so a scroll or resize closes it.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    if (open) {
      setPosition(null)
      return
    }
    const rect = button.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8))
    setPosition({ top: rect.bottom + 6, left })
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`Show ${rest.length} more ${rest.length === 1 ? 'condition' : 'conditions'} of ${collection.title}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className="text-accent cursor-pointer border-none bg-transparent p-0 text-[0.76rem] font-semibold hover:underline"
      >
        + More Conditions
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="group"
            aria-label={`More conditions of ${collection.title}`}
            style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
            className="border-border bg-bg fixed z-50 flex flex-col gap-2 rounded-xl border p-3 text-left whitespace-normal shadow-lg"
          >
            <p className="text-text-muted m-0 text-[0.68rem] font-bold tracking-wide uppercase">
              More conditions ({rest.length})
            </p>
            <ul className="m-0 flex max-h-56 list-none flex-col gap-1.5 overflow-auto p-0">
              {rest.map((condition, index) => (
                <li
                  key={`${condition}-${index}`}
                  className="bg-surface border-border text-text rounded-lg border px-2.5 py-1 text-[0.76rem] font-medium [overflow-wrap:anywhere]"
                >
                  {condition}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}

/**
 * A collection's first two conditions, one under the other (the backend's own wording, cut with "…"
 * when long; the full text is the hover text), then "+ More Conditions" when it has more, which
 * opens the rest in a small dropdown. A collection with none shows a dash.
 */
function ConditionCell({ collection }: { collection: CollectionListItem }) {
  const conditions = conditionTexts(collection)
  if (conditions.length === 0) return <span className="text-text-muted">—</span>
  const rest = conditions.slice(CONDITIONS_SHOWN)
  return (
    <span className="flex min-w-0 flex-col items-start gap-1">
      {conditions.slice(0, CONDITIONS_SHOWN).map((condition, index) => (
        <span
          key={`${condition}-${index}`}
          title={condition}
          className="border-border bg-surface text-text block max-w-full truncate rounded-md border px-2 py-0.5 text-[0.76rem] font-medium"
        >
          {condition}
        </span>
      ))}
      {rest.length > 0 && <MoreConditions collection={collection} rest={rest} />}
    </span>
  )
}

function ViewButton({
  collection,
  onOpen,
}: {
  collection: CollectionListItem
  onOpen: (collection: CollectionListItem) => void
}) {
  return (
    <button
      type="button"
      aria-label={`View collection ${collection.title}`}
      title="View"
      onClick={() => onOpen(collection)}
      className={ROW_ACTION}
    >
      <EyeIcon width={ROW_ACTION_ICON} height={ROW_ACTION_ICON} />
    </button>
  )
}

/**
 * The collections: a sticky-header table from `md` up (picture, title and handle, products,
 * store, last updated, View), stacked cards below it. It draws the loading, error
 * and empty states itself.
 */
export function CollectionsList({
  items,
  isPending,
  error,
  hasFilters,
  isStale,
  showStore,
  sort,
  order,
  onSort,
  onOpen,
  onRetry,
  onClearFilters,
  emptyAction,
}: CollectionsListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const width = showStore ? COLUMN_WIDTHS_WITH_STORE : COLUMN_WIDTHS

  if (error) {
    return (
      <Message>
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="text-text font-semibold">Couldn&apos;t load the collections</p>
          <p>{error}</p>
        </div>
        <button type="button" className={MESSAGE_BUTTON} onClick={onRetry}>
          Try again
        </button>
      </Message>
    )
  }

  if (!isPending && items.length === 0) {
    return (
      <Message>
        <LayersIcon width={28} height={28} />
        <div>
          <p className="text-text font-semibold">No collections found</p>
          <p>
            {hasFilters
              ? 'Nothing matches the current search and filters.'
              : 'This store has no collections yet.'}
          </p>
        </div>
        {hasFilters ? (
          <button type="button" className={MESSAGE_BUTTON} onClick={onClearFilters}>
            Clear all filters
          </button>
        ) : (
          emptyAction
        )}
      </Message>
    )
  }

  const dim = isStale ? 'opacity-60' : ''

  if (!isDesktop) {
    return (
      <ul
        aria-busy={isPending || isStale}
        className={`flex flex-col gap-2.5 p-3 transition-opacity duration-150 ${dim}`}
      >
        {isPending
          ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li
                key={index}
                aria-hidden="true"
                className="border-border bg-surface h-20 animate-pulse rounded-xl border"
              />
            ))
          : items.map((collection) => (
              <li key={collection.id}>
                <button
                  type="button"
                  onClick={() => onOpen(collection)}
                  className="border-border bg-bg hover:border-accent flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors"
                >
                  <CollectionImage src={collection.image_url} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[0.88rem] font-semibold">
                      <Highlight text={collection.title} />
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[0.78rem]">
                      <TypeBadge type={collection.collection_type} />
                      <span className="text-text-muted">
                        {count(collection.products_count)} products
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
      </ul>
    )
  }

  return (
    <>
      <div
        aria-busy={isPending || isStale}
        className="relative max-h-[min(68svh,760px)] overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1"
      >
        <table
          className={`w-full min-w-[1100px] table-fixed border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
        >
          <thead>
            <tr>
              <th
                className={TH_LEFT}
                style={{ width: `${width.collection}%` }}
                aria-sort={ariaSort(sort === 'title', order)}
              >
                <SortButton
                  label="Collection"
                  active={sort === 'title'}
                  order={order}
                  onClick={() => onSort('title')}
                />
              </th>
              <th className={TH_LEFT} style={{ width: `${width.condition}%` }}>
                Condition
              </th>
              <th
                className={TH_CENTER}
                style={{ width: `${width.products}%` }}
                aria-sort={ariaSort(sort === 'products', order)}
              >
                <SortButton
                  label="Products"
                  active={sort === 'products'}
                  order={order}
                  onClick={() => onSort('products')}
                />
              </th>
              {showStore && (
                <th className={TH_CENTER} style={{ width: `${width.store}%` }}>
                  Store
                </th>
              )}
              <th
                className={TH_CENTER}
                style={{ width: `${width.updated}%` }}
                aria-sort={ariaSort(sort === 'updated', order)}
              >
                <SortButton
                  label="Updated"
                  active={sort === 'updated'}
                  order={order}
                  onClick={() => onSort('updated')}
                />
              </th>
              <th className={TH_CENTER} style={{ width: `${width.actions}%` }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr className="sr-only">
                <td role="status">Loading collections…</td>
              </tr>
            )}
            {isPending
              ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                  <tr key={row} aria-hidden="true" className="border-border border-b">
                    {Array.from({ length: showStore ? 6 : 5 }, (_, cell) => (
                      <td key={cell} className={TD}>
                        <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : items.map((collection) => (
                  <tr
                    key={collection.id}
                    className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                  >
                    <td className={`${TD} text-left`}>
                      <span className="flex items-center gap-3">
                        <CollectionImage src={collection.image_url} />
                        <span className="flex min-w-0 flex-col">
                          <button
                            type="button"
                            onClick={() => onOpen(collection)}
                            className="text-text hover:text-accent cursor-pointer truncate border-none bg-transparent p-0 text-left font-semibold transition-colors"
                            title={collection.title}
                          >
                            <Highlight text={collection.title} />
                          </button>
                        </span>
                      </span>
                    </td>
                    <td className={`${TD} overflow-hidden text-left`}>
                      <ConditionCell collection={collection} />
                    </td>
                    <td className={`${TD_CENTER} font-semibold`}>
                      {count(collection.products_count)}
                    </td>
                    {showStore && (
                      <td className={`${TD_CENTER} overflow-hidden`}>
                        <span
                          className="block truncate"
                          title={collection.shop?.name ?? ''}
                        >
                          {collection.shop?.name ?? '—'}
                        </span>
                      </td>
                    )}
                    <td className={TD_CENTER}>
                      {updated(collection.shopify_updated_at)}
                    </td>
                    <td className={TD_CENTER}>
                      <ViewButton collection={collection} onOpen={onOpen} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
