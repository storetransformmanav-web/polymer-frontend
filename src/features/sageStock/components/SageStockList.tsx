import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import {
  AlertTriangleIcon,
  ProductsIcon,
  SearchIcon,
} from '../../../components/ui/icons.tsx'
import { ariaSort, SortButton } from '../../../components/ui/SortButton.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import type { SageStockItem, SageStockSort } from '../../../lib/api/sageStock.ts'
import { sageStockTableMinWidthRem, type SageStockColumnDef } from '../utils/columns.ts'
import { count, dateText, money, percent, statusPill, yesNo } from '../utils/format.ts'

// The same table text, header and cell sizes as the Products, Orders, Invoices and Sage lists. A heading
// and its cells share one alignment, so the two always line up.
const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-3 align-middle text-[0.7rem] font-bold leading-tight tracking-wide uppercase backdrop-blur'
const TH_ALIGN = {
  left: `${TH_BASE} text-left`,
  center: `${TH_BASE} text-center`,
  right: `${TH_BASE} text-right`,
}
const TD = 'overflow-hidden px-3 py-3 align-middle'
const TD_ALIGN = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right tabular-nums',
}
const SKELETON_ROWS = 8

interface SageStockListProps {
  items: SageStockItem[]
  /** The columns to draw, in order. */
  columns: readonly SageStockColumnDef[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  sort: SageStockSort
  order: 'asc' | 'desc'
  /** A sortable heading was pressed. */
  onSort: (sort: SageStockSort) => void
  onRetry: () => void
  onClearFilters: () => void
}

const DASH = <span className="text-text-muted">—</span>

/** Plain text, cut short with the whole text on hover; a dash when there is none. */
function TextCell({ value, highlight }: { value: string; highlight?: boolean }) {
  if (!value) return DASH
  return (
    <span className="block truncate" title={value}>
      {highlight ? <Highlight text={value} /> : value}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { label, tone } = statusPill(status)
  return (
    <Badge tone={tone} className="w-[7.5rem] justify-center">
      {label}
    </Badge>
  )
}

/** The CRM product that has this SKU: its picture and name, a link to its page; a dash for a Sage-only item. */
function ShopifyCell({ item }: { item: SageStockItem }) {
  const shopify = item.shopify
  if (!shopify) return DASH
  const title = shopify.title || shopify.sku
  const src = safeUrl(shopify.image_url)
  const label = [title, shopify.variant_title].filter(Boolean).join(' · ')
  return (
    <span className="flex min-w-0 items-center gap-2">
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="border-border size-8 shrink-0 rounded border object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="bg-surface border-border text-text-muted flex size-8 shrink-0 items-center justify-center rounded border"
        >
          <ProductsIcon width={14} height={14} />
        </span>
      )}
      {shopify.product_id ? (
        <Link
          to={`/products/${encodeURIComponent(shopify.product_id)}`}
          className="text-text hover:text-accent min-w-0 truncate no-underline hover:underline"
          title={label}
        >
          {title}
        </Link>
      ) : (
        <span className="truncate" title={label}>
          {title}
        </span>
      )}
    </span>
  )
}

/** What one column shows for one stock item. */
function ColumnCell({
  column,
  item,
}: {
  column: SageStockColumnDef
  item: SageStockItem
}) {
  switch (column.id) {
    case 'code':
      return item.stock_code ? (
        <span className="block truncate font-semibold" title={item.stock_code}>
          <Highlight text={item.stock_code} />
        </span>
      ) : (
        DASH
      )
    case 'description':
      return <TextCell value={item.description} highlight />
    case 'category':
      return <TextCell value={item.category} highlight />
    case 'unit':
      return <>{item.unit_of_sale || DASH}</>
    case 'status':
      return item.stock_status ? <StatusBadge status={item.stock_status} /> : DASH
    case 'inStock':
      return <span className="font-semibold">{count(item.qty_in_stock)}</span>
    case 'allocated':
      return <>{count(item.qty_allocated)}</>
    case 'free':
      return <>{count(item.qty_free)}</>
    case 'onOrder':
      return <>{count(item.qty_on_order)}</>
    case 'reorderLevel':
      return <>{count(item.reorder_level)}</>
    case 'reorderQty':
      return <>{count(item.reorder_qty)}</>
    case 'salesPrice':
      return <>{money(item.sales_price)}</>
    case 'averageCost':
      return <>{money(item.average_cost)}</>
    case 'lastPurchasePrice':
      return <>{money(item.last_purchase_price)}</>
    case 'margin':
      return <>{percent(item.margin_percent)}</>
    case 'stockValue':
      return <span className="font-semibold">{money(item.stock_value)}</span>
    case 'soldYtd':
      return <>{count(item.qty_sold_ytd)}</>
    case 'salesYtd':
      return <>{money(item.sales_ytd)}</>
    case 'lastSold':
      return <span>{dateText(item.last_sale_date)}</span>
    case 'lastPurchased':
      return <span>{dateText(item.last_purchase_date)}</span>
    case 'supplier':
      return <TextCell value={item.supplier_ref} highlight />
    case 'supplierPart':
      return <TextCell value={item.supplier_part_number} highlight />
    case 'barcode':
      return <TextCell value={item.barcode} highlight />
    case 'location':
      return <TextCell value={item.location} />
    case 'taxCode':
      return <TextCell value={item.tax_code} />
    case 'webPublished':
      return <>{yesNo(item.web_published)}</>
    case 'inactive':
      return <>{yesNo(item.inactive)}</>
    case 'shopify':
      return <ShopifyCell item={item} />
    case 'shopifyStock':
      return <>{count(item.shopify?.inventory_quantity)}</>
    default:
      return null
  }
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted flex flex-col items-center gap-3 px-4 py-14 text-center text-[0.9rem]">
      {children}
    </div>
  )
}

