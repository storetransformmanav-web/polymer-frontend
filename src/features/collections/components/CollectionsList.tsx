import type { ReactNode } from 'react'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import { AlertTriangleIcon, EyeIcon, LayersIcon } from '../../../components/ui/icons.tsx'
import { ROW_ACTION } from '../../../components/ui/rowActions.ts'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { CollectionListItem } from '../../../lib/api/endpoints.ts'
import { formatDate, formatDateTime } from '../../../lib/format.ts'
import { sortOrderLabel } from '../utils/collectionDraft.ts'
import { CollectionImage, Message, TypeBadge } from './CollectionParts.tsx'
import { count, MESSAGE_BUTTON } from '../utils/ui.ts'

// No alignment in the base classes: each column sets its own, header and cells alike.
const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-2.5 align-middle text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH_LEFT = `${TH_BASE} text-left`
const TH_CENTER = `${TH_BASE} text-center`
const TD = 'px-3 py-1.5 align-middle whitespace-nowrap'
const TD_CENTER = `${TD} text-center`
const SKELETON_ROWS = 8

interface CollectionsListProps {
  items: CollectionListItem[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  /** Several stores are listed (All shops): show which one each collection is in. */
  showStore: boolean
  onOpen: (collection: CollectionListItem) => void
  onRetry: () => void
  onClearFilters: () => void
  /** The empty list's own call to action (Add collection). */
  emptyAction?: ReactNode
}

const updated = (value: string | null | undefined) =>
  value ? <span title={formatDateTime(value)}>{formatDate(value)}</span> : '—'

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
      <EyeIcon width={15} height={15} />
    </button>
  )
}

/**
 * The collections: a sticky-header table from `md` up (picture, title and handle, type, products,
 * product order, store, last updated, View), stacked cards below it. It draws the loading, error
 * and empty states itself.
 */
export function CollectionsList({
  items,
  isPending,
  error,
  hasFilters,
  isStale,
  showStore,
  onOpen,
  onRetry,
  onClearFilters,
  emptyAction,
}: CollectionsListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

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
    <div
      aria-busy={isPending || isStale}
      className="relative max-h-[min(68svh,760px)] overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1"
    >
      <table
        className={`w-full min-w-[900px] table-fixed border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th className={TH_LEFT}>Collection</th>
            <th className={`${TH_CENTER} w-32`}>Type</th>
            <th className={`${TH_CENTER} w-28`}>Products</th>
            <th className={`${TH_CENTER} w-40`}>Product order</th>
            {showStore && <th className={`${TH_CENTER} w-44`}>Store</th>}
            <th className={`${TH_CENTER} w-32`}>Updated</th>
            <th className={`${TH_CENTER} w-24`}>Actions</th>
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
                  {Array.from({ length: showStore ? 7 : 6 }, (_, cell) => (
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
                  <td className={TD_CENTER}>
                    <TypeBadge
                      type={collection.collection_type}
                      className="w-24 justify-center"
                    />
                  </td>
                  <td className={`${TD_CENTER} font-semibold`}>
                    {count(collection.products_count)}
                  </td>
                  <td className={`${TD_CENTER} text-text-muted overflow-hidden`}>
                    {sortOrderLabel(collection.sort_order)}
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
                  <td className={TD_CENTER}>{updated(collection.shopify_updated_at)}</td>
                  <td className={TD_CENTER}>
                    <ViewButton collection={collection} onOpen={onOpen} />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
