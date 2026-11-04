import { Fragment, useState, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import {
  AlertTriangleIcon,
  ChevronRightIcon,
  EyeIcon,
  PencilIcon,
  SearchIcon,
} from '../../../components/ui/icons.tsx'
import { ROW_ACTION } from '../../../components/ui/rowActions.ts'
import { ariaSort, SortButton } from '../../../components/ui/SortButton.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { InventoryItem, InventorySort } from '../../../lib/api/endpoints.ts'
import { formatQuantity, stockLevel } from '../../../lib/inventoryStock.ts'
import { statusLabel, statusTone, variantName } from '../utils/format.ts'
import { StockTable, type StockEditRequest } from './StockTable.tsx'
import { VariantImage } from './VariantImage.tsx'

const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-2.5 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_RIGHT = `${TH_BASE} text-right`
const TH_CENTER = `${TH_BASE} text-center`
const TD = 'px-3 py-1.5 whitespace-nowrap'
const SKELETON_ROWS = 8

const MESSAGE_BUTTON =
  'border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors'

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted flex flex-col items-center gap-3 px-4 py-14 text-center text-[0.9rem]">
      {children}
    </div>
  )
}

/** A number cell: out of stock in red, low in amber, 0 for the others plain. */
function Figure({
  value,
  stock = false,
  threshold,
}: {
  value: number | null | undefined
  /** Colour it by how much stock there is (Available). */
  stock?: boolean
  threshold: number
}) {
  const level = stock ? stockLevel(value, threshold) : 'in'
  return (
    <span
      className={`tabular-nums ${
        level === 'out'
          ? 'text-danger font-semibold'
          : level === 'low'
            ? 'text-warning font-semibold'
            : ''
      }`}
    >
      {formatQuantity(value ?? 0)}
    </span>
  )
}