const MESSAGE_BUTTON =
  'border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors'

/**
 * The results area: from `lg` up a table in its own scrolling box — it takes the height the page gives
 * it, scrolls up and down under a sticky header and sideways when the window is narrower than its
 * columns — and cards below that. The columns are the ones chosen in the Columns menu; the Shopify
 * column links to the CRM product that has the SKU. The headings of the columns the API can sort by are
 * sort buttons. Handles the loading skeleton, the error and the empty states itself.
 */
export function SageStockList({
  items,
  columns,
  isPending,
  error,
  hasFilters,
  isStale,
  sort,
  order,
  onSort,
  onRetry,
  onClearFilters,
}: SageStockListProps) {
  const isTable = useMediaQuery('(min-width: 1024px)')

  if (error) {
    return (
      <Message>
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="text-text font-semibold">Couldn&apos;t load stock</p>
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
          <p className="text-text font-semibold">No stock items found</p>
          <p>
            {hasFilters
              ? 'Nothing matches the current search and filters.'
              : 'There are no stock items to show yet.'}
          </p>
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

  if (!isTable) {
    return (
      <ul
        aria-busy={isPending || isStale}
        className={`grid grid-cols-1 gap-2.5 p-3 transition-opacity duration-150 md:grid-cols-2 ${dim}`}
      >
        {isPending && (
          <li role="status" className="sr-only">
            Loading stock…
          </li>
        )}
        {isPending
          ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li
                key={index}
                aria-hidden="true"
                className="border-border bg-surface h-28 animate-pulse rounded-xl border"
              />
            ))
          : items.map((item) => (
              <li
                key={item.stock_code}
                className="border-border bg-bg flex min-w-0 flex-col gap-1.5 rounded-xl border p-3"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate text-[0.88rem] font-semibold">
                    {item.stock_code || '—'}
                  </span>
                  <span className="text-[0.88rem] font-semibold">
                    {money(item.sales_price)}
                  </span>
                </span>
                <span className="truncate text-[0.82rem]">{item.description || '—'}</span>
                <span className="text-text-muted text-[0.78rem]">
                  In stock {count(item.qty_in_stock)} · Free {count(item.qty_free)} · On
                  order {count(item.qty_on_order)}
                </span>
                <span className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  {item.stock_status ? <StatusBadge status={item.stock_status} /> : DASH}
                  <span className="text-text-muted text-[0.78rem]">
                    {item.category || 'No category'}
                  </span>
                </span>
              </li>
            ))}
      </ul>
    )
  }

  return (
    <div
      aria-busy={isPending || isStale}
      className="relative min-h-0 flex-1 overflow-auto"
    >
      <table
        style={{ minWidth: `${sageStockTableMinWidthRem(columns)}rem` }}
        className={`w-full table-fixed border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            {columns.map((column) => {
              const active = column.sort !== undefined && column.sort === sort
              return (
                <th
                  key={column.id}
                  style={{ width: `${column.width}rem` }}
                  className={TH_ALIGN[column.align]}
                  aria-sort={column.sort ? ariaSort(active, order) : undefined}
                >
                  {column.sort ? (
                    <SortButton
                      label={column.label}
                      active={active}
                      order={order}
                      onClick={() => onSort(column.sort as SageStockSort)}
                    />
                  ) : (
                    column.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {isPending && (
            <tr className="sr-only">
              <td role="status">Loading stock…</td>
            </tr>
          )}
          {isPending
            ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <tr key={row} aria-hidden="true" className="border-border border-b">
                  {Array.from({ length: columns.length }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((item) => (
                <tr
                  key={item.stock_code}
                  className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`${TD} whitespace-nowrap ${TD_ALIGN[column.align]}`}
                    >
                      <ColumnCell column={column} item={item} />
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