interface InventoryListProps {
  items: InventoryItem[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  /** What counts as low stock (the filter's threshold, else 10). */
  threshold: number
  sort: InventorySort
  order: 'asc' | 'desc'
  onSort: (sort: InventorySort) => void
  /** Opens a variant's stock page. */
  onOpen: (item: InventoryItem) => void
  /** Hover/focus on View: start loading so opening is instant. */
  onPrefetch: (id: string) => void
  /** Opens the edit window for a variant (a row's pencil, or a location line's Set / Adjust). */
  onEdit: (item: InventoryItem, request: StockEditRequest) => void
  onRetry: () => void
  onClearFilters: () => void
}

/**
 * The results area: a sticky-header table from `md` up (stacked cards below it). A row shows the
 * variant (picture, product with the variant under it, SKU, product status — no barcode column) and its
 * totals — Available, On hand, Committed, Incoming, Unavailable; a **chevron opens the row** to
 * one line per location, where Available and On hand change by double-clicking and **Set** /
 * **Adjust** open the edit window. A variant Shopify does not track says "Not tracked" and has no
 * edit buttons. Handles the loading skeleton, error and empty states itself.
 */
export function InventoryList({
  items,
  isPending,
  error,
  hasFilters,
  isStale,
  threshold,
  sort,
  order,
  onSort,
  onOpen,
  onPrefetch,
  onEdit,
  onRetry,
  onClearFilters,
}: InventoryListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (error) {
    return (
      <Message>
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="text-text font-semibold">Couldn&apos;t load the inventory</p>
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
        <SearchIcon width={28} height={28} />
        <div>
          <p className="text-text font-semibold">No stock found</p>
          <p>Nothing matches the current search and filters.</p>
        </div>
        {hasFilters && (
          <button type="button" className={MESSAGE_BUTTON} onClick={onClearFilters}>
            Clear all filters
          </button>
        )}
      </Message>
    )
  }

  const dim = isStale ? 'opacity-60' : ''

  if (!isDesktop) {
    return (
      <ul
        aria-busy={isPending || isStale}
        className={`m-0 flex list-none flex-col gap-2.5 p-3 transition-opacity duration-150 ${dim}`}
      >
        {isPending
          ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li
                key={index}
                aria-hidden="true"
                className="border-border bg-surface h-24 animate-pulse rounded-xl border"
              />
            ))
          : items.map((item) => {
              const name = variantName(item)
              return (
                <li key={item.variant_id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    onPointerEnter={() => onPrefetch(item.variant_id)}
                    onFocus={() => onPrefetch(item.variant_id)}
                    aria-label={`View ${item.title}${name ? ` ${name}` : ''}`}
                    className="border-border bg-bg hover:border-accent flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors"
                  >
                    <VariantImage src={item.image_url} size="md" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="line-clamp-2 text-[0.88rem] font-semibold">
                        <Highlight text={item.title} />
                      </span>
                      {name && (
                        <span className="text-text-muted text-[0.78rem]">{name}</span>
                      )}
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.82rem]">
                        {item.tracked === false ? (
                          <Badge tone="neutral">Not tracked</Badge>
                        ) : (
                          <>
                            <span>
                              <span className="text-text-muted">Available </span>
                              <Figure
                                value={item.totals.available}
                                stock
                                threshold={threshold}
                              />
                            </span>
                            <span>
                              <span className="text-text-muted">On hand </span>
                              <Figure value={item.totals.on_hand} threshold={threshold} />
                            </span>
                          </>
                        )}
                        <Badge tone={statusTone(item.status)}>
                          {statusLabel(item.status)}
                        </Badge>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
      </ul>
    )
  }

  const head = (label: string, key: InventorySort, className = TH) => (
    <th scope="col" className={className} aria-sort={ariaSort(sort === key, order)}>
      <SortButton
        label={label}
        active={sort === key}
        order={order}
        onClick={() => onSort(key)}
      />
    </th>
  )

  return (
    <div
      aria-busy={isPending || isStale}
      className="max-h-[min(68svh,760px)] min-h-0 flex-1 overflow-auto lg:max-h-none"
    >
      <table
        className={`w-full min-w-[1100px] border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th scope="col" className={`${TH_BASE} w-10`}>
              <span className="sr-only">Locations</span>
            </th>
            {head('Product', 'title')}
            {head('SKU', 'sku')}
            <th scope="col" className={TH_CENTER}>
              Status
            </th>
            {head('Available', 'available', TH_RIGHT)}
            {head('On hand', 'on_hand', TH_RIGHT)}
            {head('Committed', 'committed', TH_RIGHT)}
            {head('Incoming', 'incoming', TH_RIGHT)}
            {head('Unavailable', 'unavailable', TH_RIGHT)}
            <th scope="col" className={TH_CENTER}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {isPending
            ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <tr key={row} aria-hidden="true" className="border-border border-b">
                  {Array.from({ length: 10 }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <span className="bg-surface block h-4 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((item) => {
                const open = expanded.has(item.variant_id)
                const name = variantName(item)
                const editable = item.tracked !== false
                return (
                  <Fragment key={item.variant_id}>
                    <tr
                      className={`border-border hover:bg-accent-tint/40 border-b transition-colors ${
                        open ? 'bg-accent-tint/30' : ''
                      }`}
                    >
                      <td className={`${TD} text-center`}>
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={`${open ? 'Hide' : 'Show'} locations of ${item.title}${name ? ` ${name}` : ''}`}
                          onClick={() => toggle(item.variant_id)}
                          className="text-text-muted hover:text-text inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent transition-colors"
                        >
                          <ChevronRightIcon
                            width={16}
                            height={16}
                            className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                          />
                        </button>
                      </td>
                      <td className={TD}>
                        <button
                          type="button"
                          onClick={() => onOpen(item)}
                          onPointerEnter={() => onPrefetch(item.variant_id)}
                          onFocus={() => onPrefetch(item.variant_id)}
                          className="flex max-w-96 cursor-pointer items-center gap-2.5 border-none bg-transparent p-0 text-left"
                        >
                          <VariantImage src={item.image_url} />
                          <span className="flex min-w-0 flex-col">
                            <span className="hover:text-accent truncate font-semibold transition-colors">
                              <Highlight text={item.title} />
                            </span>
                            {name && (
                              <span className="text-text-muted truncate text-[0.76rem]">
                                <Highlight text={name} />
                              </span>
                            )}
                          </span>
                        </button>
                      </td>
                      <td className={TD}>
                        {item.sku ? (
                          <span className="flex items-center gap-1">
                            <span className="font-mono text-[0.8rem]">
                              <Highlight text={item.sku} />
                            </span>
                            <CopyButton value={item.sku} label={`Copy ${item.sku}`} />
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className={`${TD} text-center`}>
                        <Badge
                          tone={statusTone(item.status)}
                          className="w-24 justify-center"
                        >
                          {statusLabel(item.status)}
                        </Badge>
                      </td>
                      {editable ? (
                        <>
                          <td className={`${TD} text-right`}>
                            <Figure
                              value={item.totals.available}
                              stock
                              threshold={threshold}
                            />
                          </td>
                          <td className={`${TD} text-right`}>
                            <Figure value={item.totals.on_hand} threshold={threshold} />
                          </td>
                          <td className={`${TD} text-right`}>
                            <Figure value={item.totals.committed} threshold={threshold} />
                          </td>
                          <td className={`${TD} text-right`}>
                            <Figure value={item.totals.incoming} threshold={threshold} />
                          </td>
                          <td className={`${TD} text-right`}>
                            <Figure
                              value={item.totals.unavailable}
                              threshold={threshold}
                            />
                          </td>
                        </>
                      ) : (
                        <td colSpan={5} className={`${TD} text-center`}>
                          <Badge tone="neutral">Not tracked</Badge>
                        </td>
                      )}
                      <td className={`${TD} text-center`}>
                        <span className="inline-flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            aria-label={`View ${item.title}${name ? ` ${name}` : ''}`}
                            title="View"
                            onClick={() => onOpen(item)}
                            onPointerEnter={() => onPrefetch(item.variant_id)}
                            onFocus={() => onPrefetch(item.variant_id)}
                            className={ROW_ACTION}
                          >
                            <EyeIcon />
                          </button>
                          {editable && (
                            <button
                              type="button"
                              aria-label={`Edit stock of ${item.title}${name ? ` ${name}` : ''}`}
                              title="Edit stock"
                              onClick={() =>
                                onEdit(item, {
                                  locationId: item.locations[0]?.location_id ?? 0,
                                  mode: 'set',
                                })
                              }
                              className={ROW_ACTION}
                            >
                              <PencilIcon />
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-border bg-surface/60 border-b">
                        <td />
                        <td colSpan={9} className="px-3 py-3">
                          <StockTable
                            item={item}
                            lines={item.locations}
                            columns="summary"
                            onEdit={(request) => onEdit(item, request)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
        </tbody>
      </table>
    </div>
  )
}
